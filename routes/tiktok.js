/**
 * Routeur TikTok OAuth2 & Publishing API (Agent Max)
 * Implémente le flux d'autorisation TikTok v2 (Login Kit), le protocole PKCE (S256),
 * la protection anti-CSRF via state, et la persistance chiffrée via l'Agent Victor.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { 
    saveTikTokAccount, 
    getTikTokAccountStatus, 
    disconnectTikTokAccount 
} = require('../services/tiktokTokenService');

// Portée des autorisations requises (Scopes officiels TikTok Content Posting v2)
const TIKTOK_SCOPES = 'user.info.basic,video.upload,video.publish';

/**
 * GET /api/tiktok/auth/login
 * Démarre le flux d'autorisation OAuth2 TikTok avec PKCE et state anti-CSRF.
 */
router.get('/api/tiktok/auth/login', (req, res) => {
    try {
        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const callbackUrl = process.env.TIKTOK_CALLBACK_URL;

        if (!clientKey || !callbackUrl) {
            return res.status(500).json({
                success: false,
                error: "Configuration TikTok incomplète : TIKTOK_CLIENT_KEY ou TIKTOK_CALLBACK_URL manquant dans le .env"
            });
        }

        // 1. Génération du State Anti-CSRF
        const state = crypto.randomBytes(16).toString('hex');

        // 2. Génération des paramètres PKCE (code_verifier & code_challenge S256)
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

        // 3. Mémorisation dans la session utilisateur
        req.session.tiktokOAuth = {
            state,
            codeVerifier,
            returnTo: req.query.returnTo || '/traduction.html'
        };

        // Sauvegarde explicite de la session avant redirection
        req.session.save((err) => {
            if (err) {
                console.error("[TIKTOK LOGIN ERROR] Échec de sauvegarde de session :", err);
                return res.status(500).json({ success: false, error: "Erreur d'initialisation de session" });
            }

            // 4. Construction de l'URL d'autorisation officielle TikTok v2
            const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
            authUrl.searchParams.set('client_key', clientKey);
            authUrl.searchParams.set('scope', TIKTOK_SCOPES);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('redirect_uri', callbackUrl);
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');

            console.log(`[TIKTOK OAUTH] 🚀 Redirection vers le portail TikTok : client_key=${clientKey.slice(0, 6)}... callback=${callbackUrl}`);
            return res.redirect(authUrl.toString());
        });
    } catch (err) {
        console.error("[TIKTOK LOGIN EXCEPTION]", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/tiktok/auth/callback
 * Réceptionne le code d'autorisation, vérifie le state et le PKCE, échange le jeton et stocke en base.
 */
router.get('/api/tiktok/auth/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        console.log("[TIKTOK CALLBACK] 📥 Réception de la requête de retour TikTok :", {
            code: code ? `${code.slice(0, 8)}...` : null,
            state,
            error,
            error_description
        });

        // 1. Gestion des erreurs renvoyées par TikTok (ex: refus utilisateur)
        if (error) {
            console.warn(`[TIKTOK OAUTH REFUSÉ] Code: ${error} | Description: ${error_description}`);
            return renderCallbackResponse(res, false, `Connexion annulée : ${error_description || error}`);
        }

        if (!code) {
            return renderCallbackResponse(res, false, "Code d'autorisation manquant dans la réponse TikTok.");
        }

        // 2. Validation du state anti-CSRF
        const storedOAuth = req.session ? req.session.tiktokOAuth : null;
        if (!storedOAuth || !storedOAuth.state || storedOAuth.state !== state) {
            console.error("[TIKTOK CSRF ERROR] State invalide ou session expirée :", {
                receivedState: state,
                storedState: storedOAuth ? storedOAuth.state : null
            });
            return renderCallbackResponse(res, false, "Échec de validation de sécurité (State CSRF invalide ou session expirée).");
        }

        const codeVerifier = storedOAuth.codeVerifier;
        const returnTo = storedOAuth.returnTo || '/traduction.html';

        // 3. Échange du code d'autorisation contre les tokens (POST https://open.tiktokapis.com/v2/oauth/token/)
        const tokenEndpoint = 'https://open.tiktokapis.com/v2/oauth/token/';
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_key', process.env.TIKTOK_CLIENT_KEY);
        tokenParams.append('client_secret', process.env.TIKTOK_CLIENT_SECRET);
        tokenParams.append('code', code);
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('redirect_uri', process.env.TIKTOK_CALLBACK_URL);
        tokenParams.append('code_verifier', codeVerifier);

        console.log("[TIKTOK OAUTH] 🔄 Échange du code contre les jetons auprès de l'API TikTok...");
        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache'
            },
            body: tokenParams.toString()
        });

        const tokenJson = await tokenResponse.json();
        console.log("[TIKTOK OAUTH] 📦 Réponse brute token :", JSON.stringify(tokenJson).slice(0, 200));

        // Format de réponse TikTok v2 : { data: { access_token, ... }, error: { code: "ok" } } ou direct
        const tokenData = tokenJson.data || tokenJson;

        if (!tokenData || !tokenData.access_token) {
            const errMsg = tokenJson.error?.message || tokenJson.message || "Impossible de récupérer l'access token";
            console.error("[TIKTOK TOKEN ERROR]", errMsg, tokenJson);
            return renderCallbackResponse(res, false, `Erreur TikTok : ${errMsg}`);
        }

        // 4. Récupération des informations de profil utilisateur (open_id, display_name, avatar_url)
        let profileData = {
            open_id: tokenData.open_id,
            display_name: 'Créateur TikTok',
            avatar_url: ''
        };

        try {
            const userInfoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });
            const userInfoJson = await userInfoRes.json();
            if (userInfoJson && userInfoJson.data && userInfoJson.data.user) {
                profileData = { ...profileData, ...userInfoJson.data.user };
                console.log(`[TIKTOK PROFILE] 👤 Profil récupéré : ${profileData.display_name} (@${profileData.open_id})`);
            }
        } catch (profileErr) {
            console.warn("[TIKTOK PROFILE WARNING] Impossible de charger les détails du profil :", profileErr.message);
        }

        // 5. Identification de l'utilisateur Aya
        const userId = req.session && req.session.user && req.session.user.id
            ? req.session.user.id
            : 'steve';

        // 6. Chiffrement AES-256-GCM et sauvegarde en base de données via l'Agent Victor
        await saveTikTokAccount(userId, tokenData, profileData);

        // Nettoyage de l'objet temporaire dans la session
        delete req.session.tiktokOAuth;
        req.session.save();

        console.log(`[TIKTOK OAUTH SUCCÈS] ✅ Compte '${profileData.display_name}' lié avec succès pour l'utilisateur Aya '${userId}'`);

        return renderCallbackResponse(res, true, `Compte TikTok (${profileData.display_name}) connecté avec succès !`, returnTo);

    } catch (err) {
        console.error("[TIKTOK CALLBACK FATAL ERROR]", err);
        return renderCallbackResponse(res, false, `Erreur interne : ${err.message}`);
    }
});

