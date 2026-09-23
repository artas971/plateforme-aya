/**
 * ServiceRatingWidget - Module de Notation 1 à 5 Étoiles (Aya Studio)
 * 
 * Normes :
 * - Cibles cliquables 44x44px (WCAG AAA)
 * - Charte Aya (#0b5394, #00bcd4, #f59e0b)
 * - Support Bilingue LTR / RTL (FR / AR)
 */

(function() {
    'use strict';

    const translations = {
        fr: {
            title: "⭐ Évaluez la qualité de ce traitement",
            subtitle: "Votre avis aide notre équipe d'IA à perfectionner les traductions.",
            commentPlaceholder: "Un détail à signaler ou une remarque pour l'équipe ? (Facultatif)...",
            btnSubmit: "Envoyer mon évaluation",
            submitting: "Enregistrement en cours...",
            thankYou: "❤️ Merci pour votre retour ! Votre avis a bien été transmis.",
            errorMsg: "❌ Une erreur s'est produite lors de l'envoi de votre note."
        },
        ar: {
            title: "⭐ قِيّم جودة هذا العرض",
            subtitle: "رأيك يساعد فريق الذكاء الاصطناعي في تحسين جودة الترجمة والدبلجة.",
            commentPlaceholder: "هل لديك ملاحظة أو تفاصيل تود مشاركتها؟ (اختياري)...",
            btnSubmit: "إرسال التقييم",
            submitting: "جاري الإرسال...",
            thankYou: "❤️ شكراً لجرد ملاحظتك! تم تسجيل تقييمك بنجاح.",
            errorMsg: "❌ حدث خطأ أثناء إرسال التقييم."
        }
    };

    function injectStyles() {
        if (document.getElementById('aya-rating-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'aya-rating-widget-styles';
        style.innerHTML = `
            .aya-rating-card {
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%);
                border: 1.5px solid rgba(0, 188, 212, 0.35);
                border-radius: 16px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
                color: #f8fafc;
                font-family: inherit;
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease;
            }
            .aya-rating-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; height: 3px;
                background: linear-gradient(90deg, #0b5394 0%, #00bcd4 100%);
            }
            .aya-rating-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            .aya-rating-title {
                font-size: 1.1rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .aya-rating-sub {
                font-size: 0.88rem;
                color: #94a3b8;
                margin-bottom: 16px;
            }
            .aya-rating-stars {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                margin: 14px 0;
                direction: ltr; /* Étoiles de gauche à droite toujours */
            }
            .aya-star-btn {
                background: transparent;
                border: none;
                font-size: 2.2rem;
                cursor: pointer;
                min-width: 44px;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #475569;
                transition: transform 0.15s ease, color 0.15s ease;
                padding: 0;
                line-height: 1;
                border-radius: 8px;
            }
            .aya-star-btn:hover,
            .aya-star-btn.active,
            .aya-star-btn.hover {
                color: #f59e0b;
                transform: scale(1.18);
                text-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
            }
            .aya-rating-comment-box {
                margin-top: 14px;
                display: none;
                animation: ayaFadeIn 0.3s ease forwards;
            }
            @keyframes ayaFadeIn {
                from { opacity: 0; transform: translateY(-6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .aya-rating-textarea {
                width: 100%;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(0, 188, 212, 0.3);
                border-radius: 10px;
                color: #ffffff;
                padding: 10px 14px;
                font-size: 0.9rem;
                resize: vertical;
                min-height: 70px;
                box-sizing: border-box;
                font-family: inherit;
            }
            .aya-rating-textarea:focus {
                outline: none;
                border-color: #00bcd4;
                box-shadow: 0 0 0 3px rgba(0, 188, 212, 0.2);
            }
            .aya-rating-actions {
                margin-top: 12px;
                display: flex;
                justify-content: flex-end;
            }
            .aya-rating-submit-btn {
                background: linear-gradient(135deg, #0b5394 0%, #00bcd4 100%);
                color: #ffffff;
                border: none;
                border-radius: 10px;
                padding: 10px 20px;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: opacity 0.2s ease, transform 0.15s ease;
            }
            .aya-rating-submit-btn:hover {
                opacity: 0.95;
                transform: translateY(-1px);
            }
            .aya-rating-submit-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .aya-rating-thanks {
                background: rgba(16, 185, 129, 0.15);
                border: 1px solid rgba(16, 185, 129, 0.35);
                border-radius: 12px;
                padding: 16px;
                text-align: center;
                color: #34d399;
                font-weight: 600;
                font-size: 0.95rem;
            }
        `;
        document.head.appendChild(style);
    }

    function createRatingWidget(options = {}) {
        injectStyles();

        const lang = options.lang || (localStorage.getItem('aya_lang') === 'ar' ? 'ar' : 'fr');
        const dict = translations[lang] || translations.fr;
        const rtl = lang === 'ar';

        const serviceType = options.serviceType || 'traduction';
        const jobId = options.jobId || null;
        const mediaFilename = options.mediaFilename || null;

        const card = document.createElement('div');
        card.className = 'aya-rating-card';
        if (rtl) card.setAttribute('dir', 'rtl');

        card.innerHTML = `
            <div class="aya-rating-header">
                <h4 class="aya-rating-title">${dict.title}</h4>
            </div>
            <p class="aya-rating-sub">${dict.subtitle}</p>

            <div class="aya-rating-stars" role="radiogroup" aria-label="${dict.title}">
                <button type="button" class="aya-star-btn" data-star="1" aria-label="1 étoile">★</button>
                <button type="button" class="aya-star-btn" data-star="2" aria-label="2 étoiles">★</button>
                <button type="button" class="aya-star-btn" data-star="3" aria-label="3 étoiles">★</button>
                <button type="button" class="aya-star-btn" data-star="4" aria-label="4 étoiles">★</button>
                <button type="button" class="aya-star-btn" data-star="5" aria-label="5 étoiles">★</button>
            </div>

            <div class="aya-rating-comment-box" id="ayaRatingCommentBox">
                <textarea class="aya-rating-textarea" id="ayaRatingComment" placeholder="${dict.commentPlaceholder}"></textarea>
                <div class="aya-rating-actions">
                    <button type="button" class="aya-rating-submit-btn" id="ayaRatingSubmitBtn">
                        <span>✨</span> <span>${dict.btnSubmit}</span>
                    </button>
                </div>
            </div>
        `;

        let selectedRating = 0;
        const starBtns = card.querySelectorAll('.aya-star-btn');
        const commentBox = card.querySelector('#ayaRatingCommentBox');
        const submitBtn = card.querySelector('#ayaRatingSubmitBtn');
        const commentTextarea = card.querySelector('#ayaRatingComment');

        starBtns.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                const val = parseInt(btn.dataset.star, 10);
                starBtns.forEach(b => {
                    const bVal = parseInt(b.dataset.star, 10);
                    if (bVal <= val) b.classList.add('hover');
                    else b.classList.remove('hover');
                });
            });

            btn.addEventListener('mouseleave', () => {
                starBtns.forEach(b => b.classList.remove('hover'));
            });

            btn.addEventListener('click', () => {
                selectedRating = parseInt(btn.dataset.star, 10);
                starBtns.forEach(b => {
                    const bVal = parseInt(b.dataset.star, 10);
                    if (bVal <= selectedRating) b.classList.add('active');
                    else b.classList.remove('active');
                });
                commentBox.style.display = 'block';
                commentTextarea.focus();
            });
        });

        submitBtn.addEventListener('click', async () => {
            if (selectedRating === 0) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳</span> <span>${dict.submitting}</span>`;

            try {
                const res = await fetch('/api/feedback/rate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rating: selectedRating,
                        comment: commentTextarea.value || '',
                        serviceType,
                        jobId,
                        mediaFilename
                    })
                });

                const data = await res.json();
                if (data.success) {
                    card.innerHTML = `
                        <div class="aya-rating-thanks">
                            ${dict.thankYou}
                        </div>
                    `;
                    if (typeof options.onSuccess === 'function') {
                        options.onSuccess(data);
                    }
                } else {
                    alert(data.error || dict.errorMsg);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span>✨</span> <span>${dict.btnSubmit}</span>`;
                }
            } catch (err) {
                console.error('[RATING WIDGET ERROR]', err);
                alert(dict.errorMsg);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>✨</span> <span>${dict.btnSubmit}</span>`;
            }
        });

        if (options.targetContainer) {
            const container = typeof options.targetContainer === 'string'
                ? document.getElementById(options.targetContainer)
                : options.targetContainer;
            if (container) {
                container.appendChild(card);
            }
        }

        return card;
    }

    window.AyaRatingWidget = {
        show: createRatingWidget
    };
})();
