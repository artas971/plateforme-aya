const nodemailer = require('nodemailer');

/**
 * Service d'Envoi d'E-mails Transactionnels - Aya Studio
 * Gère la distribution via SMTP et propose un mode Fallback Console pour le développement local.
 */

// Configuration du transporteur Nodemailer
function getTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    // Si les identifiants SMTP sont renseignés, on utilise le transporteur réel
    if (host && user && pass) {
        return nodemailer.createTransport({
            host: host,
            port: port,
            secure: port === 465, // true pour le port 465, false pour 587 ou autre
            auth: {
                user: user,
                pass: pass
            }
        });
    }

    // Sinon, mode fallback local (simulation)
    return null;
}

/**
 * Envoie un e-mail de vérification de compte avec le jeton unique
 * @param {Object} params
 * @param {string} params.email - Adresse e-mail du destinataire
 * @param {string} params.username - Pseudonyme de l'utilisateur (ex: @john)
 * @param {string} params.token - Token de vérification généré
 * @param {Object} [params.req] - Requête Express optionnelle pour déduire l'URL de base
 */
async function sendVerificationEmail({ email, username, token, req }) {
    // Détermination de l'URL de base (serveur local ou domaine distant / Cloudflare)
    let baseUrl = process.env.APP_URL;
    if (!baseUrl && req) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
        baseUrl = `${protocol}://${host}`;
    }
    if (!baseUrl) {
        baseUrl = 'http://localhost:3000';
    }

    const verificationUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const fromAddress = process.env.EMAIL_FROM || '"Aya Studio" <noreply@aya-studio.internal>';

    const subject = "✨ Confirmez votre adresse e-mail - Aya Studio";

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
            .header { background: linear-gradient(135deg, #0b5394, #073763); padding: 30px 24px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.85; }
            .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; color: #334155; }
            .badge-user { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 13px; margin-bottom: 12px; }
            .btn-action { display: inline-block; background: linear-gradient(135deg, #00bcd4, #0097a7); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 24px 0; text-align: center; box-shadow: 0 4px 14px rgba(0, 188, 212, 0.4); }
            .footer { padding: 20px 28px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
            .link-alt { word-break: break-all; color: #00bcd4; font-size: 12px; margin-top: 16px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Aya Studio &bull; وكيل الترجمة آية</h1>
                <p>Plateforme de Production & Communication Multilingue</p>
            </div>
            <div class="content">
                <span class="badge-user">Bienvenue ${username || ''} !</span>
                <p>Merci de vous être inscrit sur <b>Aya Studio</b>. Pour activer pleinement votre compte et sécuriser l'accès à nos outils, veuillez confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>
                <div style="text-align: center;">
                    <a href="${verificationUrl}" class="btn-action" target="_blank">✅ Confirmer mon adresse e-mail</a>
                </div>
                <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Ce lien de vérification est valide pendant <b>24 heures</b>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message en toute sécurité.</p>
                <div class="link-alt">
                    <p style="margin: 0 0 4px 0; color: #94a3b8;">Si le bouton ne fonctionne pas, copiez ce lien :</p>
                    <a href="${verificationUrl}" style="color: #0284c7;">${verificationUrl}</a>
                </div>
            </div>
            <div class="footer">
                &copy; 2026 Aya Studio &bull; Pour la Palestine et la diffusion de la vérité
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `Bonjour ${username || ''} !\n\nMerci de vous être inscrit sur Aya Studio.\nPour valider votre compte, veuillez ouvrir le lien suivant dans votre navigateur :\n${verificationUrl}\n\nCe lien est valable 24 heures.\n\nAya Studio Team.`;

    const transporter = getTransporter();

    // Cas 1 : SMTP configuré
    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from: fromAddress,
                to: email,
                subject: subject,
                text: textContent,
                html: htmlContent
            });
            console.log(`[EMAIL SERVICE] ✉️ E-mail de vérification envoyé à ${email} (MessageId: ${info.messageId})`);
            return { success: true, mode: 'smtp', messageId: info.messageId, verificationUrl };
        } catch (err) {
            console.error(`[EMAIL SERVICE ERROR] Échec de l'envoi SMTP à ${email}:`, err.message);
            // En cas d'échec SMTP, on bascule en fallback console pour ne pas bloquer l'inscription
            logFallbackConsole(email, username, verificationUrl);
            return { success: true, mode: 'fallback_error', error: err.message, verificationUrl };
        }
    }

    // Cas 2 : Mode Fallback Console (Dev / Local sans SMTP)
    logFallbackConsole(email, username, verificationUrl);
    return { success: true, mode: 'console_fallback', verificationUrl };
}

function logFallbackConsole(email, username, verificationUrl) {
    console.log('\n======================================================================');
    console.log('📬 [EMAIL FALLBACK CONSOLE] Aucune configuration SMTP détectée.');
    console.log(`👤 Destinataire : ${username} <${email}>`);
    console.log('🔗 LIEN D\'ACTIVATION GÉNÉRÉ (Cliquer ou copier dans le navigateur) :');
    console.log(`👉 ${verificationUrl}`);
    console.log('======================================================================\n');
}

function getBaseUrl(req) {
    let baseUrl = process.env.APP_URL;
    if (!baseUrl && req) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
        baseUrl = `${protocol}://${host}`;
    }
    if (!baseUrl) {
        baseUrl = 'http://localhost:3000';
    }
    return baseUrl.replace(/\/$/, '');
}