/**
 * GET /api/tiktok/auth/status
 * Renvoie l'état de connexion TikTok pour l'utilisateur actuellement connecté.
 */
router.get('/api/tiktok/auth/status', async (req, res) => {
    try {
        const userId = req.session && req.session.user && req.session.user.id
            ? req.session.user.id
            : 'steve';

        const status = await getTikTokAccountStatus(userId);
        return res.json({
            success: true,
            ...status
        });
    } catch (err) {
        console.error("[TIKTOK STATUS ERROR]", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/tiktok/auth/disconnect
 * Déconnecte le compte TikTok de l'utilisateur actif.
 */
router.post('/api/tiktok/auth/disconnect', async (req, res) => {
    try {
        const userId = req.session && req.session.user && req.session.user.id
            ? req.session.user.id
            : 'steve';

        await disconnectTikTokAccount(userId);
        return res.json({
            success: true,
            message: "Compte TikTok déconnecté avec succès."
        });
    } catch (err) {
        console.error("[TIKTOK DISCONNECT ERROR]", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * Rendu HTML élégant pour finaliser la popup OAuth2 ou rediriger l'utilisateur vers le Studio.
 */
function renderCallbackResponse(res, success, message, returnTo = '/traduction.html') {
    const bgColor = success ? '#0f172a' : '#1e1b4b';
    const accentColor = success ? '#10b981' : '#ef4444';
    const icon = success ? '✅' : '❌';
    const title = success ? 'Connexion TikTok Réussie' : 'Échec de la Connexion';

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Aya Studio</title>
    <style>
        body {
            background-color: ${bgColor};
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
        }
        .card {
            background: rgba(30, 41, 59, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 32px;
            border-radius: 20px;
            max-width: 440px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h1 { font-size: 22px; margin: 0 0 12px 0; color: #ffffff; }
        p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
        .btn {
            display: inline-block;
            background: ${accentColor};
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            transition: transform 0.2s, opacity 0.2s;
        }
        .btn:hover { transform: scale(1.02); opacity: 0.9; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${returnTo}" class="btn" id="returnBtn">Retourner à Aya Studio</a>
    </div>
    <script>
        // Si ouvert dans une popup, notifier la fenêtre parente et fermer automatiquement
        try {
            if (window.opener) {
                window.opener.postMessage({
                    type: 'TIKTOK_OAUTH_RESULT',
                    success: ${success},
                    message: ${JSON.stringify(message)}
                }, '*');
                setTimeout(() => { window.close(); }, 1500);
            } else {
                setTimeout(() => { window.location.href = '${returnTo}'; }, 2000);
            }
        } catch (e) {
            console.error(e);
        }
    </script>
</body>
</html>
    `;

    return res.status(success ? 200 : 400).send(html);
}

module.exports = router;
