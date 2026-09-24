/**
 * Logique Frontend - Espace Profil & Portefeuille Solidaire (Phase 5)
 * Auteur : Max (Backend Lead) & Lionel (UX/UI Designer)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM Profil
    const profileAvatarImg = document.getElementById('profileAvatarImg');
    const avatarUploadBtn = document.getElementById('avatarUploadBtn');
    const avatarFileInput = document.getElementById('avatarFileInput');
    const avatarSpinner = document.getElementById('avatarSpinner');
    const profileRoleBadge = document.getElementById('profileRoleBadge');
    const profileUsername = document.getElementById('profileUsername');
    const btnCopyUsername = document.getElementById('btnCopyUsername');
    const profileNameInput = document.getElementById('profileNameInput');
    const btnSaveName = document.getElementById('btnSaveName');
    const profileEmail = document.getElementById('profileEmail');

    // Éléments du DOM Wallet
    const walletAvailableCredits = document.getElementById('walletAvailableCredits');
    const walletReservedCredits = document.getElementById('walletReservedCredits');
    const btnRechargeWallet = document.getElementById('btnRechargeWallet');
    const rechargeModal = document.getElementById('rechargeModal');
    const btnCloseRechargeModal = document.getElementById('btnCloseRechargeModal');
    const btnAcknowledgeRecharge = document.getElementById('btnAcknowledgeRecharge');

    // Pré-hydratation immédiate du solde depuis le cache local (Zéro-Flicker)
    try {
        const cachedUser = JSON.parse(localStorage.getItem('aya_user') || '{}');
        if (cachedUser) {
            if (cachedUser.credits !== undefined && walletAvailableCredits) {
                walletAvailableCredits.textContent = cachedUser.credits;
            }
            if (cachedUser.creditsReserved !== undefined && walletReservedCredits) {
                walletReservedCredits.textContent = cachedUser.creditsReserved;
            }
        }
    } catch (e) {}

    // Éléments du DOM Historique Vidéos
    const historyCountBadge = document.getElementById('historyCountBadge');
    const btnRefreshHistory = document.getElementById('btnRefreshHistory');
    const videoHistoryLoading = document.getElementById('videoHistoryLoading');
    const videoHistoryEmpty = document.getElementById('videoHistoryEmpty');
    const videoHistoryGrid = document.getElementById('videoHistoryGrid');

    // Éléments du Modal Vidéo
    const videoPreviewModal = document.getElementById('videoPreviewModal');
    const modalVideoPlayer = document.getElementById('modalVideoPlayer');
    const modalVideoTitle = document.getElementById('modalVideoTitle');
    const btnCloseVideoModal = document.getElementById('btnCloseVideoModal');

    /**
     * Affiche un toast flottant élégant avec color-coding (success, error, warning, info)
     */
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.aya-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `aya-toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `<span style="font-size: 1.2rem; flex-shrink: 0;">${icon}</span><span>${message}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(15px)';
            setTimeout(() => toast.remove(), 350);
        }, 3500);
    }

    /**
     * Formate la durée en mm:ss
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function isRtl() {
        return (document.documentElement.getAttribute('dir') === 'rtl' || localStorage.getItem('aya_lang') === 'ar');
    }

    /**
     * Formate une date ISO en affichage lisible
     */
    function formatDate(isoStr) {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            const locale = isRtl() ? 'ar-EG' : 'fr-FR';
            return d.toLocaleDateString(locale, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return isoStr;
        }
    }

    /**
     * 1. Charge le profil et le portefeuille utilisateur
     */
    async function loadUserProfile() {
        try {
            const res = await fetch('/api/user/profile');
            const data = await res.json();

            if (data.success && data.user) {
                const user = data.user;

                // Identité
                if (profileAvatarImg && user.avatar) {
                    profileAvatarImg.src = user.avatar;
                }
                if (profileUsername) {
                    profileUsername.textContent = user.username || '@utilisateur';
                }
                if (profileNameInput) {
                    profileNameInput.value = user.name || user.username || '';
                }
                if (profileEmail) {
                    profileEmail.textContent = user.email || 'Non renseigné';
                }
                if (profileRoleBadge) {
                    profileRoleBadge.textContent = user.role || 'Contributeur';
                }

                // Portefeuille
                const credits = Number(user.credits ?? user.wallet?.availableCredits ?? user.wallet?.credits ?? 0);
                if (walletAvailableCredits) {
                    walletAvailableCredits.textContent = credits;
                }
                if (walletReservedCredits) {
                    walletReservedCredits.textContent = user.creditsReserved !== undefined ? user.creditsReserved : 0;
                }
                if (vocabModalUserCredits) {
                    vocabModalUserCredits.textContent = credits;
                }
                if (vocabZeroCreditAlert && credits > 0) {
                    vocabZeroCreditAlert.style.display = 'none';
                }

                // Afficher le lien vers la tour de contrôle si l'utilisateur est administrateur
                const adminContainer = document.getElementById('adminTourBtnContainer');
                if (adminContainer && (user.email === 'artas971@gmail.com' || user.role === 'admin')) {
                    adminContainer.style.display = 'inline-block';
                }

                // Synchronisation locale pour aya-i18n.js et autres pages
                localStorage.setItem('aya_user', JSON.stringify({ ...user, credits }));

                // Mise à jour de la navbar globale si déjà montée
                const navAvatar = document.getElementById('navbarAvatarImg');
                const navName = document.getElementById('navbarUserName');
                if (navAvatar && user.avatar) navAvatar.src = user.avatar;
                if (navName) navName.textContent = user.name || user.username;
            } else {
                if (data.requireAuth) {
                    window.location.href = '/login';
                }
            }
        } catch (err) {
            console.error('[PROFIL ERROR] Échec chargement profil :', err);
        }
    }

    /**
     * 2. Changement d'avatar avec prévisualisation locale FileReader et compression WebP (PERF-1)
     */
    if (avatarUploadBtn && avatarFileInput) {
        avatarUploadBtn.addEventListener('click', () => {
            avatarFileInput.click();
        });

        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Contrôle taille (2 Mo max)
            if (file.size > 2 * 1024 * 1024) {
                showToast("L'image sélectionnée dépasse la limite autorisée de 2 Mo.", "error");
                avatarFileInput.value = '';
                return;
            }

            // Contrôle format
            if (!file.type.startsWith('image/')) {
                showToast("Format invalide. Seuls les formats PNG, JPG et WebP sont autorisés.", "error");
                avatarFileInput.value = '';
                return;
            }

            // A. Prévisualisation locale immédiate Zéro-Délai (FileReader)
            const reader = new FileReader();
            reader.onload = (event) => {
                profileAvatarImg.src = event.target.result;
            };
            reader.readAsDataURL(file);

            // B. Envoi au serveur pour normalisation WebP 256x256
            avatarSpinner.classList.add('active');
            const formData = new FormData();
            formData.append('avatar', file);

            try {
                const res = await fetch('/api/user/avatar', {
                    method: 'POST',
                    body: formData
                });
                const result = await res.json();

                if (result.success && result.avatar) {
                    profileAvatarImg.src = result.avatar;
                    
                    // Mise à jour navbar
                    const navAvatar = document.getElementById('navbarAvatarImg');
                    if (navAvatar) navAvatar.src = result.avatar;

                    // Mise à jour localStorage
                    try {
                        const local = JSON.parse(localStorage.getItem('aya_user') || '{}');
                        local.avatar = result.avatar;
                        localStorage.setItem('aya_user', JSON.stringify(local));
                    } catch (e) {}

                    showToast("Photo de profil mise à jour et normalisée en WebP 256x256 !", "success");
                } else {
                    showToast(result.error || "Échec du traitement de l'image.", "error");
                }
            } catch (err) {
                console.error('[AVATAR UPLOAD ERROR]', err);
                showToast("Erreur réseau lors du téléversement de l'avatar.", "error");
            } finally {
                avatarSpinner.classList.remove('active');
                avatarFileInput.value = '';
            }
        });
    }

    /**
     * 3. Modification du nom d'affichage (PUT /api/user/profile)
     */
    if (btnSaveName && profileNameInput) {
        btnSaveName.addEventListener('click', async () => {
            const newName = profileNameInput.value.trim();
            if (!newName) {
                showToast("Le nom d'affichage ne peut pas être vide.", "warning");
                return;
            }

            btnSaveName.disabled = true;
            btnSaveName.innerHTML = '<span>⏳</span> Envoi...';

            try {
                const res = await fetch('/api/user/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });
                const result = await res.json();

                if (result.success) {
                    showToast("Nom d'affichage mis à jour avec succès !", "success");
                    
                    // Mise à jour navbar
                    const navName = document.getElementById('navbarUserName');
                    if (navName) navName.textContent = newName;

                    // Mise à jour localStorage
                    try {
                        const local = JSON.parse(localStorage.getItem('aya_user') || '{}');
                        local.name = newName;
                        localStorage.setItem('aya_user', JSON.stringify(local));
                    } catch (e) {}
                } else {
                    showToast(result.error || "Impossible de mettre à jour le profil.", "error");
                }
            } catch (err) {
                showToast("Erreur de connexion au serveur.", "error");
            } finally {
                btnSaveName.disabled = false;
                btnSaveName.innerHTML = '<span>💾</span> Enregistrer';
            }
        });
    }

    /**
     * 4. Copie du pseudonyme
     */
    if (btnCopyUsername && profileUsername) {
        btnCopyUsername.addEventListener('click', () => {
            const text = profileUsername.textContent.trim();
            navigator.clipboard.writeText(text).then(() => {
                showToast(`Pseudonyme ${text} copié !`, 'info');
            });
        });
    }

    /**
     * 5. Modal Recharger mon solde (Stripe & Dons Solidaires)
     */
    function openRechargeModal() {
        if (!rechargeModal) return;
        rechargeModal.style.display = 'flex';

        // Synchroniser le lien PayPal et la configuration depuis le backend
        fetch('/api/payment/packs')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.paypalUrl) {
                    const btnPaypal = document.getElementById('btnPaypalDonation');
                    if (btnPaypal) btnPaypal.href = data.paypalUrl;
                }
            })
            .catch(() => {});
    }

    if (btnRechargeWallet) {
        btnRechargeWallet.addEventListener('click', openRechargeModal);
    }
    if (btnCloseRechargeModal) {
        btnCloseRechargeModal.addEventListener('click', () => {
            rechargeModal.style.display = 'none';
        });
    }
    if (rechargeModal) {
        rechargeModal.addEventListener('click', (e) => {
            if (e.target === rechargeModal) rechargeModal.style.display = 'none';
        });
    }

    // Gestion du clic d'achat sur un pack de crédits (Stripe Checkout)
    const stripeBuyButtons = document.querySelectorAll('.btn-stripe-buy');
    stripeBuyButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const packId = btn.getAttribute('data-pack');
            if (!packId) return;

            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span>⏳</span> Redirection...';

            try {
                const res = await fetch('/api/payment/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ packId })
                });

                const data = await res.json();

                if (data.success && data.url) {
                    // Redirection fluide vers Stripe Checkout
                    window.location.href = data.url;
                } else {
                    showToast(data.error || "Impossible d'initialiser le paiement Stripe.", "error");
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            } catch (err) {
                showToast("Erreur de connexion au serveur.", "error");
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });
    });

    /**
     * 6. Charge l'historique personnel des vidéos
     */
    async function loadVideoHistory() {
        if (!videoHistoryGrid) return;

        videoHistoryLoading.style.display = 'block';
        videoHistoryEmpty.style.display = 'none';
        videoHistoryGrid.style.display = 'none';
        videoHistoryGrid.innerHTML = '';

        try {
            const res = await fetch('/api/user/videos?page=1&limit=50');
            const data = await res.json();

            videoHistoryLoading.style.display = 'none';

            if (data.success && Array.isArray(data.videos) && data.videos.length > 0) {
                const rtl = isRtl();
                if (historyCountBadge) {
                    const total = data.total || data.videos.length;
                    historyCountBadge.textContent = rtl ? `${total} فيديو` : `${total} vidéo${total > 1 ? 's' : ''}`;
                }

                data.videos.forEach(video => {
                    const card = createVideoCard(video);
                    videoHistoryGrid.appendChild(card);
                });

                videoHistoryGrid.style.display = 'grid';
            } else {
                if (historyCountBadge) historyCountBadge.textContent = isRtl() ? '٠ فيديو' : '0 vidéo';
                videoHistoryEmpty.style.display = 'flex';
            }
        } catch (err) {
            console.error('[HISTORY ERROR]', err);
            videoHistoryLoading.style.display = 'none';
            videoHistoryEmpty.style.display = 'flex';
        }
    }

    /**
     * Crée le composant visuel d'une carte vidéo dans l'historique
     */
    function createVideoCard(v) {
        const card = document.createElement('div');
        card.className = 'video-card';

        const rtl = isRtl();
        const defaultTitle = rtl ? 'فيديو مترجم' : 'Génération Vidéo';
        const title = v.title || v.originalMediaName || defaultTitle;
        const dateStr = formatDate(v.createdAt);
        const durationStr = formatDuration(v.duration);
        const langTag = v.targetLang === 'ar' 
            ? (rtl ? 'ترجمة عربية (VOAR)' : 'VOAR (Arabe)') 
            : (rtl ? 'ترجمة فرنسية (VOSTFR)' : 'VOSTFR (Français)');
        const costTag = rtl ? '-١ رصيد' : '-1 Crédit';
        const sizeUnit = rtl ? 'ميغابايت' : 'Mo';
        const playLabel = rtl ? 'تشغيل' : 'Lire';
        const assLabel = rtl ? 'الترجمة (.ASS)' : '.ASS';
        const deleteLabel = rtl ? 'حذف' : 'Supprimer';

        // Vignette
        const thumbUrl = v.coverUrl || '';
        const thumbHtml = thumbUrl
            ? `<img src="${thumbUrl}" alt="${title}" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'video-thumb-placeholder\\'>🎬</span>'">`
            : `<span class="video-thumb-placeholder">🎬</span>`;

        card.innerHTML = `
            <div class="video-card-thumb">
                ${thumbHtml}
                <span class="video-card-badge-cost">${costTag}</span>
                ${v.duration ? `<span class="video-card-duration">⏱️ ${durationStr}</span>` : ''}
            </div>
            <div class="video-card-body">
                <h4 class="video-card-title" title="${title}">${title}</h4>
                <div class="video-meta-row">
                    <span>📅 ${dateStr}</span>
                    <span>•</span>
                    <span style="color: var(--color-primary); font-weight: 600;">${langTag}</span>
                    ${v.fileSizeMb ? `<span>• ${v.fileSizeMb} ${sizeUnit}</span>` : ''}
                </div>
            </div>
            <div class="video-card-footer">
                <div class="video-actions-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        ${v.mp4Url ? `
                            <button type="button" class="btn-action-sm primary btn-play-video" data-url="${v.mp4Url}" data-title="${title}">
                                <span>▶️</span> ${playLabel}
                            </button>
                            <a href="${v.mp4Url}" download class="btn-action-sm" title="${rtl ? 'تحميل ملف الفيديو النهائي' : 'Télécharger le fichier MP4 final'}">
                                <span>⬇️</span> MP4
                            </a>
                        ` : ''}
                        ${v.assUrl ? `
                            <a href="${v.assUrl}" download class="btn-action-sm" title="${rtl ? 'تحميل ملف الترجمة' : 'Télécharger les sous-titres .ASS'}">
                                <span>📝</span> ${assLabel}
                            </a>
                        ` : ''}
                    </div>
                    <button type="button" class="btn-action-sm btn-delete-video" data-id="${v.id || v._id}" title="${rtl ? 'حذف هذا الفيديو من سجلك' : 'Supprimer cette vidéo de votre historique'}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); margin-left: auto;">
                        <span>🗑️</span> ${deleteLabel}
                    </button>
                </div>
            </div>
        `;

        // Événement lecture
        const playBtn = card.querySelector('.btn-play-video');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const url = playBtn.getAttribute('data-url');
                const t = playBtn.getAttribute('data-title');
                openVideoModal(url, t);
            });
        }

        // Événement suppression vidéo
        const deleteBtn = card.querySelector('.btn-delete-video');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const videoId = deleteBtn.getAttribute('data-id');
                if (!videoId) return;

                const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
                const confirmMsg = isRtl 
                    ? "هل أنت متأكد من رغبتك في حذف هذا الفيديو نهائياً من سجلك؟"
                    : "Êtes-vous sûr de vouloir supprimer définitivement cette vidéo de votre historique ?";

                if (!confirm(confirmMsg)) return;

                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<span>⏳</span> ...';

                try {
                    const res = await fetch(`/api/user/videos/${encodeURIComponent(videoId)}`, {
                        method: 'DELETE'
                    });
                    const result = await res.json();

                    if (result.success) {
                        showToast(isRtl ? "تم حذف الفيديو بنجاح." : "Vidéo supprimée de votre historique avec succès.", "success");
                        // Animation de retrait fluide
                        card.style.transition = 'all 0.3s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.92)';
                        setTimeout(() => {
                            card.remove();
                            // Mettre à jour le compteur
                            const remaining = videoHistoryGrid.querySelectorAll('.video-card').length;
                            if (historyCountBadge) {
                                historyCountBadge.textContent = `${remaining} vidéo${remaining > 1 ? 's' : ''}`;
                            }
                            if (remaining === 0) {
                                videoHistoryEmpty.style.display = 'flex';
                                videoHistoryGrid.style.display = 'none';
                            }
                        }, 300);
                    } else {
                        showToast(result.error || "Impossible de supprimer la vidéo.", "error");
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = '<span>🗑️</span> Supprimer';
                    }
                } catch (err) {
                    console.error('[DELETE VIDEO ERROR]', err);
                    showToast("Erreur de connexion lors de la suppression.", "error");
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<span>🗑️</span> Supprimer';
                }
            });
        }

        return card;
    }

    /**
     * 7. Modal Lecteur Vidéo
     */
    function openVideoModal(videoUrl, title) {
        if (!videoPreviewModal || !modalVideoPlayer) return;
        modalVideoTitle.textContent = title || (isRtl() ? 'مشاهدة الفيديو' : 'Aperçu Vidéo');
        modalVideoPlayer.src = videoUrl;
        videoPreviewModal.style.display = 'flex';
        modalVideoPlayer.play().catch(() => {});
    }

    function closeVideoModal() {
        if (!videoPreviewModal || !modalVideoPlayer) return;
        modalVideoPlayer.pause();
        modalVideoPlayer.src = '';
        videoPreviewModal.style.display = 'none';
    }

    if (btnCloseVideoModal) {
        btnCloseVideoModal.addEventListener('click', closeVideoModal);
    }
    if (videoPreviewModal) {
        videoPreviewModal.addEventListener('click', (e) => {
            if (e.target === videoPreviewModal) closeVideoModal();
        });
    }

    // =========================================================================
    // SPRINT EXPRESS JOUR 3 : FICHES VOCABULAIRE & AUDIO 9:16 (FRONTEND)
    // =========================================================================

    // Éléments du DOM Onglets
    const tabBtnVideos = document.getElementById('tabBtnVideos');
    const tabBtnCards = document.getElementById('tabBtnCards');
    const tabContentVideos = document.getElementById('tabContentVideos');
    const tabContentCards = document.getElementById('tabContentCards');
    const cardsCountBadge = document.getElementById('cardsCountBadge');

    // Éléments Galerie Fiches
    const btnRefreshCards = document.getElementById('btnRefreshCards');
    const btnOpenVocabModal = document.getElementById('btnOpenVocabModal');
    const btnEmptyCreateCard = document.getElementById('btnEmptyCreateCard');
    const cardsHistoryLoading = document.getElementById('cardsHistoryLoading');
    const cardsHistoryEmpty = document.getElementById('cardsHistoryEmpty');
    const cardsHistoryGrid = document.getElementById('cardsHistoryGrid');

    // Éléments Modal Création
    const vocabCreateModal = document.getElementById('vocabCreateModal');
    const btnCloseVocabCreateModal = document.getElementById('btnCloseVocabCreateModal');
    const btnCancelVocabCreate = document.getElementById('btnCancelVocabCreate');
    const vocabModalUserCredits = document.getElementById('vocabModalUserCredits');
    const vocabZeroCreditAlert = document.getElementById('vocabZeroCreditAlert');
    const btnVocabRechargeFast = document.getElementById('btnVocabRechargeFast');
    const btnVocabRechargeAlert = document.getElementById('btnVocabRechargeAlert');
    const vocabGenerateForm = document.getElementById('vocabGenerateForm');
    const vocabThemeInput = document.getElementById('vocabThemeInput');
    const vocabCustomWordsInput = document.getElementById('vocabCustomWordsInput');
    const btnSubmitVocabGenerate = document.getElementById('btnSubmitVocabGenerate');
    const btnSubmitVocabText = document.getElementById('btnSubmitVocabText');

    // Écran de Prévisualisation & Arbitrage (Étape 2 Gratuite)
    const vocabPreviewScreen = document.getElementById('vocabPreviewScreen');
    const vocabPreviewTitleFr = document.getElementById('vocabPreviewTitleFr');
    const vocabPreviewTitleAr = document.getElementById('vocabPreviewTitleAr');
    const vocabPreviewWordsList = document.getElementById('vocabPreviewWordsList');
    const btnVocabRollAnother = document.getElementById('btnVocabRollAnother');
    const btnVocabConfirmGenerate = document.getElementById('btnVocabConfirmGenerate');
    const btnVocabBackToForm = document.getElementById('btnVocabBackToForm');
    const rollSpinner = document.getElementById('rollSpinner');

    let currentPreviewVocabData = null;
    let seenWordsList = [];

    // Écran de Progression
    const vocabProgressScreen = document.getElementById('vocabProgressScreen');
    const vocabProgressStep = document.getElementById('vocabProgressStep');
    const vocabProgressBar = document.getElementById('vocabProgressBar');

    // Écran de Résultat
    const vocabResultScreen = document.getElementById('vocabResultScreen');
    const vocabResultImg = document.getElementById('vocabResultImg');
    const vocabResultImgWrap = document.getElementById('vocabResultImgWrap');
    const vocabResultAudio = document.getElementById('vocabResultAudio');
    const vocabResultTitleFr = document.getElementById('vocabResultTitleFr');
    const vocabResultTitleAr = document.getElementById('vocabResultTitleAr');
    const vocabResultLevelBadge = document.getElementById('vocabResultLevelBadge');
    const vocabResultWordsList = document.getElementById('vocabResultWordsList');
    const btnDownloadCardJpg = document.getElementById('btnDownloadCardJpg');
    const btnDownloadCardMp3 = document.getElementById('btnDownloadCardMp3');
    const btnVocabCreateAnother = document.getElementById('btnVocabCreateAnother');

    // Éléments Modal Détail Fiche
    const vocabDetailModal = document.getElementById('vocabDetailModal');
    const btnCloseVocabDetailModal = document.getElementById('btnCloseVocabDetailModal');
    const detailCardTitleFr = document.getElementById('detailCardTitleFr');
    const detailCardTitleAr = document.getElementById('detailCardTitleAr');
    const detailCardImg = document.getElementById('detailCardImg');
    const detailCardAudio = document.getElementById('detailCardAudio');
    const detailCardLevelBadge = document.getElementById('detailCardLevelBadge');
    const detailCardDate = document.getElementById('detailCardDate');
    const detailCardWordsList = document.getElementById('detailCardWordsList');
    const btnDetailDownloadJpg = document.getElementById('btnDetailDownloadJpg');
    const btnDetailDownloadMp3 = document.getElementById('btnDetailDownloadMp3');

    // Éléments Modal Suppression Fiche
    const vocabDeleteModal = document.getElementById('vocabDeleteModal');
    const btnCancelDeleteCard = document.getElementById('btnCancelDeleteCard');
    const btnConfirmDeleteCard = document.getElementById('btnConfirmDeleteCard');
    let cardIdPendingDelete = null;

    let selectedDifficultyLevel = 'debutant';

    /**
     * Bascule entre l'onglet Vidéos et l'onglet Fiches Vocabulaire
     */
    function switchTab(target) {
        if (target === 'cards') {
            tabBtnCards.classList.add('active');
            tabBtnCards.setAttribute('aria-selected', 'true');
            tabBtnVideos.classList.remove('active');
            tabBtnVideos.setAttribute('aria-selected', 'false');
            tabContentCards.style.display = 'block';
            tabContentVideos.style.display = 'none';
            loadCardsHistory();
        } else {
            tabBtnVideos.classList.add('active');
            tabBtnVideos.setAttribute('aria-selected', 'true');
            tabBtnCards.classList.remove('active');
            tabBtnCards.setAttribute('aria-selected', 'false');
            tabContentVideos.style.display = 'block';
            tabContentCards.style.display = 'none';
            loadVideoHistory();
        }
    }

    if (tabBtnVideos) tabBtnVideos.addEventListener('click', () => switchTab('videos'));
    if (tabBtnCards) tabBtnCards.addEventListener('click', () => switchTab('cards'));

    /**
     * Charge dynamiquement les thèmes administrables depuis le serveur
     */
    async function loadVocabThemes() {
        const themeChipsContainer = document.getElementById('themeChipsContainer');
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

                // Ré-attacher les écouteurs de clics
                const chips = themeChipsContainer.querySelectorAll('.theme-chip');
                chips.forEach(chip => {
                    chip.addEventListener('click', () => {
                        chips.forEach(c => c.classList.remove('active'));
                        chip.classList.add('active');
                        const theme = chip.getAttribute('data-theme');
                        if (vocabThemeInput) vocabThemeInput.value = theme;
                    });
                });

                if (vocabThemeInput && data.themes[0]) {
                    vocabThemeInput.value = data.themes[0].titleFr;
                }
            }
        } catch (e) {
            console.warn('[VOCAB THEMES] Chargement fallback des thèmes par défaut');
        }
    }

    /**
     * Rendu des 5 mots dans l'écran de prévisualisation (Dual Compartment)
     */
    function renderVocabPreviewList(words) {
        if (!vocabPreviewWordsList || !Array.isArray(words)) return;
        vocabPreviewWordsList.innerHTML = words.map(item => `
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

    /**
     * Ouvre le modal de création d'une fiche
     */
    function openVocabCreateModal() {
        if (!vocabCreateModal) return;

        // Réinitialiser les écrans
        vocabGenerateForm.style.display = 'block';
        if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'none';
        vocabProgressScreen.style.display = 'none';
        vocabResultScreen.style.display = 'none';
        currentPreviewVocabData = null;
        seenWordsList = [];

        // Réinitialiser les états d'anti-abus et badges
        const notice = document.getElementById('vocabRegenLimitNotice');
        if (notice) notice.style.display = 'none';
        const badge = document.getElementById('vocabRegenBadge');
        if (badge) badge.textContent = '(4 essais restants)';
        if (btnVocabRollAnother) {
            btnVocabRollAnother.disabled = false;
            btnVocabRollAnother.style.opacity = '1';
            btnVocabRollAnother.style.cursor = 'pointer';
        }

        // Charger les thèmes à jour
        loadVocabThemes();

        // Synchroniser le solde de crédits de façon sûre (priorité à l'objet utilisateur)
        let numCredits = NaN;
        try {
            const cachedUser = JSON.parse(localStorage.getItem('aya_user') || '{}');
            if (cachedUser && cachedUser.credits !== undefined) {
                numCredits = Number(cachedUser.credits);
            }
        } catch (e) {}

        if (isNaN(numCredits) && walletAvailableCredits) {
            const txt = walletAvailableCredits.textContent.trim();
            if (txt !== '--') numCredits = parseInt(txt, 10);
        }

        if (isNaN(numCredits)) numCredits = 0;

        if (vocabModalUserCredits) vocabModalUserCredits.textContent = numCredits;

        if (numCredits <= 0) {
            if (vocabZeroCreditAlert) vocabZeroCreditAlert.style.display = 'flex';
            if (btnSubmitVocabGenerate) {
                btnSubmitVocabGenerate.disabled = true;
                btnSubmitVocabGenerate.style.opacity = '0.6';
                btnSubmitVocabGenerate.style.cursor = 'not-allowed';
            }
        } else {
            if (vocabZeroCreditAlert) vocabZeroCreditAlert.style.display = 'none';
            if (btnSubmitVocabGenerate) {
                btnSubmitVocabGenerate.disabled = false;
                btnSubmitVocabGenerate.style.opacity = '1';
                btnSubmitVocabGenerate.style.cursor = 'pointer';
            }
        }

        vocabCreateModal.style.display = 'flex';
    }

    function closeVocabCreateModal() {
        if (!vocabCreateModal) return;
        if (vocabResultAudio) vocabResultAudio.pause();
        vocabCreateModal.style.display = 'none';
    }

    if (btnOpenVocabModal) btnOpenVocabModal.addEventListener('click', openVocabCreateModal);
    if (btnEmptyCreateCard) btnEmptyCreateCard.addEventListener('click', openVocabCreateModal);
    if (btnCloseVocabCreateModal) btnCloseVocabCreateModal.addEventListener('click', closeVocabCreateModal);
    if (btnCancelVocabCreate) btnCancelVocabCreate.addEventListener('click', closeVocabCreateModal);
    if (btnVocabCreateAnother) {
        btnVocabCreateAnother.addEventListener('click', () => {
            vocabGenerateForm.style.display = 'block';
            vocabProgressScreen.style.display = 'none';
            vocabResultScreen.style.display = 'none';
        });
    }

    if (btnVocabRechargeFast) {
        btnVocabRechargeFast.addEventListener('click', () => {
            closeVocabCreateModal();
            openRechargeModal();
        });
    }
    if (btnVocabRechargeAlert) {
        btnVocabRechargeAlert.addEventListener('click', () => {
            closeVocabCreateModal();
            openRechargeModal();
        });
    }

    // Gestion des puces thématiques (Theme Chips)
    const themeChips = document.querySelectorAll('.theme-chip');
    themeChips.forEach(chip => {
        chip.addEventListener('click', () => {
            themeChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const theme = chip.getAttribute('data-theme');
            if (vocabThemeInput) vocabThemeInput.value = theme;
        });
    });

    // Gestion du niveau de difficulté
    const levelChips = document.querySelectorAll('.level-chip');
    levelChips.forEach(chip => {
        chip.addEventListener('click', () => {
            levelChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedDifficultyLevel = chip.getAttribute('data-level') || 'debutant';
        });
    });

    // Gestion du sélecteur de mode (Auto Thématique vs Saisie Manuelle)
    let currentVocabMode = 'theme';
    const btnModeTheme = document.getElementById('btnModeTheme');
    const btnModeCustom = document.getElementById('btnModeCustom');
    const panelModeTheme = document.getElementById('panelModeTheme');
    const panelModeCustom = document.getElementById('panelModeCustom');
    const btnClearCustomWords = document.getElementById('btnClearCustomWords');

    /**
     * Met à jour dynamiquement la mention explicative du niveau de difficulté
     */
    function updateLevelHelpText() {
        const helpSpan = document.getElementById('levelHelpText');
        const badgeHint = document.getElementById('levelBadgeRoleHint');
        if (!helpSpan) return;

        if (currentVocabMode === 'theme') {
            helpSpan.textContent = "Guide le choix des 5 mots par l'IA et définit le badge affiché sur votre affiche.";
            if (badgeHint) badgeHint.textContent = "🏷️ Imprimé sur votre affiche";
        } else {
            let count = 0;
            for (let i = 1; i <= 5; i++) {
                const inp = document.getElementById(`customWordInput${i}`);
                if (inp && inp.value.trim()) count++;
            }

            if (count === 5) {
                helpSpan.textContent = "Définit le badge sur votre affiche et affine le registre de traduction Shami (courant vs soutenu).";
                if (badgeHint) badgeHint.textContent = "🏷️ Badge Affiche & Registre Shami";
            } else if (count > 0) {
                const missing = 5 - count;
                helpSpan.textContent = `Calibre les ${missing} mot(s) complémentaires ajoutés par l'IA et le registre de traduction Shami.`;
                if (badgeHint) badgeHint.textContent = `🤖 Complétion de ${missing} mot(s) par l'IA`;
            } else {
                helpSpan.textContent = "Sert de badge sur votre affiche et calibre le niveau si vous laissez des cases vides.";
                if (badgeHint) badgeHint.textContent = "🏷️ Imprimé sur votre affiche";
            }
        }
    }

    if (btnModeTheme && btnModeCustom) {
        btnModeTheme.addEventListener('click', () => {
            currentVocabMode = 'theme';
            btnModeTheme.classList.add('active');
            btnModeCustom.classList.remove('active');
            if (panelModeTheme) panelModeTheme.style.display = 'block';
            if (panelModeCustom) panelModeCustom.style.display = 'none';
            updateLevelHelpText();
        });

        btnModeCustom.addEventListener('click', () => {
            currentVocabMode = 'custom';
            btnModeCustom.classList.add('active');
            btnModeTheme.classList.remove('active');
            if (panelModeTheme) panelModeTheme.style.display = 'none';
            if (panelModeCustom) panelModeCustom.style.display = 'block';
            const firstInput = document.getElementById('customWordInput1');
            if (firstInput) firstInput.focus();
            updateLevelHelpText();
        });
    }

    // Écoute en temps réel de la saisie sur les 5 champs pour adapter l'aide
    for (let i = 1; i <= 5; i++) {
        const inp = document.getElementById(`customWordInput${i}`);
        if (inp) {
            inp.addEventListener('input', updateLevelHelpText);
        }
    }

    if (btnClearCustomWords) {
        btnClearCustomWords.addEventListener('click', () => {
            for (let i = 1; i <= 5; i++) {
                const inp = document.getElementById(`customWordInput${i}`);
                if (inp) inp.value = '';
            }
            const customTitleInp = document.getElementById('vocabCustomTitleInput');
            if (customTitleInp) customTitleInp.value = '';
            const firstInput = document.getElementById('customWordInput1');
            if (firstInput) firstInput.focus();
            updateLevelHelpText();
        });
    }

    // ── Étape 1 : Prévisualisation Gratuite (0 Crédit) ──
    async function requestWordsPreview(isRollAnother = false) {
        let theme = 'Solidarité & Espoir';
        let customWords = null;

        if (currentVocabMode === 'custom') {
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
            const customTitle = (document.getElementById('vocabCustomTitleInput')?.value || '').trim();
            theme = customTitle || customWords.slice(0, 2).join(' & ') || 'Mots Choisis';
        } else {
            theme = (vocabThemeInput?.value || '').trim() || 'Solidarité & Espoir';
            customWords = null;
        }

        // Gestion de l'état des boutons pendant le chargement
        if (isRollAnother) {
            if (btnVocabRollAnother) {
                btnVocabRollAnother.disabled = true;
                btnVocabRollAnother.style.opacity = '0.7';
            }
            if (rollSpinner) rollSpinner.style.display = 'inline';
        } else {
            if (btnSubmitVocabGenerate) {
                btnSubmitVocabGenerate.disabled = true;
                btnSubmitVocabGenerate.style.opacity = '0.7';
            }
            if (btnSubmitVocabText) btnSubmitVocabText.textContent = "Recherche des mots en cours...";
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

            const contentType = response.headers.get('content-type') || '';
            let data;
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const errorHtml = await response.text();
                if (response.status === 401) {
                    showToast("Session expirée. Redirection vers la page de connexion...", "warning");
                    setTimeout(() => {
                        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.hash);
                    }, 1200);
                    return;
                } else if (response.status === 404) {
                    throw new Error("L'endpoint de prévisualisation est introuvable. Veuillez vérifier que le serveur est bien démarré.");
                } else {
                    throw new Error(`Erreur serveur (${response.status}). Veuillez réessayer.`);
                }
            }

            // Gestion spécifique du Rate Limiting (HTTP 429)
            if (response.status === 429) {
                showToast(data.error || "Veuillez patienter 3 secondes entre chaque génération.", "warning");
                return;
            }

            // Gestion du Plafond de régénérations atteint
            if (!response.ok || !data.success) {
                if (data.limitReached || response.status === 400) {
                    const notice = document.getElementById('vocabRegenLimitNotice');
                    if (notice) notice.style.display = 'block';
                    const badge = document.getElementById('vocabRegenBadge');
                    if (badge) badge.textContent = '(0 essai restant)';
                    if (btnVocabRollAnother) {
                        btnVocabRollAnother.disabled = true;
                        btnVocabRollAnother.style.opacity = '0.5';
                        btnVocabRollAnother.style.cursor = 'not-allowed';
                    }
                }
                throw new Error(data.error || "Impossible de prévisualiser les mots.");
            }

            if (!Array.isArray(data.words) || data.words.length === 0) {
                throw new Error("Schéma de mots invalide reçu du serveur.");
            }

            currentPreviewVocabData = data;

            // Enregistrer les mots vus pour exclure les doublons lors des prochains rolls
            data.words.forEach(w => {
                if (w.french && !seenWordsList.includes(w.french)) {
                    seenWordsList.push(w.french);
                }
            });

            // Mettre à jour le compteur d'essais restants (4 max)
            const remaining = data.remainingRegenerations !== undefined ? data.remainingRegenerations : 4;
            const badge = document.getElementById('vocabRegenBadge');
            if (badge) {
                badge.textContent = `(${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`;
            }

            const notice = document.getElementById('vocabRegenLimitNotice');
            if (remaining === 0 || data.limitReached) {
                if (notice) notice.style.display = 'block';
                if (btnVocabRollAnother) {
                    btnVocabRollAnother.disabled = true;
                    btnVocabRollAnother.style.opacity = '0.5';
                    btnVocabRollAnother.style.cursor = 'not-allowed';
                }
            } else {
                if (notice) notice.style.display = 'none';
                if (btnVocabRollAnother) {
                    btnVocabRollAnother.disabled = false;
                    btnVocabRollAnother.style.opacity = '1';
                    btnVocabRollAnother.style.cursor = 'pointer';
                }
            }

            // Afficher dans l'écran d'arbitrage
            if (vocabPreviewTitleFr) vocabPreviewTitleFr.textContent = data.titleFr || theme.toUpperCase();
            if (vocabPreviewTitleAr) vocabPreviewTitleAr.textContent = data.titleAr || '';
            renderVocabPreviewList(data.words);

            vocabGenerateForm.style.display = 'none';
            if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'block';

        } catch (err) {
            console.error('[VOCAB PREVIEW] ❌ Erreur :', err);
            showToast(err.message || "Erreur lors de la prévisualisation des mots.", "error");
        } finally {
            if (btnSubmitVocabGenerate) {
                btnSubmitVocabGenerate.disabled = false;
                btnSubmitVocabGenerate.style.opacity = '1';
            }
            if (btnSubmitVocabText) btnSubmitVocabText.textContent = "Prévisualiser les 5 mots (Gratuit)";
            if (rollSpinner) rollSpinner.style.display = 'none';
        }
    }

    // Soumission du formulaire (déclenche l'arbitrage gratuit)
    if (vocabGenerateForm) {
        vocabGenerateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            requestWordsPreview(false);
        });
    }

    // Bouton « 🔄 Proposer 5 autres mots »
    if (btnVocabRollAnother) {
        btnVocabRollAnother.addEventListener('click', () => {
            requestWordsPreview(true);
        });
    }

    // Bouton « ✏️ Modifier critères » (retour formulaire)
    if (btnVocabBackToForm) {
        btnVocabBackToForm.addEventListener('click', () => {
            if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'none';
            vocabGenerateForm.style.display = 'block';
        });
    }

    // ── Étape 2 : Validation Définitive et Lancement de la Fabrication (1 Crédit) ──
    if (btnVocabConfirmGenerate) {
        btnVocabConfirmGenerate.addEventListener('click', async () => {
            if (!currentPreviewVocabData) {
                showToast("Aucune sélection de mots à valider.", "warning");
                return;
            }

            // Vérification solde crédits
            const availableCreditsText = walletAvailableCredits ? walletAvailableCredits.textContent : '0';
            const numCredits = parseInt(availableCreditsText, 10);
            if (!isNaN(numCredits) && numCredits <= 0) {
                showToast("Solde insuffisant (0 crédit). Veuillez recharger votre compte.", "error");
                closeVocabCreateModal();
                openRechargeModal();
                return;
            }

            // Masquer l'écran de prévisualisation et afficher l'écran de progression
            if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'none';
            vocabProgressScreen.style.display = 'block';
            vocabProgressBar.style.width = '15%';
            const isAr = isRtl();
            if (vocabProgressStep) vocabProgressStep.textContent = isAr ? "🎨 تصميم لوحة الكلمات الأنيقة..." : "🎨 Création artistique de votre affiche illustrée...";

            // Échelonnement réaliste de la progression
            const stepTimers = [
                setTimeout(() => {
                    if (vocabProgressStep) vocabProgressStep.textContent = isAr ? "🎨 تصميم لوحة الكلمات الأنيقة..." : "🎨 Création artistique de votre affiche illustrée...";
                    if (vocabProgressBar) vocabProgressBar.style.width = '55%';
                }, 3500),
                setTimeout(() => {
                    if (vocabProgressStep) vocabProgressStep.textContent = isAr ? "🎙️ تسجيل النطق الصوتي الواضح والطبيعي..." : "🎙️ Enregistrement de la prononciation audio claire et naturelle...";
                    if (vocabProgressBar) vocabProgressBar.style.width = '80%';
                }, 8500),
                setTimeout(() => {
                    if (vocabProgressStep) vocabProgressStep.textContent = isAr ? "✨ اللمسات النهائية وإعداد بطاقة المراجعة..." : "✨ Touches finales et préparation de votre fiche de révision...";
                    if (vocabProgressBar) vocabProgressBar.style.width = '95%';
                }, 14000)
            ];

            try {
                const response = await fetch('/api/premium/vocabulary-card', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        theme: currentPreviewVocabData.theme,
                        level: currentPreviewVocabData.level || selectedDifficultyLevel,
                        validatedVocabData: currentPreviewVocabData
                    })
                });

                stepTimers.forEach(t => clearTimeout(t));

                const contentType = response.headers.get('content-type') || '';
                let data;
                if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const errorHtml = await response.text();
                    vocabProgressScreen.style.display = 'none';
                    if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'block';
                    if (response.status === 401) {
                        showToast("Session expirée. Veuillez vous reconnecter.", "warning");
                        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.hash);
                        return;
                    }
                    throw new Error(`Erreur serveur (${response.status}) lors de la fabrication.`);
                }

                if (response.status === 402 || data.reason === 'INSUFFICIENT_CREDITS') {
                    vocabProgressScreen.style.display = 'none';
                    if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'block';
                    showToast(data.error || "Solde insuffisant.", "error");
                    closeVocabCreateModal();
                    openRechargeModal();
                    return;
                }

                if (!response.ok || !data.success || !data.card) {
                    throw new Error(data.error || data.message || "Erreur lors de la génération de la fiche.");
                }

                // Fabrication terminée !
                vocabProgressBar.style.width = '100%';
                const card = data.card;

                // Mettre à jour le solde utilisateur
                if (data.remainingCredits !== undefined && walletAvailableCredits) {
                    walletAvailableCredits.textContent = data.remainingCredits;
                } else if (typeof refreshWalletCredits === 'function') {
                    refreshWalletCredits();
                }

                // Mettre à jour l'écran de résultat
                if (vocabResultImg) vocabResultImg.src = card.imageUrl;
                if (vocabResultAudio) {
                    vocabResultAudio.src = card.audioUrl;
                    vocabResultAudio.load();
                }
                if (vocabResultTitleFr) vocabResultTitleFr.textContent = card.titleFr || currentPreviewVocabData.theme.toUpperCase();
                if (vocabResultTitleAr) vocabResultTitleAr.textContent = card.titleAr || '';
                if (vocabResultLevelBadge) {
                    vocabResultLevelBadge.textContent = (card.level || selectedDifficultyLevel).toUpperCase();
                }

                // Affichage des 5 mots générés (avec double phonétique)
                if (vocabResultWordsList && Array.isArray(card.words)) {
                    vocabResultWordsList.innerHTML = card.words.map(w => `
                        <div class="vocab-word-preview-row">
                            <div class="vocab-col-fr">
                                <span class="vocab-word-fr">${w.icon || '✨'} ${w.french}</span>
                                ${w.phoneticAr ? `<span class="vocab-badge-ar-phon" title="Prononciation du français pour arabophones">نُطْقُ الْفَرَنْسِيِّ: ${w.phoneticAr}</span>` : ''}
                            </div>
                            <div class="vocab-col-ar">
                                <span class="vocab-word-ar">${w.arabic}</span>
                                ${w.phoneticFr ? `<span class="vocab-badge-fr-phon" title="Prononciation de l'arabe chami">[${w.phoneticFr}]</span>` : ''}
                            </div>
                        </div>
                    `).join('');
                }

                // Liens de téléchargement directs
                if (btnDownloadCardJpg) {
                    btnDownloadCardJpg.href = card.imageUrl;
                    btnDownloadCardJpg.setAttribute('download', `${card.cardId || 'fiche_vocabulaire'}.jpg`);
                }
                if (btnDownloadCardMp3) {
                    btnDownloadCardMp3.href = card.audioUrl;
                    btnDownloadCardMp3.setAttribute('download', `${card.cardId || 'audio_vocabulaire'}.mp3`);
                }

                // Basculer vers l'écran de résultat
                setTimeout(() => {
                    vocabProgressScreen.style.display = 'none';
                    vocabResultScreen.style.display = 'block';
                }, 400);

                showToast("🎉 Fiche générée avec succès ! 1 crédit débité.", "success");

                // Actualiser immédiatement le solde et la galerie
                if (typeof loadUserProfile === 'function') loadUserProfile();
                loadCardsHistory();

            } catch (err) {
                stepTimers.forEach(t => clearTimeout(t));
                console.error('[VOCAB CARD] ❌ Erreur fabrication :', err);
                vocabProgressScreen.style.display = 'none';
                if (vocabPreviewScreen) vocabPreviewScreen.style.display = 'block';
                showToast(err.message || "Erreur inattendue lors de la fabrication.", "error");
            }
        });
    }

    /**
     * Charge l'historique des fiches de vocabulaire (GET /api/user/cards)
     */
    async function loadCardsHistory() {
        if (!cardsHistoryGrid) return;

        cardsHistoryLoading.style.display = 'block';
        cardsHistoryEmpty.style.display = 'none';
        cardsHistoryGrid.style.display = 'none';
        cardsHistoryGrid.innerHTML = '';

        try {
            const res = await fetch('/api/user/cards?page=1&limit=50', {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();

            cardsHistoryLoading.style.display = 'none';

            if (data.success && Array.isArray(data.cards) && data.cards.length > 0) {
                const rtl = isRtl();
                const total = data.total || data.cards.length;
                if (cardsCountBadge) {
                    cardsCountBadge.textContent = rtl ? `${total} بطاقة` : `${total} fiche${total > 1 ? 's' : ''}`;
                }

                data.cards.forEach(card => {
                    const cardEl = createVocabCardElement(card);
                    cardsHistoryGrid.appendChild(cardEl);
                });

                cardsHistoryGrid.style.display = 'grid';
            } else {
                if (cardsCountBadge) cardsCountBadge.textContent = isRtl() ? '٠ بطاقة' : '0 fiche';
                cardsHistoryEmpty.style.display = 'flex';
            }
        } catch (err) {
            console.error('[CARDS HISTORY ERROR]', err);
            cardsHistoryLoading.style.display = 'none';
            cardsHistoryEmpty.style.display = 'flex';
        }
    }

    /**
     * Crée le composant DOM d'une fiche de vocabulaire dans la galerie
     */
    function createVocabCardElement(c) {
        const el = document.createElement('div');
        el.className = 'vocab-card';

        const rtl = isRtl();
        const dateStr = formatDate(c.createdAt);
        const cardId = c.id || c._id || c.cardId;
        const levelText = (c.level || 'debutant').toUpperCase();

        el.innerHTML = `
            <div class="vocab-card-thumb" data-id="${cardId}" title="Cliquer pour voir et écouter">
                <img src="${c.imageUrl}" alt="${c.titleFr}" loading="lazy">
                <div class="vocab-card-overlay">
                    <div class="vocab-play-icon">▶️</div>
                    <span>Écouter & Visualiser</span>
                </div>
            </div>
            <div class="vocab-card-body">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="vocab-tag-pill">${levelText}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">📅 ${dateStr}</span>
                </div>
                <h4 class="vocab-card-title-fr">${c.titleFr || c.theme}</h4>
                <p class="vocab-card-title-ar">${c.titleAr || ''}</p>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    Thème : <strong>${c.theme || 'Général'}</strong> • 5 mots bilingues
                </div>
            </div>
            <div class="vocab-card-footer">
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn-action-sm primary btn-view-card" data-id="${cardId}" title="Aperçu et lecture audio">
                        <span>▶️</span> Écouter
                    </button>
                    <a href="${c.imageUrl}" download="${cardId}.jpg" class="btn-action-sm" title="${isRtl() ? 'تحميل صورة البطاقة للهاتف' : 'Télécharger l\'image pour téléphone'}">
                        <span>⬇️</span> JPG
                    </a>
                    <a href="${c.audioUrl}" download="${cardId}.mp3" class="btn-action-sm" title="${isRtl() ? 'تحميل النطق الصوتي' : 'Télécharger la prononciation audio'}">
                        <span>🎵</span> MP3
                    </a>
                </div>
                <button type="button" class="btn-action-sm btn-delete-card" data-id="${cardId}" title="Supprimer la fiche" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); margin-left: auto;">
                    <span>🗑️</span>
                </button>
            </div>
        `;

        // Événement clic pour voir/écouter
        const openDetail = () => openCardDetailModal(c);
        el.querySelector('.vocab-card-thumb').addEventListener('click', openDetail);
        el.querySelector('.btn-view-card').addEventListener('click', openDetail);

        // Événement suppression
        el.querySelector('.btn-delete-card').addEventListener('click', (e) => {
            e.stopPropagation();
            cardIdPendingDelete = cardId;
            if (vocabDeleteModal) vocabDeleteModal.style.display = 'flex';
        });

        return el;
    }

    /**
     * Ouvre le modal de prévisualisation détaillée d'une carte avec son lecteur audio
     */
    function openCardDetailModal(c) {
        if (!vocabDetailModal) return;

        if (detailCardTitleFr) detailCardTitleFr.textContent = c.titleFr || c.theme || 'Fiche Vocabulaire';
        if (detailCardTitleAr) detailCardTitleAr.textContent = c.titleAr || '';
        if (detailCardImg) detailCardImg.src = c.imageUrl;
        if (detailCardLevelBadge) detailCardLevelBadge.textContent = (c.level || 'debutant').toUpperCase();
        if (detailCardDate) detailCardDate.textContent = `📅 Créée le ${formatDate(c.createdAt)} • Thème : ${c.theme || 'Général'}`;

        if (detailCardAudio) {
            detailCardAudio.src = c.audioUrl;
            detailCardAudio.load();
        }

        if (detailCardWordsList && Array.isArray(c.words)) {
            detailCardWordsList.innerHTML = c.words.map(w => `
                <div class="vocab-word-preview-row">
                    <div class="vocab-col-fr">
                        <span class="vocab-word-fr">${w.icon || '✨'} ${w.french}</span>
                        ${w.phoneticAr ? `<span class="vocab-badge-ar-phon" title="Prononciation du français pour arabophones">نُطْقُ الْفَرَنْسِيِّ: ${w.phoneticAr}</span>` : ''}
                    </div>
                    <div class="vocab-col-ar">
                        <span class="vocab-word-ar">${w.arabic}</span>
                        ${w.phoneticFr ? `<span class="vocab-badge-fr-phon" title="Prononciation de l'arabe chami">[${w.phoneticFr}]</span>` : ''}
                    </div>
                </div>
            `).join('');
        }

        if (btnDetailDownloadJpg) {
            btnDetailDownloadJpg.href = c.imageUrl;
            btnDetailDownloadJpg.setAttribute('download', `${c.id || 'fiche'}.jpg`);
        }
        if (btnDetailDownloadMp3) {
            btnDetailDownloadMp3.href = c.audioUrl;
            btnDetailDownloadMp3.setAttribute('download', `${c.id || 'audio'}.mp3`);
        }

        vocabDetailModal.style.display = 'flex';
    }

    function closeVocabDetailModal() {
        if (!vocabDetailModal) return;
        if (detailCardAudio) detailCardAudio.pause();
        vocabDetailModal.style.display = 'none';
    }

    if (btnCloseVocabDetailModal) btnCloseVocabDetailModal.addEventListener('click', closeVocabDetailModal);

    // Modal Confirmation Suppression Fiche
    if (btnCancelDeleteCard) {
        btnCancelDeleteCard.addEventListener('click', () => {
            cardIdPendingDelete = null;
            if (vocabDeleteModal) vocabDeleteModal.style.display = 'none';
        });
    }

    if (btnConfirmDeleteCard) {
        btnConfirmDeleteCard.addEventListener('click', async () => {
            if (!cardIdPendingDelete) return;

            const cid = cardIdPendingDelete;
            btnConfirmDeleteCard.disabled = true;
            btnConfirmDeleteCard.textContent = "Suppression en cours...";

            try {
                const res = await fetch(`/api/user/cards/${encodeURIComponent(cid)}`, {
                    method: 'DELETE',
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json();

                if (data.success) {
                    showToast("Fiche supprimée avec succès.", "success");
                    if (vocabDeleteModal) vocabDeleteModal.style.display = 'none';
                    if (vocabDetailModal && vocabDetailModal.style.display === 'flex') {
                        closeVocabDetailModal();
                    }
                    loadCardsHistory();
                } else {
                    showToast(data.error || "Impossible de supprimer la fiche.", "error");
                }
            } catch (err) {
                console.error('[DELETE CARD ERROR]', err);
                showToast("Erreur lors de la suppression.", "error");
            } finally {
                btnConfirmDeleteCard.disabled = false;
                btnConfirmDeleteCard.textContent = "Confirmer la suppression";
                cardIdPendingDelete = null;
            }
        });
    }

    if (btnRefreshCards) {
        btnRefreshCards.addEventListener('click', () => {
            loadCardsHistory();
            loadUserProfile();
            showToast("Historique des fiches actualisé.", "info");
        });
    }

    // Fermeture avec clic extérieur sur les nouveaux modaux
    [vocabCreateModal, vocabDetailModal, vocabDeleteModal].forEach(m => {
        if (m) {
            m.addEventListener('click', (e) => {
                if (e.target === m) {
                    if (m === vocabCreateModal) closeVocabCreateModal();
                    if (m === vocabDetailModal) closeVocabDetailModal();
                    if (m === vocabDeleteModal) {
                        cardIdPendingDelete = null;
                        m.style.display = 'none';
                    }
                }
            });
        }
    });

    // Fermeture Échap sur tous les modaux
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (rechargeModal && rechargeModal.style.display === 'flex') rechargeModal.style.display = 'none';
            if (videoPreviewModal && videoPreviewModal.style.display === 'flex') closeVideoModal();
            if (vocabCreateModal && vocabCreateModal.style.display === 'flex') closeVocabCreateModal();
            if (vocabDetailModal && vocabDetailModal.style.display === 'flex') closeVocabDetailModal();
            if (vocabDeleteModal && vocabDeleteModal.style.display === 'flex') {
                cardIdPendingDelete = null;
                vocabDeleteModal.style.display = 'none';
            }
        }
    });

    // Deep-linking d'onglets et de modaux (?tab=cards, #cards, #fiches, #videos, #packs, #wallet, #create-card)
    function handleRouteHash() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const hash = (window.location.hash || '').toLowerCase();
            const tabParam = (urlParams.get('tab') || '').toLowerCase();
            const actionParam = (urlParams.get('action') || '').toLowerCase();

            if (tabParam === 'cards' || hash === '#cards' || hash === '#fiches') {
                switchTab('cards');
            } else if (tabParam === 'videos' || hash === '#videos' || hash === '#historique') {
                switchTab('videos');
            } else if (hash === '#packs' || hash === '#wallet' || hash === '#recharge') {
                openRechargeModal();
            }

            // Détection du retour de paiement Stripe
            const paymentParam = urlParams.get('payment');
            if (paymentParam === 'success') {
                showToast("🎉 Paiement validé avec succès ! Vos crédits sont disponibles.", "success");
                loadUserProfile();
                setTimeout(() => loadUserProfile(), 2000);
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (paymentParam === 'cancelled' || paymentParam === 'cancel') {
                showToast("Paiement annulé. Aucun débit n'a été effectué.", "warning");
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            if (actionParam === 'create' || hash === '#create-card') {
                switchTab('cards');
                setTimeout(openVocabCreateModal, 300);
            }
        } catch (e) {
            console.warn('[ROUTING] Erreur hash:', e);
        }
    }

    handleRouteHash();
    window.addEventListener('hashchange', handleRouteHash);

    // Initialisation
    loadUserProfile();
    loadVideoHistory();
});

