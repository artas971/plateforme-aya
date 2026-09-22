/**
 * Widget de Feedback Testeur Flottant - Plateforme Aya
 * Permet aux testeurs de signaler un bug ou une idée en 1 clic.
 * Règle d'or : Zéro perte du message brut du testeur.
 */

(function () {
    // 1. Injection des styles CSS du widget
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        .aya-feedback-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            background: var(--color-turquoise, #00bcd4);
            color: #FFFFFF;
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 30px;
            padding: 0.7rem 1.25rem;
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(0, 188, 212, 0.35);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: inherit;
        }

        .aya-feedback-btn:hover {
            transform: translateY(-3px) scale(1.03);
            box-shadow: 0 12px 30px rgba(0, 188, 212, 0.5);
            background: #0097a7;
            border-color: #FFFFFF;
        }

        .aya-feedback-overlay {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            background: rgba(11, 83, 148, 0.5);
            backdrop-filter: blur(6px);
            z-index: 100000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            box-sizing: border-box;
            animation: ayaFadeIn 0.2s ease-out;
        }

        .aya-feedback-modal {
            background: var(--color-white, #FFFFFF);
            border: 1px solid var(--color-secondary-gray, #999999);
            border-radius: 16px;
            width: 100%;
            max-width: 520px;
            padding: 1.75rem;
            box-shadow: 0 20px 50px rgba(11, 83, 148, 0.25);
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            color: var(--color-dark-gray, #434343);
            box-sizing: border-box;
            font-family: inherit;
            position: relative;
        }

        .aya-feedback-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .aya-feedback-title {
            font-size: 1.15rem;
            font-weight: 800;
            color: var(--color-primary, #0b5394);
            display: flex;
            align-items: center;
            gap: 0.6rem;
        }

        .aya-feedback-close {
            background: none;
            border: none;
            color: var(--color-secondary-gray, #999999);
            font-size: 1.5rem;
            cursor: pointer;
            transition: color 0.2s;
            line-height: 1;
        }

        .aya-feedback-close:hover {
            color: var(--color-dark-gray, #434343);
        }

        .aya-feedback-agent-badge {
            background: rgba(0, 188, 212, 0.1);
            border: 1px solid rgba(0, 188, 212, 0.35);
            color: var(--color-primary, #0b5394);
            border-radius: 8px;
            padding: 0.5rem 0.75rem;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            line-height: 1.4;
        }

        .aya-form-group {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
        }

        .aya-form-label {
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--color-dark-gray, #434343);
        }

        .aya-feedback-input {
            background: #FFFFFF;
            border: 1px solid var(--color-secondary-gray, #999999);
            color: var(--color-dark-gray, #434343);
            border-radius: 8px;
            padding: 0.65rem 0.85rem;
            font-size: 0.88rem;
            outline: none;
            font-family: inherit;
            box-sizing: border-box;
            width: 100%;
        }

        .aya-feedback-input:focus {
            border-color: var(--color-turquoise, #00bcd4);
        }

        .aya-feedback-textarea {
            background: #FFFFFF;
            border: 1px solid var(--color-secondary-gray, #999999);
            color: var(--color-dark-gray, #434343);
            border-radius: 8px;
            padding: 0.75rem 0.85rem;
            font-size: 0.88rem;
            outline: none;
            font-family: inherit;
            resize: vertical;
            min-height: 120px;
            box-sizing: border-box;
            width: 100%;
            line-height: 1.5;
        }

        .aya-feedback-textarea:focus {
            border-color: var(--color-turquoise, #00bcd4);
        }

        .aya-feedback-submit {
            background: var(--color-turquoise, #00bcd4);
            color: #FFFFFF;
            border: none;
            border-radius: 8px;
            padding: 0.8rem;
            font-size: 0.92rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            transition: all 0.2s;
        }

        .aya-feedback-submit:hover:not(:disabled) {
            background: #0097a7;
        }

        .aya-feedback-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .aya-feedback-success-box {
            display: none;
            background: rgba(0, 188, 212, 0.08);
            border: 1px solid var(--color-turquoise, #00bcd4);
            border-radius: 8px;
            padding: 1rem;
            color: var(--color-dark-gray, #434343);
            font-size: 0.88rem;
            flex-direction: column;
            gap: 0.5rem;
        }

        @keyframes ayaFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(styleEl);

    // 2. Injection du HTML (Bouton flottant & Modale)
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = `
        <button type="button" class="aya-feedback-btn" id="ayaOpenFeedbackBtn" title="Signaler un bug ou suggérer une idée">
            <span>💬</span>
            <span id="ayaFeedbackBtnText">Feedback Testeur</span>
        </button>

        <div class="aya-feedback-overlay" id="ayaFeedbackOverlay">
            <div class="aya-feedback-modal">
                <div class="aya-feedback-header">
                    <div class="aya-feedback-title">
                        <span>🚀</span>
                        <span id="ayaModalTitleText">Signaler un Bug ou une Idée</span>
                    </div>
                    <button type="button" class="aya-feedback-close" id="ayaCloseFeedbackBtn">&times;</button>
                </div>

                <div class="aya-feedback-agent-badge" id="ayaFeedbackAgentBadge">
                    <span>🛡️</span>
                    <span><b>Agent Thomas</b> analysera et qualifiera automatiquement votre retour pour créer une Issue sur GitHub.</span>
                </div>

                <form id="ayaFeedbackForm" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="aya-form-group">
                        <label class="aya-form-label" id="ayaLabelName" for="ayaTesterName">Votre nom ou prénom (optionnel) :</label>
                        <input type="text" id="ayaTesterName" class="aya-feedback-input" placeholder="Ex: Alex, Marie..." />
                    </div>

                    <div class="aya-form-group">
                        <label class="aya-form-label" id="ayaLabelMsg" for="ayaRawMessage">Message brut (Dites-nous tout avec vos propres mots) :</label>
                        <textarea id="ayaRawMessage" class="aya-feedback-textarea" required placeholder="Ex: Sur ma vidéo de 20s, le mot bulldozer a été sauté au début. Ou : Serait-il possible d'avoir un bouton pour copier les sous-titres ?"></textarea>
                    </div>

                    <button type="submit" class="aya-feedback-submit" id="ayaSubmitFeedbackBtn">
                        <span id="ayaSubmitFeedbackBtnText" style="display: flex; align-items: center; gap: 0.5rem;">
                            <span>📤</span>
                            <span>Envoyer le feedback</span>
                        </span>
                    </button>
                </form>

                <div class="aya-feedback-success-box" id="ayaFeedbackSuccessBox">
                    <div style="font-weight: 700; color: #34D399; display: flex; align-items: center; gap: 0.4rem;">
                        <span>✅</span>
                        <span id="ayaSuccessTitle">Retour transmis et analysé !</span>
                    </div>
                    <div id="ayaSuccessDetails" style="font-size: 0.82rem; color: #CBD5E1;"></div>
                    <div style="margin-top: 0.4rem;" id="ayaIssueLinkContainer"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(widgetContainer);

    // 3. Gestionnaires d'événements
    const openBtn = document.getElementById('ayaOpenFeedbackBtn');
    const closeBtn = document.getElementById('ayaCloseFeedbackBtn');
    const overlay = document.getElementById('ayaFeedbackOverlay');
    const form = document.getElementById('ayaFeedbackForm');
    const submitBtn = document.getElementById('ayaSubmitFeedbackBtn');
    const successBox = document.getElementById('ayaFeedbackSuccessBox');
    const successTitle = document.getElementById('ayaSuccessTitle');
    const successDetails = document.getElementById('ayaSuccessDetails');
    const issueLinkContainer = document.getElementById('ayaIssueLinkContainer');
    const rawInput = document.getElementById('ayaRawMessage');
    const nameInput = document.getElementById('ayaTesterName');

    openBtn.addEventListener('click', () => {
        overlay.style.display = 'flex';
        form.style.display = 'flex';
        successBox.style.display = 'none';

        // Auto-détection de l'utilisateur connecté (Anaïs, Aya, Soso, John, etc.)
        try {
            const savedUser = JSON.parse(localStorage.getItem('aya_user') || 'null');
            if (savedUser && (savedUser.name || savedUser.username)) {
                nameInput.value = savedUser.name || savedUser.username;
            }
        } catch (e) {}

        rawInput.focus();
    });

    closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawMessage = rawInput.value.trim();
        if (!rawMessage) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Triage IA & création GitHub...';

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raw_message: rawMessage,
                    tester_name: nameInput.value.trim() || 'Testeur Aya',
                    context: {
                        current_url: window.location.pathname,
                        media_filename: window.currentMediaFilename || (document.getElementById('fileName')?.textContent) || 'N/A',
                        target_lang: (document.querySelector('.lang-card.active')?.dataset?.lang) || 'fr'
                    }
                })
            });

            const data = await res.json();
            if (data.success) {
                form.style.display = 'none';
                successBox.style.display = 'flex';
                successTitle.textContent = data.github_created
                    ? `Issue GitHub #${data.issue_number} créée !`
                    : `Retour enregistré avec succès !`;

                successDetails.innerHTML = `
                    <div><b>Type :</b> \`${data.triage.type}\` | <b>Priorité :</b> \`${data.triage.priority}\`</div>
                    <div><b>Titre qualifié :</b> ${data.triage.title}</div>
                    <div style="margin-top: 0.3rem; color: #94A3B8;">${data.message}</div>
                `;

                if (data.github_created && data.issue_url) {
                    issueLinkContainer.innerHTML = `
                        <a href="${data.issue_url}" target="_blank" style="display: inline-flex; align-items: center; gap: 0.4rem; background: #1E293B; border: 1px solid #38BDF8; color: #38BDF8; padding: 0.45rem 0.85rem; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 0.85rem;">
                            <span>🐙</span> Voir l'Issue sur GitHub &rarr;
                        </a>
                    `;
                } else {
                    issueLinkContainer.innerHTML = '';
                }

                rawInput.value = '';
            } else {
                alert(`Erreur : ${data.error || 'Échec de transmission'}`);
            }
        } catch (err) {
            alert(`Erreur réseau : ${err.message}`);
        } finally {
            submitBtn.disabled = false;
            const curLang = localStorage.getItem('aya_lang') || 'fr';
            submitBtn.innerHTML = (curLang === 'ar')
                ? '<span id="ayaSubmitFeedbackBtnText" style="display:flex;align-items:center;gap:0.5rem;"><span>📤</span><span>إرسال التقرير الآن</span></span>'
                : '<span id="ayaSubmitFeedbackBtnText" style="display:flex;align-items:center;gap:0.5rem;"><span>📤</span><span>Envoyer le feedback</span></span>';
        }
    });

    // 4. Internationalisation bilingue (Nadine) pour le widget
    const fbI18n = {
        fr: {
            btnText: 'Feedback Testeur',
            modalTitle: 'Signaler un Bug ou une Idée',
            agentBadge: '<span>🛡️</span> <span><b>Agent Thomas</b> analysera et qualifiera automatiquement votre retour pour créer une Issue sur GitHub.</span>',
            labelName: 'Votre nom ou prénom (optionnel) :',
            placeholderName: 'Ex: Alex, Marie...',
            labelMsg: 'Message brut (Dites-nous tout avec vos propres mots) :',
            placeholderMsg: 'Ex: Sur ma vidéo de 20s, le mot bulldozer a été sauté au début...',
            btnSubmit: '<span>📤</span> <span>Envoyer le feedback</span>'
        },
        ar: {
            btnText: 'ملاحظات الفاحصين',
            modalTitle: 'الإبلاغ عن خطأ أو اقتراح تحسين',
            agentBadge: '<span>🛡️</span> <span>سيقوم <b>الوكيل توماس</b> بتحليل وتصنيف تقريرك تلقائياً لإنشاء تذكرة في غيت هاب.</span>',
            labelName: 'اسمك أو لقبك (اختياري):',
            placeholderName: 'مثال: أنس، آية، سوسو...',
            labelMsg: 'نص الملاحظة (اكتب ملاحظتك بحرية تامة وبكلماتك الخاصة):',
            placeholderMsg: 'مثال: في الفيديو عند الثانية 12 ظهر خطأ في توقيت النص...',
            btnSubmit: '<span>📤</span> <span>إرسال التقرير الآن</span>'
        }
    };

    function applyFeedbackLanguage(lang) {
        const d = fbI18n[lang] || fbI18n.fr;
        const btnSpan = document.getElementById('ayaFeedbackBtnText');
        if (btnSpan) btnSpan.textContent = d.btnText;
        const titleSpan = document.getElementById('ayaModalTitleText');
        if (titleSpan) titleSpan.textContent = d.modalTitle;
        const badge = document.getElementById('ayaFeedbackAgentBadge');
        if (badge) badge.innerHTML = d.agentBadge;
        const lName = document.getElementById('ayaLabelName');
        if (lName) lName.textContent = d.labelName;
        const pName = document.getElementById('ayaTesterName');
        if (pName) pName.placeholder = d.placeholderName;
        const lMsg = document.getElementById('ayaLabelMsg');
        if (lMsg) lMsg.textContent = d.labelMsg;
        const pMsg = document.getElementById('ayaRawMessage');
        if (pMsg) pMsg.placeholder = d.placeholderMsg;
        const bSub = document.getElementById('ayaSubmitFeedbackBtnText');
        if (bSub) bSub.innerHTML = d.btnSubmit;
    }

    // Initialisation
    const initLang = localStorage.getItem('aya_lang') || 'fr';
    applyFeedbackLanguage(initLang);

    // Écoute de l'événement de bascule linguistique
    window.addEventListener('aya:languageChanged', (e) => {
        applyFeedbackLanguage(e.detail?.lang || 'fr');
    });
})();
