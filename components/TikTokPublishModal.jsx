import React, { useState, useEffect, useRef } from 'react';

/**
 * 🎬 TikTokPublishModal.jsx - Composant de Pré-Publication & Validation TikTok (Ticket 4A)
 * 
 * Rôles & Spécifications :
 * - Preview Vidéo 9:16 avec Calque "Safe Zone" interactif (simulation de l'UI TikTok)
 * - Vérification du respect des marges pour les sous-titres .ass incrustés
 * - Éditeur de Métadonnées pré-rempli avec le copywriting d'Agent Nadine
 * - Jauge de caractères dynamique en temps réel (limite stricte API TikTok : 2 200 car.)
 * - Indicateur de statut de compte TikTok en direct (/api/tiktok/auth/status)
 * - Interception d'erreur 401 avec Silent Refresh automatique (/api/tiktok/auth/refresh)
 * - Sauvegarde locale en Brouillon & Publication officielle (/api/tiktok/publish)
 * 
 * @author Agent Lionel (Lead Frontend React & UI/UX Designer)
 */

export default function TikTokPublishModal({
    isOpen = false,
    onClose,
    mediaData = {},
    onPublishSuccess
}) {
    // -------------------------------------------------------------------------
    // 1. ÉTATS DU COMPOSANT
    // -------------------------------------------------------------------------
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [previewTab, setPreviewTab] = useState('video'); // 'video' | 'cover'
    const [showSafeZone, setShowSafeZone] = useState(true); // Calque Repères TikTok Safe Zone
    
    // Compteur de caractères (Limite stricte TikTok)
    const MAX_TIKTOK_CHARS = 2200;
    const charCount = description.length;
    const isOverLimit = charCount > MAX_TIKTOK_CHARS;

    // Statut du compte TikTok
    const [tiktokAccount, setTiktokAccount] = useState({
        loading: true,
        connected: false,
        displayName: '',
        avatarUrl: '',
        openId: '',
        isExpired: false
    });

    // Paramètres de publication TikTok
    const [privacyLevel, setPrivacyLevel] = useState('PUBLIC_TO_EVERYONE');
    const [allowComment, setAllowComment] = useState(true);
    const [allowDuet, setAllowDuet] = useState(true);
    const [allowStitch, setAllowStitch] = useState(true);

    // États d'action & retour utilisateur
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishProgress, setPublishProgress] = useState(0);
    const [draftStatus, setDraftStatus] = useState(null); // 'saved' | null
    const [feedbackMessage, setFeedbackMessage] = useState({ type: null, text: '' }); // 'success' | 'error' | 'warning'

    const videoRef = useRef(null);

    // -------------------------------------------------------------------------
    // 2. INITIALISATION & CHARGEMENT DU STATUT TIKTOK
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!isOpen) return;

        // Pré-remplissage depuis les données transmises par Max, Thomas et Nadine
        const defaultTitle = mediaData.semantic_title || mediaData.clean_title || 'Témoignage Exclusif';
        const defaultDesc = mediaData.context_summary || '';
        
        // Vérifier si un brouillon local existe déjà pour ce fichier
        const storageKey = `aya_tiktok_draft_${mediaData.mp4_filename || 'current'}`;
        const savedDraft = localStorage.getItem(storageKey);

        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                setTitle(parsed.title || defaultTitle);
                setDescription(parsed.description || defaultDesc);
                if (parsed.privacyLevel) setPrivacyLevel(parsed.privacyLevel);
                setDraftStatus('restored');
                setTimeout(() => setDraftStatus(null), 3500);
            } catch (e) {
                setTitle(defaultTitle);
                setDescription(defaultDesc);
            }
        } else {
            setTitle(defaultTitle);
            setDescription(defaultDesc);
        }

        checkTikTokStatus();

        // Écoute de l'événement postMessage renvoyé par la popup d'autorisation OAuth2
        const handleOAuthMessage = (event) => {
            if (event.data && event.data.type === 'TIKTOK_OAUTH_RESULT') {
                console.log("[TIKTOK POPUP] Message OAuth reçu :", event.data);
                checkTikTokStatus();
                if (event.data.success) {
                    setFeedbackMessage({ type: 'success', text: 'Compte TikTok connecté avec succès !' });
                    setTimeout(() => setFeedbackMessage({ type: null, text: '' }), 4000);
                }
            }
        };

        window.addEventListener('message', handleOAuthMessage);
        return () => window.removeEventListener('message', handleOAuthMessage);
    }, [isOpen, mediaData]);

    const checkTikTokStatus = async () => {
        setTiktokAccount(prev => ({ ...prev, loading: true }));
        try {
            const res = await fetch('/api/tiktok/auth/status');
            const data = await res.json();
            if (res.ok && data.success) {
                setTiktokAccount({
                    loading: false,
                    connected: Boolean(data.connected),
                    displayName: data.displayName || 'Compte Lié',
                    avatarUrl: data.avatarUrl || '',
                    openId: data.openId || '',
                    isExpired: Boolean(data.isExpired)
                });
            } else {
                setTiktokAccount(prev => ({ ...prev, loading: false, connected: false }));
            }
        } catch (err) {
            console.warn("[TIKTOK STATUS] Impossible de vérifier le compte :", err.message);
            setTiktokAccount(prev => ({ ...prev, loading: false, connected: false }));
        }
    };

    // -------------------------------------------------------------------------
    // 3. ACTIONS UTILISATEUR (CONNEXION, BROUILLON, PUBLICATION)
    // -------------------------------------------------------------------------
    const handleConnectTikTok = () => {
        const width = 560;
        const height = 760;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
            '/api/tiktok/auth/login',
            'TikTokOAuthPopup',
            `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
        );
    };

    const handleSaveDraft = () => {
        const storageKey = `aya_tiktok_draft_${mediaData.mp4_filename || 'current'}`;
        const draftData = {
            title,
            description,
            privacyLevel,
            allowComment,
            allowDuet,
            allowStitch,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(draftData));
        setDraftStatus('saved');
        setTimeout(() => setDraftStatus(null), 3000);
    };

    /**
     * Publication avec Interception d'Expiration 401 & Silent Refresh Transparent
     */
    const handlePublish = async () => {
        if (!tiktokAccount.connected) {
            setFeedbackMessage({ type: 'warning', text: 'Veuillez lier votre compte TikTok avant de publier.' });
            return;
        }

        if (isOverLimit) {
            setFeedbackMessage({ type: 'error', text: `La description dépasse la limite TikTok de ${MAX_TIKTOK_CHARS} caractères.` });
            return;
        }

        setIsPublishing(true);
        setPublishProgress(20);
        setFeedbackMessage({ type: null, text: '' });

        const payload = {
            mp4_filename: mediaData.mp4_filename,
            title: title.trim(),
            description: description.trim(),
            privacy_level: privacyLevel,
            disable_comment: !allowComment,
            disable_duet: !allowDuet,
            disable_stitch: !allowStitch
        };

        try {
            setPublishProgress(40);

            let res = await fetch('/api/tiktok/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // 🛡️ INTERCEPTION 401 : Token expiré -> Silent Refresh automatique (Agent Victor)
            if (res.status === 401) {
                console.warn("[TIKTOK PUBLISH] ⚠️ Réponse 401 reçue. Déclenchement du Silent Refresh...");
                setFeedbackMessage({
                    type: 'warning',
                    text: 'Jeton TikTok expiré. Renouvellement silencieux sécurisé en cours...'
                });
                setPublishProgress(60);

                const refreshRes = await fetch('/api/tiktok/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const refreshData = await refreshRes.json();

                if (refreshRes.ok && refreshData.success) {
                    console.log("[TIKTOK PUBLISH] ✅ Silent Refresh réussi ! Seconde tentative de publication...");
                    setFeedbackMessage({ type: null, text: '' });
                    setPublishProgress(80);

                    // Re-tentative immédiate et transparente
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
                throw new Error(data.error || data.message || "Échec de transmission vers l'API TikTok.");
            }

            setPublishProgress(100);
            setFeedbackMessage({
                type: 'success',
                text: `🚀 Vidéo transmise avec succès à TikTok ! (ID tâche : ${data.publish_id || 'OK'})`
            });

            // Suppression du brouillon local après succès
            const storageKey = `aya_tiktok_draft_${mediaData.mp4_filename || 'current'}`;
            localStorage.removeItem(storageKey);

            if (onPublishSuccess) {
                onPublishSuccess(data);
            }

        } catch (err) {
            console.error("[TIKTOK PUBLISH ERROR]", err);
            setFeedbackMessage({ type: 'error', text: err.message });
        } finally {
            setIsPublishing(false);
        }
    };

    if (!isOpen) return null;

    // -------------------------------------------------------------------------
    // 4. RENDU JSX & DESIGN SYSTEM AYA STUDIO
    // -------------------------------------------------------------------------
    return (
        <div style={styles.backdrop}>
            <div style={styles.modalCard} role="dialog" aria-modal="true">
                
                {/* ============================================================= */}
                {/* EN-TÊTE DU MODAL                                              */}
                {/* ============================================================= */}
                <div style={styles.modalHeader}>
                    <div style={styles.headerTitleGroup}>
                        <div style={styles.tiktokLogoIcon}>📱</div>
                        <div>
                            <h2 style={styles.modalTitle}>Aya Studio — Pré-Publication TikTok</h2>
                            <p style={styles.modalSubtitle}>
                                Revue du rendu 9:16, validation du copywriting Nadine et diffusion directe
                            </p>
                        </div>
                    </div>

                    <div style={styles.headerRightGroup}>
                        {/* Indicateur Statut Compte TikTok */}
                        {tiktokAccount.loading ? (
                            <span style={styles.badgeLoading}>⏳ Connexion...</span>
                        ) : tiktokAccount.connected ? (
                            <div style={styles.accountBadge}>
                                {tiktokAccount.avatarUrl ? (
                                    <img src={tiktokAccount.avatarUrl} alt="Avatar" style={styles.accountAvatar} />
                                ) : (
                                    <span style={styles.accountAvatarPlaceholder}>👤</span>
                                )}
                                <span style={styles.accountName}>@{tiktokAccount.displayName}</span>
                                <span style={styles.accountCheck}>✓ Lié</span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConnectTikTok}
                                style={styles.btnConnectTikTok}
                                title="Lier votre compte TikTok officiel"
                            >
                                <span style={{ marginRight: '6px' }}>🔗</span> Lier mon compte TikTok
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            style={styles.btnClose}
                            title="Fermer la fenêtre"
                            disabled={isPublishing}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ============================================================= */}
                {/* CORPS PRINCIPAL : DEUX COLONNES FLUIDES                       */}
                {/* ============================================================= */}
                <div style={styles.modalBody}>
                    
                    {/* --------------------------------------------------------- */}
                    {/* COLONNE GAUCHE (40%) : LECTEUR 9:16 & SAFE ZONE           */}
                    {/* --------------------------------------------------------- */}
                    <div style={styles.leftColumn}>
                        <div style={styles.previewControls}>
                            <div style={styles.tabGroup}>
                                <button
                                    type="button"
                                    onClick={() => setPreviewTab('video')}
                                    style={previewTab === 'video' ? styles.tabBtnActive : styles.tabBtn}
                                >
                                    🎬 Vidéo (.ASS Incrusté)
                                </button>
                                {mediaData.cover_url && (
                                    <button
                                        type="button"
                                        onClick={() => setPreviewTab('cover')}
                                        style={previewTab === 'cover' ? styles.tabBtnActive : styles.tabBtn}
                                    >
                                        🖼️ Couverture 9:16
                                    </button>
                                )}
                            </div>

                            {previewTab === 'video' && (
                                <button
                                    type="button"
                                    onClick={() => setShowSafeZone(prev => !prev)}
                                    style={showSafeZone ? styles.safeZoneToggleActive : styles.safeZoneToggle}
                                    title="Activer/Désactiver le calque simulant l'interface native TikTok"
                                >
                                    {showSafeZone ? '👁️ Safe Zone : Active' : '👁️ Safe Zone : Masquée'}
                                </button>
                            )}
                        </div>

                        {/* Cadre de visualisation 9:16 smartphone */}
                        <div style={styles.phoneFrame}>
                            {previewTab === 'video' ? (
                                <div style={styles.videoRelativeWrapper}>
                                    <video
                                        ref={videoRef}
                                        src={mediaData.mp4_url}
                                        style={styles.videoPlayer}
                                        controls
                                        autoPlay
                                        loop
                                        playsInline
                                    />

                                    {/* CALQUE SAFE ZONE TIKTOK (OVERLAY SIMULATEUR) */}
                                    {showSafeZone && (
                                        <div style={styles.tiktokSafeZoneOverlay}>
                                            {/* Header TikTok (Recherche & Onglets) */}
                                            <div style={styles.tiktokUiTop}>
                                                <span>Suivis</span>
                                                <span style={{ fontWeight: '800', borderBottom: '2px solid #fff' }}>Pour toi</span>
                                                <span style={{ fontSize: '1.1rem' }}>🔍</span>
                                            </div>

                                            {/* BOÎTE DE DÉMARCATION DES SOUS-TITRES (SAFE AREA AUDIT ALEXANDRE) */}
                                            <div style={styles.subtitleSafeAreaBox}>
                                                <span style={styles.safeAreaLabel}>
                                                    Zone Sûre Sous-titres (.ass MarginV)
                                                </span>
                                            </div>

                                            {/* Rail d'icônes TikTok sur la droite */}
                                            <div style={styles.tiktokUiRightRail}>
                                                <div style={styles.tiktokRailItem}>
                                                    <div style={styles.tiktokAvatarWrap}>
                                                        <div style={styles.tiktokAvatarCircle}>A</div>
                                                        <div style={styles.tiktokPlusBadge}>+</div>
                                                    </div>
                                                </div>
                                                <div style={styles.tiktokRailItem}>
                                                    <span style={styles.tiktokIconEmoji}>❤️</span>
                                                    <span style={styles.tiktokIconCounter}>84.2K</span>
                                                </div>
                                                <div style={styles.tiktokRailItem}>
                                                    <span style={styles.tiktokIconEmoji}>💬</span>
                                                    <span style={styles.tiktokIconCounter}>1.4K</span>
                                                </div>
                                                <div style={styles.tiktokRailItem}>
                                                    <span style={styles.tiktokIconEmoji}>🔖</span>
                                                    <span style={styles.tiktokIconCounter}>9.8K</span>
                                                </div>
                                                <div style={styles.tiktokRailItem}>
                                                    <span style={styles.tiktokIconEmoji}>↗️</span>
                                                    <span style={styles.tiktokIconCounter}>3.2K</span>
                                                </div>
                                                <div style={styles.tiktokRailItem}>
                                                    <div style={styles.tiktokVinylDisc}>💿</div>
                                                </div>
                                            </div>

                                            {/* Zone texte et profil en bas */}
                                            <div style={styles.tiktokUiBottom}>
                                                <div style={styles.tiktokAuthor}>@aya.studio • 1h</div>
                                                <div style={styles.tiktokCaption}>
                                                    {title} ... <span style={{ color: '#94a3b8' }}>plus</span>
                                                </div>
                                                <div style={styles.tiktokAudio}>
                                                    <span>🎵</span> <span>Son original - Plateforme Aya Studio</span>
                                                </div>
                                            </div>

                                            {/* Barre de navigation inférieure */}
                                            <div style={styles.tiktokUiNavBottom}>
                                                <span>Accueil</span>
                                                <span>Amis</span>
                                                <span style={styles.tiktokPlusNav}>+</span>
                                                <span>Boîte</span>
                                                <span>Profil</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <img
                                    src={mediaData.cover_url}
                                    alt="Couverture 9:16 Lionel"
                                    style={styles.coverImage}
                                />
                            )}
                        </div>

                        {previewTab === 'video' && (
                            <p style={styles.safeZoneHint}>
                                💡 <b>Astuce Safe Zone :</b> Vos sous-titres incrustés doivent rester visibles au centre sans empiéter sur le texte du bas ni le rail d'icônes à droite.
                            </p>
                        )}
                    </div>

                    {/* --------------------------------------------------------- */}
                    {/* COLONNE DROITE (60%) : ÉDITEUR MÉDONNÉES & PARAMÈTRES     */}
                    {/* --------------------------------------------------------- */}
                    <div style={styles.rightColumn}>
                        
                        {/* Titre Sémantique */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>
                                🏷️ Titre de la Publication (Accroche Visuelle)
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={styles.inputTitle}
                                placeholder="Ex: Face à l'Interrogatoire"
                                maxLength={100}
                                disabled={isPublishing}
                            />
                        </div>

                        {/* Description TikTok Nadine */}
                        <div style={styles.formGroup}>
                            <div style={styles.labelWithCounter}>
                                <label style={styles.label}>
                                    📝 Smart Description SEO TikTok (Copywriting Nadine)
                                </label>
                                <span style={isOverLimit ? styles.counterDanger : charCount > 1800 ? styles.counterWarning : styles.counterOk}>
                                    {charCount.toLocaleString()} / {MAX_TIKTOK_CHARS} car.
                                </span>
                            </div>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                style={isOverLimit ? styles.textareaDanger : styles.textarea}
                                rows={13}
                                placeholder="Rédigez ou ajustez votre description TikTok..."
                                disabled={isPublishing}
                            />
                        </div>

                        {/* Paramètres de Confidentialité & Interactions */}
                        <div style={styles.settingsGrid}>
                            <div style={styles.formGroup}>
                                <label style={styles.subLabel}>👁️ Confidentialité</label>
                                <select
                                    value={privacyLevel}
                                    onChange={(e) => setPrivacyLevel(e.target.value)}
                                    style={styles.select}
                                    disabled={isPublishing}
                                >
                                    <option value="PUBLIC_TO_EVERYONE">🌍 Tout le monde (Public)</option>
                                    <option value="MUTUAL_FOLLOW_FRIENDS">👥 Amis mutuels uniquement</option>
                                    <option value="SELF_ONLY">🔒 Privé (Moi uniquement)</option>
                                </select>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.subLabel}>⚙️ Interactions Utilisateurs</label>
                                <div style={styles.checkboxGroup}>
                                    <label style={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={allowComment}
                                            onChange={(e) => setAllowComment(e.target.checked)}
                                            disabled={isPublishing}
                                        />
                                        <span>Commentaires</span>
                                    </label>
                                    <label style={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={allowDuet}
                                            onChange={(e) => setAllowDuet(e.target.checked)}
                                            disabled={isPublishing}
                                        />
                                        <span>Duos</span>
                                    </label>
                                    <label style={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={allowStitch}
                                            onChange={(e) => setAllowStitch(e.target.checked)}
                                            disabled={isPublishing}
                                        />
                                        <span>Collages</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Bannière de Notification / Feedback Utilisateur */}
                        {feedbackMessage.text && (
                            <div style={
                                feedbackMessage.type === 'success' ? styles.alertSuccess :
                                feedbackMessage.type === 'warning' ? styles.alertWarning :
                                styles.alertError
                            }>
                                <span>{feedbackMessage.type === 'success' ? '✅' : feedbackMessage.type === 'warning' ? '⚠️' : '❌'}</span>
                                <span>{feedbackMessage.text}</span>
                            </div>
                        )}

                        {/* Progression pendant la publication */}
                        {isPublishing && (
                            <div style={styles.progressContainer}>
                                <div style={styles.progressTrack}>
                                    <div style={{ ...styles.progressBar, width: `${publishProgress}%` }} />
                                </div>
                                <span style={styles.progressText}>
                                    {publishProgress < 50 ? 'Préparation et validation de la vidéo...' : 'Envoi vers l\'API TikTok Content Posting...'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================================= */}
                {/* FOOTER D'ACTION : BROUILLON, ANNULER, PUBLIER                 */}
                {/* ============================================================= */}
                <div style={styles.modalFooter}>
                    <div style={styles.footerLeft}>
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            style={styles.btnDraft}
                            disabled={isPublishing}
                        >
                            💾 {draftStatus === 'saved' ? 'Brouillon sauvegardé !' : 'Enregistrer en Brouillon'}
                        </button>
                        {draftStatus === 'restored' && (
                            <span style={styles.draftRestoredBadge}>✨ Brouillon local restauré</span>
                        )}
                    </div>

                    <div style={styles.footerRight}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={styles.btnCancel}
                            disabled={isPublishing}
                        >
                            Annuler
                        </button>

                        <button
                            type="button"
                            onClick={handlePublish}
                            disabled={isPublishing || isOverLimit || !tiktokAccount.connected}
                            style={
                                isPublishing || isOverLimit || !tiktokAccount.connected
                                    ? styles.btnPublishDisabled
                                    : styles.btnPublish
                            }
                        >
                            {isPublishing ? (
                                <><span>⏳</span> Publication en cours...</>
                            ) : (
                                <><span>🚀</span> Valider & Publier sur TikTok</>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// 5. FEUILLE DE STYLES INLINE (DESIGN SYSTEM AYA STUDIO)
// -----------------------------------------------------------------------------
const styles = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflowY: 'auto'
    },
    modalCard: {
        width: '100%',
        maxWidth: '1180px',
        maxHeight: '92vh',
        backgroundColor: '#1e293b',
        color: '#f8fafc',
        borderRadius: '18px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    modalHeader: {
        padding: '1.1rem 1.6rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a'
    },
    headerTitleGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem'
    },
    tiktokLogoIcon: {
        fontSize: '1.8rem',
        lineHeight: 1
    },
    modalTitle: {
        margin: 0,
        fontSize: '1.15rem',
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: '-0.02em'
    },
    modalSubtitle: {
        margin: '0.2rem 0 0 0',
        fontSize: '0.82rem',
        color: '#94a3b8'
    },
    headerRightGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem'
    },
    accountBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid #10b981',
        padding: '0.35rem 0.75rem',
        borderRadius: '20px',
        fontSize: '0.82rem'
    },
    accountAvatar: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        objectFit: 'cover'
    },
    accountAvatarPlaceholder: {
        fontSize: '0.85rem'
    },
    accountName: {
        fontWeight: '700',
        color: '#f8fafc'
    },
    accountCheck: {
        color: '#10b981',
        fontWeight: '800',
        fontSize: '0.78rem'
    },
    badgeLoading: {
        fontSize: '0.8rem',
        color: '#94a3b8'
    },
    btnConnectTikTok: {
        backgroundColor: '#fe2c55',
        color: '#ffffff',
        border: 'none',
        padding: '0.45rem 0.95rem',
        borderRadius: '8px',
        fontWeight: '700',
        fontSize: '0.82rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'transform 0.15s ease'
    },
    btnClose: {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '1.25rem',
        cursor: 'pointer',
        padding: '0.3rem 0.6rem',
        borderRadius: '6px',
        transition: 'color 0.2s'
    },
    modalBody: {
        display: 'flex',
        flexDirection: 'row',
        gap: '1.75rem',
        padding: '1.5rem 1.6rem',
        overflowY: 'auto'
    },
    leftColumn: {
        flex: '0 0 380px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem'
    },
    previewControls: {
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    tabGroup: {
        display: 'flex',
        gap: '0.35rem',
        backgroundColor: '#0f172a',
        padding: '0.2rem',
        borderRadius: '8px'
    },
    tabBtn: {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        padding: '0.3rem 0.65rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'pointer'
    },
    tabBtnActive: {
        backgroundColor: '#0b5394',
        border: 'none',
        color: '#ffffff',
        padding: '0.3rem 0.65rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '700',
        cursor: 'pointer'
    },
    safeZoneToggle: {
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        color: '#94a3b8',
        padding: '0.3rem 0.65rem',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: '600',
        cursor: 'pointer'
    },
    safeZoneToggleActive: {
        background: 'rgba(0, 188, 212, 0.18)',
        border: '1px solid #00bcd4',
        color: '#00bcd4',
        padding: '0.3rem 0.65rem',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: '700',
        cursor: 'pointer'
    },
    phoneFrame: {
        width: '280px',
        height: '497px', // Ratio 9:16 exact (280 x 497.7)
        backgroundColor: '#000000',
        borderRadius: '24px',
        border: '4px solid #334155',
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.45)',
        overflow: 'hidden',
        position: 'relative'
    },
    videoRelativeWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000'
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    coverImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    tiktokSafeZoneOverlay: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 10px 8px 10px',
        boxSizing: 'border-box'
    },
    tiktokUiTop: {
        display: 'flex',
        justifyContent: 'center',
        gap: '14px',
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.9)',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
    },
    subtitleSafeAreaBox: {
        position: 'absolute',
        top: '25%',
        bottom: '25%',
        left: '8%',
        right: '22%',
        border: '1.5px dashed rgba(0, 188, 212, 0.75)',
        borderRadius: '8px',
        backgroundColor: 'rgba(0, 188, 212, 0.04)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '4px'
    },
    safeAreaLabel: {
        fontSize: '0.58rem',
        color: '#00bcd4',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        padding: '2px 4px',
        borderRadius: '3px'
    },
    tiktokUiRightRail: {
        position: 'absolute',
        right: '6px',
        bottom: '80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
    },
    tiktokRailItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px'
    },
    tiktokAvatarWrap: {
        position: 'relative'
    },
    tiktokAvatarCircle: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        backgroundColor: '#0b5394',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        border: '1.5px solid #fff'
    },
    tiktokPlusBadge: {
        position: 'absolute',
        bottom: '-4px',
        left: '8px',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: '#fe2c55',
        color: '#fff',
        fontSize: '0.65rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold'
    },
    tiktokIconEmoji: {
        fontSize: '1.1rem',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
    },
    tiktokIconCounter: {
        fontSize: '0.62rem',
        color: '#ffffff',
        fontWeight: '700',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
    },
    tiktokVinylDisc: {
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        backgroundColor: '#111',
        border: '3px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem'
    },
    tiktokUiBottom: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '78%',
        marginBottom: '26px'
    },
    tiktokAuthor: {
        fontWeight: '800',
        fontSize: '0.75rem',
        color: '#fff',
        textShadow: '0 1px 3px rgba(0,0,0,0.9)'
    },
    tiktokCaption: {
        fontSize: '0.65rem',
        color: '#e2e8f0',
        lineHeight: 1.3,
        textShadow: '0 1px 2px rgba(0,0,0,0.9)'
    },
    tiktokAudio: {
        fontSize: '0.6rem',
        color: '#cbd5e1',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    tiktokUiNavBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '24px',
        backgroundColor: 'rgba(0,0,0,0.9)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        fontSize: '0.58rem',
        color: '#94a3b8'
    },
    tiktokPlusNav: {
        backgroundColor: '#fff',
        color: '#000',
        padding: '1px 6px',
        borderRadius: '4px',
        fontWeight: '900',
        fontSize: '0.7rem'
    },
    safeZoneHint: {
        fontSize: '0.72rem',
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 1.4,
        margin: 0
    },
    rightColumn: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
    },
    label: {
        fontSize: '0.85rem',
        fontWeight: '700',
        color: '#e2e8f0'
    },
    subLabel: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#94a3b8'
    },
    labelWithCounter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    counterOk: {
        fontSize: '0.78rem',
        fontWeight: '700',
        color: '#10b981'
    },
    counterWarning: {
        fontSize: '0.78rem',
        fontWeight: '700',
        color: '#f59e0b'
    },
    counterDanger: {
        fontSize: '0.78rem',
        fontWeight: '800',
        color: '#ef4444',
        animation: 'pulse 1s infinite'
    },
    inputTitle: {
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#f8fafc',
        padding: '0.65rem 0.85rem',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontWeight: '600',
        outline: 'none'
    },
    textarea: {
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#f8fafc',
        padding: '0.85rem',
        borderRadius: '10px',
        fontSize: '0.86rem',
        lineHeight: 1.6,
        resize: 'vertical',
        outline: 'none',
        fontFamily: 'inherit'
    },
    textareaDanger: {
        backgroundColor: '#0f172a',
        border: '1.5px solid #ef4444',
        color: '#f8fafc',
        padding: '0.85rem',
        borderRadius: '10px',
        fontSize: '0.86rem',
        lineHeight: 1.6,
        resize: 'vertical',
        outline: 'none',
        fontFamily: 'inherit'
    },
    settingsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        backgroundColor: '#0f172a',
        padding: '0.85rem',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
    },
    select: {
        backgroundColor: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        color: '#f8fafc',
        padding: '0.5rem',
        borderRadius: '6px',
        fontSize: '0.82rem',
        outline: 'none',
        cursor: 'pointer'
    },
    checkboxGroup: {
        display: 'flex',
        gap: '0.85rem',
        alignItems: 'center',
        height: '100%'
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.8rem',
        color: '#e2e8f0',
        cursor: 'pointer'
    },
    alertSuccess: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid #10b981',
        color: '#34d399',
        padding: '0.65rem 0.85rem',
        borderRadius: '8px',
        fontSize: '0.84rem'
    },
    alertWarning: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid #f59e0b',
        color: '#fbbf24',
        padding: '0.65rem 0.85rem',
        borderRadius: '8px',
        fontSize: '0.84rem'
    },
    alertError: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid #ef4444',
        color: '#f87171',
        padding: '0.65rem 0.85rem',
        borderRadius: '8px',
        fontSize: '0.84rem'
    },
    progressContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
    },
    progressTrack: {
        width: '100%',
        height: '6px',
        backgroundColor: '#0f172a',
        borderRadius: '3px',
        overflow: 'hidden'
    },
    progressBar: {
        height: '100%',
        background: 'linear-gradient(90deg, #0b5394, #00bcd4, #fe2c55)',
        transition: 'width 0.3s ease'
    },
    progressText: {
        fontSize: '0.75rem',
        color: '#94a3b8',
        textAlign: 'center'
    },
    modalFooter: {
        padding: '1rem 1.6rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a'
    },
    footerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
    },
    footerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem'
    },
    btnDraft: {
        backgroundColor: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#e2e8f0',
        padding: '0.6rem 1.1rem',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.85rem',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    },
    draftRestoredBadge: {
        fontSize: '0.75rem',
        color: '#00bcd4'
    },
    btnCancel: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#94a3b8',
        padding: '0.6rem 1rem',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.85rem',
        cursor: 'pointer'
    },
    btnPublish: {
        background: 'linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)',
        border: 'none',
        color: '#ffffff',
        padding: '0.65rem 1.4rem',
        borderRadius: '8px',
        fontWeight: '800',
        fontSize: '0.9rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: '0 4px 15px rgba(254, 44, 85, 0.35)',
        transition: 'transform 0.15s ease'
    },
    btnPublishDisabled: {
        backgroundColor: '#334155',
        border: 'none',
        color: '#64748b',
        padding: '0.65rem 1.4rem',
        borderRadius: '8px',
        fontWeight: '700',
        fontSize: '0.9rem',
        cursor: 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    }
};
