/**
 * Aya Studio - Script Dédié au Studio de Fiches Éducatives Bilingues (/fiches)
 * Gestion du formulaire, prévisualisation gratuite, re-roll sans doublon, quotas et rendu
 */

document.addEventListener('DOMContentLoaded', () => {

    // Toast Notification Utility
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.aya-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `aya-toast toast-${type}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.zIndex = '9999';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '12px';
        toast.style.fontSize = '0.9rem';
        toast.style.fontWeight = '600';
        toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.style.animation = 'fadeIn 0.25s ease';

        if (type === 'success') {
            toast.style.background = '#059669';
            toast.style.color = '#fff';
            toast.innerHTML = `<span>✅</span> <span>${message}</span>`;
        } else if (type === 'warning') {
            toast.style.background = '#d97706';
            toast.style.color = '#fff';
            toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
        } else if (type === 'error') {
            toast.style.background = '#dc2626';
            toast.style.color = '#fff';
            toast.innerHTML = `<span>❌</span> <span>${message}</span>`;
        } else {
            toast.style.background = '#0b5394';
            toast.style.color = '#fff';
            toast.innerHTML = `<span>ℹ️</span> <span>${message}</span>`;
        }

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Éléments DOM Principaux
    const fichesUserCredits = document.getElementById('fichesUserCredits');
    const fichesZeroCreditAlert = document.getElementById('fichesZeroCreditAlert');
    const btnFichesRecharge = document.getElementById('btnFichesRecharge');
    const btnAlertRecharge = document.getElementById('btnAlertRecharge');
    const rechargeModal = document.getElementById('rechargeModal');
    const btnCloseRechargeModal = document.getElementById('btnCloseRechargeModal');

    // Formulaire & Modes
    const fichesGenerateForm = document.getElementById('fichesGenerateForm');
    const btnModeTheme = document.getElementById('btnModeTheme');
    const btnModeCustom = document.getElementById('btnModeCustom');
    const panelModeTheme = document.getElementById('panelModeTheme');
    const panelModeCustom = document.getElementById('panelModeCustom');
    const fichesThemeInput = document.getElementById('fichesThemeInput');
    const themeChipsContainer = document.getElementById('themeChipsContainer');
    const btnClearCustomWords = document.getElementById('btnClearCustomWords');
    const fichesCustomTitleInput = document.getElementById('fichesCustomTitleInput');
    const levelChipsContainer = document.getElementById('levelChipsContainer');
    const levelHelpText = document.getElementById('levelHelpText');
    const levelBadgeRoleHint = document.getElementById('levelBadgeRoleHint');
    const btnSubmitPreview = document.getElementById('btnSubmitPreview');
    const btnSubmitPreviewText = document.getElementById('btnSubmitPreviewText');

    // Écran de Prévisualisation
    const fichesPreviewScreen = document.getElementById('fichesPreviewScreen');
    const previewTitleFr = document.getElementById('previewTitleFr');
    const previewTitleAr = document.getElementById('previewTitleAr');
    const previewCardsContainer = document.getElementById('previewCardsContainer');
    const regenLimitNotice = document.getElementById('regenLimitNotice');
    const btnRollAnother = document.getElementById('btnRollAnother');
    const btnRollText = document.getElementById('btnRollText');
    const regenBadge = document.getElementById('regenBadge');
    const rollSpinner = document.getElementById('rollSpinner');
    const btnBackToForm = document.getElementById('btnBackToForm');
    const btnConfirmGenerate = document.getElementById('btnConfirmGenerate');

    // Écran de Progression
    const fichesProgressScreen = document.getElementById('fichesProgressScreen');
    const fichesProgressStep = document.getElementById('fichesProgressStep');
    const fichesProgressBar = document.getElementById('fichesProgressBar');

    // Écran de Résultat
    const fichesResultScreen = document.getElementById('fichesResultScreen');
    const resultCardImg = document.getElementById('resultCardImg');
    const resultTitleFr = document.getElementById('resultTitleFr');
    const resultTitleAr = document.getElementById('resultTitleAr');
    const resultLevelBadge = document.getElementById('resultLevelBadge');
    const resultCardAudio = document.getElementById('resultCardAudio');
    const btnDownloadJpg = document.getElementById('btnDownloadJpg');
    const btnDownloadMp3 = document.getElementById('btnDownloadMp3');
    const btnCreateAnother = document.getElementById('btnCreateAnother');

    // Galerie
    const galleryLoading = document.getElementById('galleryLoading');
    const galleryEmpty = document.getElementById('galleryEmpty');
    const galleryGrid = document.getElementById('galleryGrid');
    const btnRefreshHistory = document.getElementById('btnRefreshHistory');

    // État Local
    let currentMode = 'theme';
    let selectedDifficultyLevel = 'debutant';
    let currentPreviewData = null;
    let seenWordsList = [];
    let userAvailableCredits = 0;

    // ── 1. Authentification & Solde Utilisateur ──
    async function initUserSession() {
        // Hydratation immédiate depuis le cache local pour éliminer le clignotement '--'
        try {
            const cachedUser = JSON.parse(localStorage.getItem('aya_user') || '{}');
            if (cachedUser && cachedUser.credits !== undefined) {
                userAvailableCredits = Number(cachedUser.credits);
                if (fichesUserCredits) fichesUserCredits.textContent = userAvailableCredits;
                checkCreditsWarning();
            }
        } catch (e) {}

        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            if (!data.authenticated) {
                window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }

            // Récupérer le profil et le solde réel de crédits
            const profileRes = await fetch('/api/user/profile');
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (profileData.user) {
                    const u = profileData.user;
                    userAvailableCredits = Number(u.credits ?? u.wallet?.availableCredits ?? u.wallet?.credits ?? 0);
                    if (fichesUserCredits) fichesUserCredits.textContent = userAvailableCredits;
                    checkCreditsWarning();

                    // Mise à jour du cache local
                    try {
                        const prev = JSON.parse(localStorage.getItem('aya_user') || '{}');
                        localStorage.setItem('aya_user', JSON.stringify({ ...prev, ...u, credits: userAvailableCredits }));
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error('[SESSION ERROR]', e);
        }
    }

    function checkCreditsWarning() {
        if (userAvailableCredits <= 0) {
            if (fichesZeroCreditAlert) fichesZeroCreditAlert.style.display = 'flex';
        } else {
            if (fichesZeroCreditAlert) fichesZeroCreditAlert.style.display = 'none';
        }
    }

    // Gestion du Modal Recharge
    function openRechargeModal() {
        if (rechargeModal) rechargeModal.style.display = 'flex';
    }
    function closeRechargeModal() {
        if (rechargeModal) rechargeModal.style.display = 'none';
    }
    if (btnFichesRecharge) btnFichesRecharge.addEventListener('click', openRechargeModal);
    if (btnAlertRecharge) btnAlertRecharge.addEventListener('click', openRechargeModal);
    if (btnCloseRechargeModal) btnCloseRechargeModal.addEventListener('click', closeRechargeModal);
    if (rechargeModal) {
        rechargeModal.addEventListener('click', (e) => {
            if (e.target === rechargeModal) closeRechargeModal();
        });
    }

    // ── 2. Thèmes Dynamiques depuis l'API ──
    async function loadVocabThemes() {
        if (!themeChipsContainer) return;
        try {
            const res = await fetch('/api/premium/vocab-themes');
            const data = await res.json();
            if (data.success && Array.isArray(data.themes) && data.themes.length > 0) {
                themeChipsContainer.innerHTML = data.themes.map((t, idx) => `
                    <span class="theme-chip ${idx === 0 ? 'active' : ''}" data-theme="${t.titleFr}">
                        ${t.emoji || '✨'} ${t.titleFr}
                    </span>
                `).join('');

                const chips = themeChipsContainer.querySelectorAll('.theme-chip');
                chips.forEach(chip => {
                    chip.addEventListener('click', () => {
                        chips.forEach(c => c.classList.remove('active'));
                        chip.classList.add('active');
                        const theme = chip.getAttribute('data-theme');
                        if (fichesThemeInput) fichesThemeInput.value = theme;
                    });
                });

                if (fichesThemeInput && data.themes[0]) {
                    fichesThemeInput.value = data.themes[0].titleFr;
                }
            }
        } catch (e) {
            console.warn('[THEMES FALLBACK]', e);
        }
    }

    // ── 3. Sélecteur de Mode (Thème vs Manuel) ──
    function updateLevelHelpText() {
        if (!levelHelpText) return;
        if (currentMode === 'theme') {
            levelHelpText.textContent = "Guide le choix des 5 mots par l'IA et définit le badge affiché sur votre affiche.";
            if (levelBadgeRoleHint) levelBadgeRoleHint.textContent = "🏷️ Imprimé sur votre affiche";
        } else {
            let count = 0;
            for (let i = 1; i <= 5; i++) {
                const inp = document.getElementById(`customWordInput${i}`);
                if (inp && inp.value.trim()) count++;
            }
            if (count === 5) {
                levelHelpText.textContent = "Définit le badge sur votre affiche et affine le registre de traduction Shami.";
                if (levelBadgeRoleHint) levelBadgeRoleHint.textContent = "🏷️ Badge Affiche & Registre Shami";
            } else if (count > 0) {
                const missing = 5 - count;
                levelHelpText.textContent = `Calibre les ${missing} mot(s) complémentaires ajoutés par l'IA et le registre de traduction.`;
                if (levelBadgeRoleHint) levelBadgeRoleHint.textContent = `🤖 Complétion de ${missing} mot(s) par l'IA`;
            } else {
                levelHelpText.textContent = "Sert de badge sur votre affiche et calibre le niveau si vous laissez des cases vides.";
                if (levelBadgeRoleHint) levelBadgeRoleHint.textContent = "🏷️ Imprimé sur votre affiche";
            }
        }
    }

    if (btnModeTheme && btnModeCustom) {
        btnModeTheme.addEventListener('click', () => {
            currentMode = 'theme';
            btnModeTheme.classList.add('active');
            btnModeCustom.classList.remove('active');
            if (panelModeTheme) panelModeTheme.style.display = 'block';
            if (panelModeCustom) panelModeCustom.style.display = 'none';
            updateLevelHelpText();
        });

        btnModeCustom.addEventListener('click', () => {
            currentMode = 'custom';
            btnModeCustom.classList.add('active');
            btnModeTheme.classList.remove('active');
            if (panelModeTheme) panelModeTheme.style.display = 'none';
            if (panelModeCustom) panelModeCustom.style.display = 'block';
            const first = document.getElementById('customWordInput1');
            if (first) first.focus();
            updateLevelHelpText();
        });
    }

    for (let i = 1; i <= 5; i++) {
        const inp = document.getElementById(`customWordInput${i}`);
        if (inp) inp.addEventListener('input', updateLevelHelpText);
    }

    if (btnClearCustomWords) {
        btnClearCustomWords.addEventListener('click', () => {
            for (let i = 1; i <= 5; i++) {
                const inp = document.getElementById(`customWordInput${i}`);
                if (inp) inp.value = '';
            }
            if (fichesCustomTitleInput) fichesCustomTitleInput.value = '';
            const first = document.getElementById('customWordInput1');
            if (first) first.focus();
            updateLevelHelpText();
        });
    }

    // Sélecteur de Niveau
    if (levelChipsContainer) {
        const chips = levelChipsContainer.querySelectorAll('.level-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedDifficultyLevel = chip.getAttribute('data-level') || 'debutant';
            });
        });
    }

    // ── 4. Rendu des 5 Mots dans l'Écran d'Arbitrage ──
    function renderPreviewCards(words) {
        if (!previewCardsContainer || !Array.isArray(words)) return;
        previewCardsContainer.innerHTML = words.map(item => `
            <div class="vocab-preview-item-bilingual">
                <div class="preview-comp-fr">
                    <span class="preview-badge-tag preview-badge-fr">FRANÇAIS</span>
                    <div class="preview-word-fr">${item.french}</div>
                    <div class="preview-sub-fr">🗣️ En Shami : ${item.phoneticFr || ''}</div>
                </div>
                <div class="preview-comp-divider">
                    <span>${item.icon || '✨'}</span>
                </div>
                <div class="preview-comp-ar">
                    <span class="preview-badge-tag preview-badge-ar">عَرَبِيٌّ شَامِيٌّ</span>
                    <div class="preview-word-ar">${item.arabic}</div>
                    <div class="preview-sub-ar">نُطْق: ${item.phoneticAr || ''}</div>
                </div>
            </div>
        `).join('');
    }

    // ── 5. Requête de Prévisualisation Gratuite (0 Crédit) ──
    async function requestWordsPreview(isRollAnother = false) {
        let theme = 'Solidarité & Espoir';
        let customWords = null;

        if (currentMode === 'custom') {
            const wordsCollected = [];
            for (let i = 1; i <= 5; i++) {
                const val = (document.getElementById(`customWordInput${i}`)?.value || '').trim();
                if (val) wordsCollected.push(val);
            }

            if (wordsCollected.length === 0) {
                showToast("Veuillez saisir au moins 1 mot ou choisir le mode par thème.", "warning");
                return;
            }

            customWords = wordsCollected;
            const customTitle = (fichesCustomTitleInput?.value || '').trim();
            theme = customTitle || customWords.slice(0, 2).join(' & ') || 'Mots Choisis';
        } else {
            theme = (fichesThemeInput?.value || '').trim() || 'Solidarité & Espoir';
            customWords = null;
        }

        // État de chargement
        if (isRollAnother) {
            if (btnRollAnother) {
                btnRollAnother.disabled = true;
                btnRollAnother.style.opacity = '0.7';
            }
            if (rollSpinner) rollSpinner.style.display = 'inline';
        } else {
            if (btnSubmitPreview) {
                btnSubmitPreview.disabled = true;
                btnSubmitPreview.style.opacity = '0.7';
            }
            if (btnSubmitPreviewText) btnSubmitPreviewText.textContent = "Recherche des mots en cours...";
        }

        try {
            const response = await fetch('/api/premium/vocabulary-words-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    theme,
                    level: selectedDifficultyLevel,
                    customWords,
                    excludeWords: seenWordsList,
                    isRegeneration: isRollAnother
                })
            });

            // Protection stricte contre les réponses HTML (ex: 404, redirection login)
            const contentType = response.headers.get('content-type') || '';
            let data;
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                if (response.status === 401) {
                    showToast("Session expirée. Redirection vers la page de connexion...", "warning");
                    setTimeout(() => window.location.href = '/login?redirect=/fiches', 1200);
                    return;
                }
                throw new Error(`Erreur serveur (${response.status}). Veuillez réessayer.`);
            }

            // Gestion Rate Limiting (HTTP 429)
            if (response.status === 429) {
                showToast(data.error || "Veuillez patienter 3 secondes entre chaque génération.", "warning");
                return;
            }

            // Gestion Quota / Plafond atteint
            if (!response.ok || !data.success) {
                if (data.limitReached || response.status === 400) {
                    if (regenLimitNotice) regenLimitNotice.style.display = 'block';
                    if (regenBadge) regenBadge.textContent = '(0 essai restant)';
                    if (btnRollAnother) {
                        btnRollAnother.disabled = true;
                        btnRollAnother.style.opacity = '0.5';
                        btnRollAnother.style.cursor = 'not-allowed';
                    }
                }
                throw new Error(data.error || "Impossible de prévisualiser les mots.");
            }

            currentPreviewData = data;

            // Enregistrement des mots vus pour exclure les doublons
            data.words.forEach(w => {
                if (w.french && !seenWordsList.includes(w.french)) {
                    seenWordsList.push(w.french);
                }
            });

            // Mise à jour compteur d'essais
            const remaining = data.remainingRegenerations !== undefined ? data.remainingRegenerations : 4;
            if (regenBadge) {
                regenBadge.textContent = `(${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`;
            }

            if (remaining === 0 || data.limitReached) {
                if (regenLimitNotice) regenLimitNotice.style.display = 'block';
                if (btnRollAnother) {
                    btnRollAnother.disabled = true;
                    btnRollAnother.style.opacity = '0.5';
                    btnRollAnother.style.cursor = 'not-allowed';
                }
            } else {
                if (regenLimitNotice) regenLimitNotice.style.display = 'none';
                if (btnRollAnother) {
                    btnRollAnother.disabled = false;
                    btnRollAnother.style.opacity = '1';
                    btnRollAnother.style.cursor = 'pointer';
                }
            }

            // Affichage dans l'écran d'arbitrage
            if (previewTitleFr) previewTitleFr.textContent = data.titleFr || theme.toUpperCase();
            if (previewTitleAr) previewTitleAr.textContent = data.titleAr || '';
            renderPreviewCards(data.words);

            fichesGenerateForm.style.display = 'none';
            if (fichesPreviewScreen) fichesPreviewScreen.style.display = 'block';

        } catch (err) {
            console.error('[PREVIEW ERROR]', err);
            showToast(err.message || "Erreur lors de la prévisualisation des mots.", "error");
        } finally {
            if (btnSubmitPreview) {
                btnSubmitPreview.disabled = false;
                btnSubmitPreview.style.opacity = '1';
            }
            if (btnSubmitPreviewText) btnSubmitPreviewText.textContent = "Prévisualiser les 5 mots (Gratuit)";
            if (rollSpinner) rollSpinner.style.display = 'none';
        }
    }

    if (fichesGenerateForm) {
        fichesGenerateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            requestWordsPreview(false);
        });
    }

    if (btnRollAnother) {
        btnRollAnother.addEventListener('click', () => {
            requestWordsPreview(true);
        });
    }

    if (btnBackToForm) {
        btnBackToForm.addEventListener('click', () => {
            if (fichesPreviewScreen) fichesPreviewScreen.style.display = 'none';
            fichesGenerateForm.style.display = 'block';
        });
    }

    // ── 6. Validation Définitive & Génération Finale (1 Crédit) ──
    if (btnConfirmGenerate) {
        btnConfirmGenerate.addEventListener('click', async () => {
            if (!currentPreviewData) {
                showToast("Aucune sélection de mots à valider.", "warning");
                return;
            }

            if (userAvailableCredits <= 0) {
                showToast("Solde insuffisant (0 Zaytouna). Veuillez recharger votre compte.", "error");
                openRechargeModal();
                return;
            }

            fichesPreviewScreen.style.display = 'none';
            fichesProgressScreen.style.display = 'block';

            // Animation des étapes de progression
            if (fichesProgressBar) fichesProgressBar.style.width = '15%';
            const isAr = window.AyaI18n && window.AyaI18n.currentLang === 'ar';
            if (fichesProgressStep) fichesProgressStep.textContent = isAr ? "🎨 تصميم لوحة الكلمات الأنيقة..." : "🎨 Création artistique de votre affiche illustrée...";
            const stepTimers = [
                setTimeout(() => {
                    if (fichesProgressStep) fichesProgressStep.textContent = isAr ? "🎨 تصميم لوحة الكلمات الأنيقة..." : "🎨 Création artistique de votre affiche illustrée...";
                    if (fichesProgressBar) fichesProgressBar.style.width = '40%';
                }, 1800),
                setTimeout(() => {
                    if (fichesProgressStep) fichesProgressStep.textContent = isAr ? "🎙️ تسجيل النطق الصوتي الواضح والطبيعي..." : "🎙️ Enregistrement de la prononciation audio claire et naturelle...";
                    if (fichesProgressBar) fichesProgressBar.style.width = '70%';
                }, 5500),
                setTimeout(() => {
                    if (fichesProgressStep) fichesProgressStep.textContent = isAr ? "✨ اللمسات النهائية وإعداد بطاقة المراجعة..." : "✨ Touches finales et préparation de votre fiche de révision...";
                    if (fichesProgressBar) fichesProgressBar.style.width = '95%';
                }, 10000)
            ];

            try {
                const response = await fetch('/api/premium/vocabulary-card', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        theme: currentPreviewData.theme,
                        level: currentPreviewData.level || selectedDifficultyLevel,
                        validatedVocabData: currentPreviewData
                    })
                });

                stepTimers.forEach(t => clearTimeout(t));

                const contentType = response.headers.get('content-type') || '';
                let data;
                if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    fichesProgressScreen.style.display = 'none';
                    fichesPreviewScreen.style.display = 'block';
                    throw new Error(`Erreur serveur (${response.status}) lors de la fabrication.`);
                }

                if (response.status === 402 || data.reason === 'INSUFFICIENT_CREDITS') {
                    fichesProgressScreen.style.display = 'none';
                    fichesPreviewScreen.style.display = 'block';
                    showToast(data.error || "Solde insuffisant.", "error");
                    openRechargeModal();
                    return;
                }

                if (!response.ok || !data.success || !data.card) {
                    throw new Error(data.error || "Échec de la génération de la fiche.");
                }

                // Décrémenter le solde local
                if (data.remainingCredits !== undefined) {
                    userAvailableCredits = data.remainingCredits;
                } else {
                    userAvailableCredits = Math.max(0, userAvailableCredits - 1);
                }
                if (fichesUserCredits) fichesUserCredits.textContent = userAvailableCredits;
                checkCreditsWarning();

                // Afficher l'écran de résultat
                fichesProgressScreen.style.display = 'none';
                displayResultCard(data.card);
                showToast("Votre affiche de vocabulaire est prête !", "success");

                // Rafraîchir la galerie
                loadCardsGallery();

            } catch (err) {
                console.error('[GENERATION ERROR]', err);
                stepTimers.forEach(t => clearTimeout(t));
                fichesProgressScreen.style.display = 'none';
                fichesPreviewScreen.style.display = 'block';
                showToast(err.message || "Erreur lors de la génération de la fiche.", "error");
            }
        });
    }

    function displayResultCard(card) {
        if (!fichesResultScreen) return;
        if (resultCardImg) resultCardImg.src = card.imageUrl;
        if (resultTitleFr) resultTitleFr.textContent = card.titleFr || card.theme.toUpperCase();
        if (resultTitleAr) resultTitleAr.textContent = card.titleAr || '';
        if (resultLevelBadge) {
            resultLevelBadge.className = `card-level-badge level-${card.level || 'debutant'}`;
            resultLevelBadge.textContent = (card.level || 'debutant').charAt(0).toUpperCase() + (card.level || 'debutant').slice(1);
        }
        if (resultCardAudio) {
            resultCardAudio.src = card.audioUrl;
            resultCardAudio.load();
        }
        if (btnDownloadJpg) {
            btnDownloadJpg.href = card.imageUrl;
            btnDownloadJpg.download = card.imageFilename || 'fiche_vocabulaire_aya.jpg';
        }
        if (btnDownloadMp3) {
            btnDownloadMp3.href = card.audioUrl;
            btnDownloadMp3.download = card.audioFilename || 'audio_vocabulaire_aya.mp3';
        }

        fichesResultScreen.style.display = 'block';
    }

    if (btnCreateAnother) {
        btnCreateAnother.addEventListener('click', () => {
            fichesResultScreen.style.display = 'none';
            fichesPreviewScreen.style.display = 'none';
            fichesGenerateForm.style.display = 'block';
            currentPreviewData = null;
            seenWordsList = [];
            loadVocabThemes();
        });
    }

    // ── 7. Galerie / Historique des Fiches de l'Utilisateur ──
    async function loadCardsGallery() {
        if (!galleryGrid) return;
        if (galleryLoading) galleryLoading.style.display = 'flex';
        if (galleryEmpty) galleryEmpty.style.display = 'none';
        galleryGrid.style.display = 'none';

        try {
            const res = await fetch('/api/user/cards');
            if (res.status === 401) return;
            const data = await res.json();

            if (galleryLoading) galleryLoading.style.display = 'none';

            if (data.success && Array.isArray(data.cards) && data.cards.length > 0) {
                renderGalleryGrid(data.cards);
                galleryGrid.style.display = 'grid';
            } else {
                if (galleryEmpty) galleryEmpty.style.display = 'flex';
            }
        } catch (e) {
            console.error('[GALLERY ERROR]', e);
            if (galleryLoading) galleryLoading.style.display = 'none';
            if (galleryEmpty) galleryEmpty.style.display = 'flex';
        }
    }

    function renderGalleryGrid(cards) {
        galleryGrid.innerHTML = cards.map(c => `
            <div class="vocab-card-item">
                <div class="vocab-card-thumb-wrap">
                    <img src="${c.imageUrl}" alt="${c.titleFr}" class="vocab-card-thumb" loading="lazy">
                    <span class="card-level-badge level-${c.level || 'debutant'}">${c.level || 'Débutant'}</span>
                </div>
                <div class="vocab-card-info">
                    <h4 class="vocab-card-title">${c.titleFr}</h4>
                    <p class="vocab-card-theme" style="font-family: var(--font-arabic, 'Cairo'); color: #00bcd4;">${c.titleAr || ''}</p>
                    <div style="margin-top: 8px;">
                        <audio controls style="width: 100%; height: 32px;" src="${c.audioUrl}"></audio>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <a href="${c.imageUrl}" download="${c.imageFilename || 'fiche.jpg'}" class="btn-action-sm primary" style="flex: 1; text-align: center; text-decoration: none; padding: 6px 10px; font-size: 0.8rem;">
                            💾 Image
                        </a>
                        <a href="${c.audioUrl}" download="${c.audioFilename || 'audio.mp3'}" class="btn-action-sm secondary" style="flex: 1; text-align: center; text-decoration: none; padding: 6px 10px; font-size: 0.8rem;">
                            🎵 Audio
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    if (btnRefreshHistory) {
        btnRefreshHistory.addEventListener('click', loadCardsGallery);
    }

    // Initialisation au chargement
    initUserSession();
    loadVocabThemes();
    loadCardsGallery();
});
