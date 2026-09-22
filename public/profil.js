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
                if (walletAvailableCredits) {
                    walletAvailableCredits.textContent = user.credits !== undefined ? user.credits : 0;
                }
                if (walletReservedCredits) {
                    walletReservedCredits.textContent = user.creditsReserved !== undefined ? user.creditsReserved : 0;
                }

                // Afficher le lien vers la tour de contrôle si l'utilisateur est administrateur
                const adminContainer = document.getElementById('adminTourBtnContainer');
                if (adminContainer && (user.email === 'artas971@gmail.com' || user.role === 'admin')) {
                    adminContainer.style.display = 'inline-block';
                }

                // Synchronisation locale pour aya-i18n.js et autres pages
                localStorage.setItem('aya_user', JSON.stringify(user));

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

    if (btnRefreshHistory) {
        btnRefreshHistory.addEventListener('click', () => {
            loadVideoHistory();
            loadUserProfile();
            showToast(isRtl() ? "تم تحديث السجل بنجاح." : "Historique actualisé.", "info");
        });
    }

    // Réagir immédiatement au changement de langue via la Navbar
    window.addEventListener('aya:languageChanged', () => {
        loadVideoHistory();
    });

    // Fermeture des modales avec Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (rechargeModal && rechargeModal.style.display === 'flex') {
                rechargeModal.style.display = 'none';
            }
            if (videoPreviewModal && videoPreviewModal.style.display === 'flex') {
                closeVideoModal();
            }
        }
    });

    // Gestion des retours de paiement Stripe (?payment=success ou ?payment=cancelled)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            showToast("🎉 Paiement validé avec succès ! Vos crédits ont été ajoutés à votre portefeuille.", "success");
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => loadUserProfile(), 500);
        } else if (urlParams.get('payment') === 'cancelled') {
            showToast("Le paiement a été annulé. Aucun débit n'a été effectué.", "info");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (e) {}

    // Initialisation
    loadUserProfile();
    loadVideoHistory();
});
