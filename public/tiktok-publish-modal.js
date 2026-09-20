/**
 * 🎬 tiktok-publish-modal.js - Modal de Pré-Publication & Validation TikTok (Ticket 4A)
 * Implémentation Vanilla / ES6 pour intégration immédiate et sans build dans Aya Studio (traduction.html).
 * 
 * Éléments intégrés :
 * 1. Preview Vidéo 9:16 avec Calque "Safe Zone" interactif (simulation interface TikTok)
 * 2. Éditeur de Métadonnées pré-rempli avec la Smart Description SEO
 * 3. Compteur dynamique de caractères en temps réel (limite stricte 2 200 car.)
 * 4. Indicateur de statut TikTok en direct (/api/tiktok/auth/status) avec liaison 1-clic
 * 5. Interception 401 avec Silent Refresh automatique (/api/tiktok/auth/refresh)
 * 6. Sauvegarde locale en Brouillon & Publication officielle (/api/tiktok/publish)
 * 
 * @module TikTokPublishModal
 */

(function () {
    let currentModalEl = null;
    let currentMediaData = null;
    let showSafeZone = true;
    let currentTab = 'video';
    const MAX_TIKTOK_CHARS = 2200;

    /**
     * Ouvre le modal de pré-publication TikTok avec les données du média.
     */
    window.openTikTokPublishModal = function (mediaData) {
        currentMediaData = mediaData || {};
        closeTikTokPublishModal();

        const defaultTitle = currentMediaData.semantic_title || currentMediaData.clean_title || 'Témoignage Exclusif';
        const defaultDesc = currentMediaData.context_summary || '';

        // Récupération d'un éventuel brouillon sauvegardé
        const storageKey = `aya_tiktok_draft_${currentMediaData.mp4_filename || 'current'}`;
        let initialTitle = defaultTitle;
        let initialDesc = defaultDesc;
        let draftRestored = false;

        try {
            const savedDraft = localStorage.getItem(storageKey);
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft);
                if (parsed.title) initialTitle = parsed.title;
                if (parsed.description) initialDesc = parsed.description;
                draftRestored = true;
            }
        } catch (e) {}

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'tiktokPublishModalOverlay';
        modalOverlay.className = 'tt-modal-backdrop';

        modalOverlay.innerHTML = `
            <div class="tt-modal-card" role="dialog" aria-modal="true">
                <!-- En-tête -->
                <div class="tt-modal-header">
                    <div class="tt-header-left">
                        <span class="tt-logo">📱</span>
                        <div>
                            <h2 class="tt-title">Aya Studio — Pré-Publication TikTok</h2>
                            <p class="tt-subtitle">Revue du rendu 9:16, validation de la description et diffusion directe</p>
                        </div>
                    </div>
                    <div class="tt-header-right">
                        <div id="ttAccountBadgeContainer">
                            <span class="tt-badge-loading">⏳ Vérification...</span>
                        </div>
                        <button type="button" class="tt-btn-close" id="ttBtnCloseModal" title="Fermer">✕</button>
                    </div>
                </div>

                <!-- Corps -->
                <div class="tt-modal-body">
                    <!-- Colonne Gauche (40%) : Preview 9:16 -->
                    <div class="tt-col-left">
                        <div class="tt-preview-toolbar">
                            <div class="tt-tab-group">
                                <button type="button" id="ttTabVideo" class="tt-tab-btn active">🎬 Vidéo (.ASS)</button>
                                ${currentMediaData.cover_url ? '<button type="button" id="ttTabCover" class="tt-tab-btn">🖼️ Couverture 9:16</button>' : ''}
                            </div>
                            <button type="button" id="ttToggleSafeZone" class="tt-btn-safezone active" title="Activer/Désactiver le calque simulant l'interface native TikTok">
                                👁️ Safe Zone : Active
                            </button>
                        </div>

                        <!-- Cadre Smartphone 9:16 -->
                        <div class="tt-phone-frame">
                            <div id="ttVideoWrapper" class="tt-video-wrapper">
                                <video id="ttVideoPlayer" src="${currentMediaData.mp4_url || ''}" controls autoplay loop playsinline></video>

                                <!-- CALQUE REPERES TIKTOK SAFE ZONE -->
                                <div id="ttSafeZoneOverlay" class="tt-safezone-overlay">
                                    <div class="tt-ui-top">
                                        <span>Suivis</span>
                                        <span style="font-weight:800; border-bottom:2px solid #fff;">Pour toi</span>
                                        <span>🔍</span>
                                    </div>

                                    <!-- ZONE SÛRE SOUS-TITRES -->
                                    <div class="tt-safe-area-box">
                                        <span class="tt-safe-area-label">Zone Sûre Sous-titres (.ass MarginV)</span>
                                    </div>

                                    <!-- Rail Icônes Droite -->
                                    <div class="tt-ui-right-rail">
                                        <div class="tt-rail-item">
                                            <div class="tt-avatar-wrap">
                                                <div class="tt-avatar-circle">A</div>
                                                <div class="tt-plus-badge">+</div>
                                            </div>
                                        </div>
                                        <div class="tt-rail-item">
                                            <span class="tt-rail-emoji">❤️</span>
                                            <span class="tt-rail-count">84.2K</span>
                                        </div>
                                        <div class="tt-rail-item">
                                            <span class="tt-rail-emoji">💬</span>
                                            <span class="tt-rail-count">1.4K</span>
                                        </div>
                                        <div class="tt-rail-item">
                                            <span class="tt-rail-emoji">🔖</span>
                                            <span class="tt-rail-count">9.8K</span>
                                        </div>
                                        <div class="tt-rail-item">
                                            <span class="tt-rail-emoji">↗️</span>
                                            <span class="tt-rail-count">3.2K</span>
                                        </div>
                                        <div class="tt-rail-item">
                                            <div class="tt-vinyl-disc">💿</div>
                                        </div>
                                    </div>

                                    <!-- Zone Basse (Texte + Auteur) -->
                                    <div class="tt-ui-bottom">
                                        <div class="tt-author">@aya.studio • 1h</div>
                                        <div id="ttOverlayCaption" class="tt-caption">${escapeHtml(initialTitle)} ... <span style="color:#94a3b8">plus</span></div>
                                        <div class="tt-audio-track">🎵 Son original - Plateforme Aya Studio</div>
                                    </div>

                                    <!-- Barre Navigation Basse -->
                                    <div class="tt-ui-nav">
                                        <span>Accueil</span>
                                        <span>Amis</span>
                                        <span class="tt-nav-plus">+</span>
                                        <span>Boîte</span>
                                        <span>Profil</span>
                                    </div>
                                </div>
                            </div>

                            ${currentMediaData.cover_url ? `<img id="ttCoverImage" src="${currentMediaData.cover_url}" class="tt-cover-img" style="display:none;" alt="Couverture 9:16">` : ''}
                        </div>

                        <p class="tt-hint">
                            💡 <b>Repère Safe Zone :</b> Vos sous-titres .ass ne doivent être masqués ni par le texte du bas ni par les boutons de droite.
                        </p>
                    </div>

                    <!-- Colonne Droite (60%) : Éditeur Métadonnées -->
                    <div class="tt-col-right">
                        <div class="tt-form-group">
                            <label class="tt-label">🏷️ Titre de la Publication (Accroche Visuelle)</label>
                            <input type="text" id="ttInputTitle" class="tt-input" value="${escapeHtml(initialTitle)}" maxlength="100" placeholder="Ex: Face à l'Interrogatoire">
                        </div>

                        <div class="tt-form-group">
                            <div class="tt-label-row">
                                <label class="tt-label">📝 Smart Description SEO TikTok (Optimisée IA)</label>
                                <span id="ttCharCounter" class="tt-counter-ok">0 / 2 200 car.</span>
                            </div>
                            <textarea id="ttTextareaDesc" class="tt-textarea" rows="12" placeholder="Rédigez votre description...">${escapeHtml(initialDesc)}</textarea>
                        </div>

                        <!-- Paramètres TikTok -->
                        <div class="tt-settings-grid">
                            <div class="tt-form-group">
                                <label class="tt-sublabel">👁️ Confidentialité</label>
                                <select id="ttSelectPrivacy" class="tt-select">
                                    <option value="PUBLIC_TO_EVERYONE">🌍 Tout le monde (Public)</option>
                                    <option value="MUTUAL_FOLLOW_FRIENDS">👥 Amis mutuels uniquement</option>
                                    <option value="SELF_ONLY">🔒 Privé (Moi uniquement)</option>
                                </select>
                            </div>
                            <div class="tt-form-group">
                                <label class="tt-sublabel">⚙️ Interactions</label>
                                <div class="tt-checkbox-row">
                                    <label><input type="checkbox" id="ttCheckComment" checked> Commentaires</label>
                                    <label><input type="checkbox" id="ttCheckDuet" checked> Duos</label>
                                    <label><input type="checkbox" id="ttCheckStitch" checked> Collages</label>
                                </div>
                            </div>
                        </div>

                        <!-- Notification / Alerte Dynamique -->
                        <div id="ttFeedbackBanner" class="tt-alert-banner" style="display:none;"></div>

                        <!-- Barre de Progression Publication -->
                        <div id="ttProgressContainer" class="tt-progress-container" style="display:none;">
                            <div class="tt-progress-track">
                                <div id="ttProgressBar" class="tt-progress-bar" style="width: 0%;"></div>
                            </div>
                            <span id="ttProgressText" class="tt-progress-text">Transmission vers TikTok...</span>
                        </div>
                    </div>
                </div>

                <!-- Pied de Page -->
                <div class="tt-modal-footer">
                    <div class="tt-footer-left">
                        <button type="button" id="ttBtnSaveDraft" class="tt-btn-draft">💾 Enregistrer en Brouillon</button>
                        <span id="ttDraftBadge" class="tt-draft-badge" style="display:${draftRestored ? 'inline-block' : 'none'};">✨ Brouillon local restauré</span>
                    </div>
                    <div class="tt-footer-right">
                        <button type="button" id="ttBtnCancel" class="tt-btn-cancel">Annuler</button>
                        <button type="button" id="ttBtnPublish" class="tt-btn-publish">
                            <span>🚀</span> Valider & Publier sur TikTok
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);
        currentModalEl = modalOverlay;

        // Attachement des gestionnaires d'événements
        attachModalEvents(modalOverlay);
        refreshTikTokAccountStatus();
        updateCharCounter();
    };

    /**
     * Ferme le modal et libère les ressources.
     */
    window.closeTikTokPublishModal = function () {
        if (currentModalEl) {
            const vid = currentModalEl.querySelector('#ttVideoPlayer');
            if (vid) {
                vid.pause();
                vid.src = '';
            }
            currentModalEl.remove();
            currentModalEl = null;
        }
    };

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    function attachModalEvents(modal) {
        const btnClose = modal.querySelector('#ttBtnCloseModal');
        const btnCancel = modal.querySelector('#ttBtnCancel');
        const btnSaveDraft = modal.querySelector('#ttBtnSaveDraft');
        const btnPublish = modal.querySelector('#ttBtnPublish');
        const textareaDesc = modal.querySelector('#ttTextareaDesc');
        const inputTitle = modal.querySelector('#ttInputTitle');
        const toggleSafeZone = modal.querySelector('#ttToggleSafeZone');
        const safeZoneOverlay = modal.querySelector('#ttSafeZoneOverlay');
        const tabVideo = modal.querySelector('#ttTabVideo');
        const tabCover = modal.querySelector('#ttTabCover');
        const videoWrap = modal.querySelector('#ttVideoWrapper');
        const coverImg = modal.querySelector('#ttCoverImage');
        const overlayCaption = modal.querySelector('#ttOverlayCaption');

        btnClose.addEventListener('click', closeTikTokPublishModal);
        btnCancel.addEventListener('click', closeTikTokPublishModal);

        // Mise à jour synchrone du compteur
        textareaDesc.addEventListener('input', () => {
            updateCharCounter();
        });

        inputTitle.addEventListener('input', (e) => {
            if (overlayCaption) {
                overlayCaption.innerHTML = `${escapeHtml(e.target.value || 'Titre')} ... <span style="color:#94a3b8">plus</span>`;
            }
        });

        // Bascule Safe Zone
        if (toggleSafeZone && safeZoneOverlay) {
            toggleSafeZone.addEventListener('click', () => {
                showSafeZone = !showSafeZone;
                safeZoneOverlay.style.display = showSafeZone ? 'flex' : 'none';
                toggleSafeZone.className = showSafeZone ? 'tt-btn-safezone active' : 'tt-btn-safezone';
                toggleSafeZone.textContent = showSafeZone ? '👁️ Safe Zone : Active' : '👁️ Safe Zone : Masquée';
            });
        }

        // Bascule Onglets Vidéo / Couverture
        if (tabVideo && tabCover) {
            tabVideo.addEventListener('click', () => {
                currentTab = 'video';
                tabVideo.classList.add('active');
                tabCover.classList.remove('active');
                if (videoWrap) videoWrap.style.display = 'block';
                if (coverImg) coverImg.style.display = 'none';
                if (toggleSafeZone) toggleSafeZone.style.display = 'inline-block';
            });

            tabCover.addEventListener('click', () => {
                currentTab = 'cover';
                tabCover.classList.add('active');
                tabVideo.classList.remove('active');
                if (videoWrap) videoWrap.style.display = 'none';
                if (coverImg) coverImg.style.display = 'block';
                if (toggleSafeZone) toggleSafeZone.style.display = 'none';
            });
        }

        // Sauvegarde Brouillon
        btnSaveDraft.addEventListener('click', () => {
            const storageKey = `aya_tiktok_draft_${currentMediaData.mp4_filename || 'current'}`;
            const draft = {
                title: inputTitle.value,
                description: textareaDesc.value,
                privacy: modal.querySelector('#ttSelectPrivacy').value,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem(storageKey, JSON.stringify(draft));
            const badge = modal.querySelector('#ttDraftBadge');
            if (badge) {
                badge.textContent = '💾 Brouillon sauvegardé avec succès !';
                badge.style.display = 'inline-block';
                setTimeout(() => { badge.style.display = 'none'; }, 3000);
            }
        });

        // Validation & Publication TikTok
        btnPublish.addEventListener('click', () => {
            handlePublishAction(modal);
        });

        // Écoute de la fermeture par touche Échap
        document.addEventListener('keydown', function escListener(e) {
            if (e.key === 'Escape' && currentModalEl) {
                closeTikTokPublishModal();
                document.removeEventListener('keydown', escListener);
            }
        });
    }

    function updateCharCounter() {
        if (!currentModalEl) return;
        const textarea = currentModalEl.querySelector('#ttTextareaDesc');
        const counter = currentModalEl.querySelector('#ttCharCounter');
        const btnPublish = currentModalEl.querySelector('#ttBtnPublish');
        if (!textarea || !counter) return;

        const count = textarea.value.length;
        counter.textContent = `${count.toLocaleString()} / ${MAX_TIKTOK_CHARS} car.`;

        if (count > MAX_TIKTOK_CHARS) {
            counter.className = 'tt-counter-danger';
            textarea.classList.add('danger');
            if (btnPublish) btnPublish.disabled = true;
        } else if (count > 1800) {
            counter.className = 'tt-counter-warning';
            textarea.classList.remove('danger');
            if (btnPublish) btnPublish.disabled = false;
        } else {
            counter.className = 'tt-counter-ok';
            textarea.classList.remove('danger');
            if (btnPublish) btnPublish.disabled = false;
        }
    }

    async function refreshTikTokAccountStatus() {
        if (!currentModalEl) return;
        const container = currentModalEl.querySelector('#ttAccountBadgeContainer');
        if (!container) return;

        try {
            const res = await fetch('/api/tiktok/auth/status');
            const data = await res.json();

            if (res.ok && data.success && data.connected) {
                container.innerHTML = `
                    <div class="tt-account-badge">
                        ${data.avatarUrl ? `<img src="${data.avatarUrl}" class="tt-account-avatar" alt="Avatar">` : '<span style="font-size:0.85rem">👤</span>'}
                        <span class="tt-account-name">@${data.displayName || 'TikTok'}</span>
                        <span class="tt-account-check">✓ Lié</span>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <button type="button" id="ttBtnConnect" class="tt-btn-connect">
                        🔗 Lier mon compte TikTok
                    </button>
                `;
                const btnConn = container.querySelector('#ttBtnConnect');
                if (btnConn) {
                    btnConn.addEventListener('click', () => {
                        const width = 560;
                        const height = 760;
                        const left = window.screen.width / 2 - width / 2;
                        const top = window.screen.height / 2 - height / 2;
                        window.open(
                            '/api/tiktok/auth/login',
                            'TikTokOAuthPopup',
                            `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
                        );
                    });
                }
            }
        } catch (e) {
            container.innerHTML = `<span class="tt-badge-loading">⚠️ Statut non disponible</span>`;
        }
    }

    /**
     * Publication avec gestion de l'Interception 401 & Silent Refresh
     */
    async function handlePublishAction(modal) {
        const inputTitle = modal.querySelector('#ttInputTitle');
        const textareaDesc = modal.querySelector('#ttTextareaDesc');
        const selectPrivacy = modal.querySelector('#ttSelectPrivacy');
        const checkComment = modal.querySelector('#ttCheckComment');
        const checkDuet = modal.querySelector('#ttCheckDuet');
        const checkStitch = modal.querySelector('#ttCheckStitch');
        const btnPublish = modal.querySelector('#ttBtnPublish');
        const feedback = modal.querySelector('#ttFeedbackBanner');
        const progressBox = modal.querySelector('#ttProgressContainer');
        const progressBar = modal.querySelector('#ttProgressBar');
        const progressText = modal.querySelector('#ttProgressText');

        if (textareaDesc.value.length > MAX_TIKTOK_CHARS) {
            showFeedback(feedback, 'error', `La description dépasse la limite maximale (${MAX_TIKTOK_CHARS} car.).`);
            return;
        }

        btnPublish.disabled = true;
        btnPublish.innerHTML = '<span>⏳</span> Publication en cours...';
        progressBox.style.display = 'flex';
        progressBar.style.width = '25%';
        progressText.textContent = 'Préparation des métadonnées et validation...';
        feedback.style.display = 'none';

        const payload = {
            mp4_filename: currentMediaData.mp4_filename,
            title: inputTitle.value.trim(),
            description: textareaDesc.value.trim(),
            privacy_level: selectPrivacy.value,
            disable_comment: !checkComment.checked,
            disable_duet: !checkDuet.checked,
            disable_stitch: !checkStitch.checked
        };

        try {
            progressBar.style.width = '45%';
            let res = await fetch('/api/tiktok/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // INTERCEPTION D'EXPIRATION 401 (SILENT REFRESH VICTOR)
            if (res.status === 401) {
                console.warn("[TIKTOK MODAL] ⚠️ Réponse 401. Déclenchement du Silent Refresh...");
                showFeedback(feedback, 'warning', 'Jeton expiré : renouvellement silencieux de la session TikTok en cours...');
                progressBar.style.width = '65%';

                const refRes = await fetch('/api/tiktok/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const refData = await refRes.json();

                if (refRes.ok && refData.success) {
                    console.log("[TIKTOK MODAL] ✅ Jeton renouvelé avec succès ! Re-tentative de publication...");
                    progressBar.style.width = '80%';
                    progressText.textContent = 'Jeton renouvelé. Seconde tentative de diffusion...';

                    // Deuxième tentative transparente
                    res = await fetch('/api/tiktok/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    throw new Error("Votre session TikTok a expiré. Veuillez reconnecter votre compte.");
                }
            }

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || data.message || "Échec lors de la transmission à TikTok.");
            }

            progressBar.style.width = '100%';
            progressText.textContent = 'Publication réussie !';
            showFeedback(feedback, 'success', `🎉 Vidéo envoyée avec succès à TikTok ! (ID tâche : ${data.publish_id || 'OK'})`);
            btnPublish.innerHTML = '<span>✅</span> Vidéo Publiée';

            // Nettoyage du brouillon
            const storageKey = `aya_tiktok_draft_${currentMediaData.mp4_filename || 'current'}`;
            localStorage.removeItem(storageKey);

            setTimeout(() => {
                refreshTikTokAccountStatus();
            }, 1000);

        } catch (err) {
            console.error("[TIKTOK PUBLISH ERROR]", err);
            showFeedback(feedback, 'error', err.message);
            btnPublish.disabled = false;
            btnPublish.innerHTML = '<span>🚀</span> Réessayer la Publication';
            progressBox.style.display = 'none';
        }
    }

    function showFeedback(el, type, text) {
        if (!el) return;
        el.style.display = 'flex';
        el.className = `tt-alert-banner tt-alert-${type}`;
        el.innerHTML = `<span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'}</span> <span>${text}</span>`;
    }

    // Écoute globale de la popup OAuth TikTok
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TIKTOK_OAUTH_RESULT') {
            console.log("[TIKTOK MODAL] Événement OAuth reçu :", event.data);
            refreshTikTokAccountStatus();
        }
    });

})();
