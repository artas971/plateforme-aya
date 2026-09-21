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

module.exports = {
    sendVerificationEmail
};