/**
 * Envoie un e-mail de réinitialisation de mot de passe (Lien valide 1 heure)
 * Design Sombre & Vert Émeraude
 *
 * @param {Object} params
 * @param {string} params.email - Adresse e-mail du destinataire
 * @param {string} params.username - Pseudonyme de l'utilisateur
 * @param {string} params.token - Jeton de réinitialisation temporaire
 * @param {Object} [params.req] - Requête Express optionnelle
 */
async function sendPasswordResetEmail({ email, username, token, req }) {
    const baseUrl = getBaseUrl(req);
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const fromAddress = process.env.EMAIL_FROM || '"Aya Studio" <noreply@aya-studio.internal>';
    const subject = "🔒 Réinitialisation de votre mot de passe — Aya Studio";

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation du mot de passe</title>
        <style>
            body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; margin: 0; padding: 30px 15px; color: #e2e8f0; }
            .container { max-width: 580px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); padding: 32px 24px; text-align: center; color: #ffffff; border-bottom: 1px solid rgba(16, 185, 129, 0.3); }
            .header-icon { font-size: 36px; margin-bottom: 8px; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
            .header p { margin: 6px 0 0 0; font-size: 13px; color: #6ee7b7; font-weight: 500; }
            .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; color: #cbd5e1; }
            .badge-user { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 13px; margin-bottom: 14px; }
            .alert-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #fcd34d; }
            .btn-action { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 24px 0; text-align: center; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.35); }
            .btn-action:hover { background: linear-gradient(135deg, #059669 0%, #047857 100%); }
            .link-alt { background: #1e293b; padding: 12px; border-radius: 8px; word-break: break-all; color: #38bdf8; font-size: 12px; margin-top: 20px; border: 1px solid #334155; }
            .footer { padding: 20px 28px; background: #0b1120; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-icon">🔒</div>
                <h1>Aya Studio &bull; استوديو آية</h1>
                <p>Récupération Sécurisée de Compte</p>
            </div>
            <div class="content">
                <span class="badge-user">Bonjour ${username || 'Utilisateur'}</span>
                <p>Nous avons reçu une demande de réinitialisation du mot de passe pour votre compte sur <b>Aya Studio</b>.</p>
                <div class="alert-box">
                    ⏳ <b>Attention :</b> Ce lien est temporaire et expirera dans exactement <b>1 heure</b>.
                </div>
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="btn-action" target="_blank">🔑 Créer mon nouveau mot de passe</a>
                </div>
                <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute tranquillité : votre mot de passe actuel reste inchangé et votre compte est parfaitement sécurisé.</p>
                <div class="link-alt">
                    <span style="color: #94a3b8; display: block; margin-bottom: 4px;">Si le bouton ne fonctionne pas, copiez directement cette adresse dans votre navigateur :</span>
                    <a href="${resetUrl}" style="color: #34d399; text-decoration: none;">${resetUrl}</a>
                </div>
            </div>
            <div class="footer">
                &copy; 2026 Aya Studio &bull; Plateforme de sous-titrage IA & de communication solidaire
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `Bonjour ${username || ''} !\n\nVous avez demandé la réinitialisation de votre mot de passe pour votre compte Aya Studio.\n\nVeuillez ouvrir le lien suivant dans votre navigateur pour choisir votre nouveau mot de passe :\n${resetUrl}\n\nCe lien expire dans 1 heure.\nSi vous n'êtes pas à l'origine de cette démarche, veuillez ignorer cet e-mail.\n\nAya Studio Team.`;

    const transporter = getTransporter();

    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from: fromAddress,
                to: email,
                subject: subject,
                text: textContent,
                html: htmlContent
            });
            console.log(`[EMAIL SERVICE] 🔑 E-mail de réinitialisation envoyé à ${email} (MessageId: ${info.messageId})`);
            return { success: true, mode: 'smtp', messageId: info.messageId, resetUrl };
        } catch (err) {
            console.error(`[EMAIL SERVICE ERROR] Échec envoi reset SMTP à ${email}:`, err.message);
            logResetFallbackConsole(email, username, resetUrl);
            return { success: true, mode: 'fallback_error', error: err.message, resetUrl };
        }
    }

    logResetFallbackConsole(email, username, resetUrl);
    return { success: true, mode: 'console_fallback', resetUrl };
}

/**
 * Envoie un e-mail de bienvenue chaleureux lors de la confirmation du compte
 * Design Sombre & Vert Émeraude
 *
 * @param {Object} params
 * @param {string} params.email - Adresse e-mail du destinataire
 * @param {string} params.username - Pseudonyme de l'utilisateur
 * @param {Object} [params.req] - Requête Express optionnelle
 */
async function sendWelcomeEmail({ email, username, req }) {
    const baseUrl = getBaseUrl(req);
    const loginUrl = `${baseUrl}/login`;
    const fromAddress = process.env.EMAIL_FROM || '"Aya Studio" <noreply@aya-studio.internal>';
    const subject = "🎉 Bienvenue dans la communauté Aya Studio ! (5 Crédits offerts)";

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur Aya Studio</title>
        <style>
            body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; margin: 0; padding: 30px 15px; color: #e2e8f0; }
            .container { max-width: 580px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); padding: 34px 24px; text-align: center; color: #ffffff; border-bottom: 1px solid rgba(16, 185, 129, 0.3); }
            .header-icon { font-size: 40px; margin-bottom: 8px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
            .header p { margin: 6px 0 0 0; font-size: 14px; color: #6ee7b7; font-weight: 500; }
            .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; color: #cbd5e1; }
            .badge-welcome { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 13px; margin-bottom: 14px; }
            .feature-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 20px 0; }
            .feature-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
            .feature-item:last-child { margin-bottom: 0; }
            .feature-icon { font-size: 18px; line-height: 1.3; }
            .btn-action { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 24px 0; text-align: center; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.35); }
            .footer { padding: 20px 28px; background: #0b1120; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-icon">🕊️</div>
                <h1>Bienvenue sur Aya Studio !</h1>
                <p>Votre compte est activé avec succès</p>
            </div>
            <div class="content">
                <span class="badge-welcome">Ravi de vous compter parmi nous, ${username || 'Cher Membre'} !</span>
                <p>Votre adresse e-mail a été vérifiée avec succès. Vous avez désormais accès à l'ensemble de notre suite d'outils de transcription et sous-titrage vidéo IA :</p>
                
                <div class="feature-card">
                    <div class="feature-item">
                        <span class="feature-icon">🎁</span>
                        <div><strong>5 Crédits offerts :</strong> Commencez immédiatement à sous-titrer vos premières vidéos en style TikTok Impact.</div>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">⚡</span>
                        <div><strong>Moteur Whisper & IA Levantine :</strong> Transcription de l'arabe parlé palestinien et traduction fidèle vers le français.</div>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">🍉</span>
                        <div><strong>Mur Communautaire :</strong> Partagez vos créations et donnez de la visibilité aux témoignages du terrain.</div>
                    </div>
                </div>

                <div style="text-align: center;">
                    <a href="${loginUrl}" class="btn-action" target="_blank">🚀 Accéder à Aya Studio</a>
                </div>

                <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">Besoin d'aide ou d'échanger avec l'équipe ? Utilisez le widget de feedback intégré ou rejoignez-nous sur notre chaîne solidaire.</p>
            </div>
            <div class="footer">
                &copy; 2026 Aya Studio &bull; Pour la Palestine et la diffusion de la vérité
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `Bienvenue sur Aya Studio, ${username || ''} !\n\nVotre compte est désormais activé avec succès avec 5 crédits offerts.\n\nConnectez-vous pour commencer à transcrire et sous-titrer vos vidéos :\n${loginUrl}\n\nÀ très vite sur Aya Studio !`;

    const transporter = getTransporter();

    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from: fromAddress,
                to: email,
                subject: subject,
                text: textContent,
                html: htmlContent
            });
            console.log(`[EMAIL SERVICE] 🎉 E-mail de bienvenue envoyé à ${email} (MessageId: ${info.messageId})`);
            return { success: true, mode: 'smtp', messageId: info.messageId };
        } catch (err) {
            console.error(`[EMAIL SERVICE ERROR] Échec envoi bienvenue SMTP à ${email}:`, err.message);
            logWelcomeFallbackConsole(email, username, loginUrl);
            return { success: true, mode: 'fallback_error', error: err.message };
        }
    }

    logWelcomeFallbackConsole(email, username, loginUrl);
    return { success: true, mode: 'console_fallback' };
}

function logResetFallbackConsole(email, username, resetUrl) {
    console.log('\n======================================================================');
    console.log('📬 [EMAIL RESET PASSWORD FALLBACK CONSOLE] Aucune configuration SMTP détectée.');
    console.log(`👤 Destinataire : ${username} <${email}>`);
    console.log('🔗 LIEN DE RÉINITIALISATION DU MOT DE PASSE (Valable 1 heure) :');
    console.log(`👉 ${resetUrl}`);
    console.log('======================================================================\n');
}

function logWelcomeFallbackConsole(email, username, loginUrl) {
    console.log('\n======================================================================');
    console.log('📬 [EMAIL WELCOME FALLBACK CONSOLE] Aucune configuration SMTP détectée.');
    console.log(`👤 Nouveau Membre : ${username} <${email}>`);
    console.log('🎉 E-mail de bienvenue simulé (5 crédits de bienvenue offerts).');
    console.log(`👉 Connexion : ${loginUrl}`);
    console.log('======================================================================\n');
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
};
