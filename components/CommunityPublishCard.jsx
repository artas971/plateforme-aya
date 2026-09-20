import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 🌍 CommunityPublishCard.jsx - Composant d'Auto-Hydratation & Publication Mur Communautaire
 * 
 * Rôles & Spécifications (Ticket UX Lionel) :
 * - Réceptionne l'état complet depuis React Router : `navigate('/communaute', { state: { description, videoUrl, videoFile, title, coverUrl } })`
 * - Fallback transparent vers `sessionStorage` ('aya_share_to_community') si navigation inter-pages hors SPA
 * - Auto-Hydratation immédiate : affichage de la vidéo traduite (.ass incrusté) dans le player 9:16
 * - Auto-remplissage du champ texte avec la Smart Description de Nadine
 * - Bouton discret "🔄 Remplacer la vidéo" : purge le state média et réaffiche le sélecteur standard de fichier
 * - Soumission vers l'API /api/posts avec support direct de mediaUrl ou File uploadé
 * 
 * @author Agent Lionel (Lead Frontend React & UI/UX Designer)
 */
export default function CommunityPublishCard({ onPostCreated }) {
    const location = useLocation();
    const navigate = useNavigate();

    // -------------------------------------------------------------------------
    // 1. ÉTATS DU FORMULAIRE
    // -------------------------------------------------------------------------
    const [authorName, setAuthorName] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');

    // Média : peut être une URL locale (/download/...) ou un File issu de l'upload local
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaThumbnail, setMediaThumbnail] = useState('');
    const [mediaFilename, setMediaFilename] = useState('');

    // UI & Feedback
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', title, message }
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef(null);
    const videoRef = useRef(null);

    // -------------------------------------------------------------------------
    // 2. AUTO-HYDRATATION DU STATE (REACT ROUTER + SESSION STORAGE)
    // -------------------------------------------------------------------------
    useEffect(() => {
        let initialData = null;

        // A. Priorité 1 : State de React Router
        if (location && location.state) {
            initialData = location.state;
            console.log('⚡ [LIONEL REACT] State intercepté via React Router location.state :', initialData);
        }

        // B. Priorité 2 : State de repli sessionStorage (cross-page / multi-onglets)
        if (!initialData) {
            try {
                const stored = sessionStorage.getItem('aya_share_to_community');
                if (stored) {
                    initialData = JSON.parse(stored);
                    sessionStorage.removeItem('aya_share_to_community');
                    console.log('⚡ [LIONEL REACT] State intercepté via sessionStorage :', initialData);
                }
            } catch (err) {
                console.warn('⚠️ [LIONEL REACT] Erreur lecture sessionStorage :', err);
            }
        }

        // Hydratation si des données ont été détectées
        if (initialData) {
            if (initialData.description) {
                setContent(initialData.description);
            }
            if (initialData.title) {
                setTags(initialData.title);
            }
            if (initialData.videoUrl) {
                setMediaUrl(initialData.videoUrl);
                setMediaFilename(initialData.videoFilename || initialData.title || 'Vidéo sous-titrée');
            }
            if (initialData.videoFile) {
                setMediaFile(initialData.videoFile);
                setMediaUrl(URL.createObjectURL(initialData.videoFile));
                setMediaFilename(initialData.videoFile.name);
            }
            if (initialData.coverUrl) {
                setMediaThumbnail(initialData.coverUrl);
            }

            // Nettoyage de l'historique React Router pour éviter de ré-hydrater sur simple refresh F5
            if (location.state) {
                navigate(location.pathname, { replace: true, state: null });
            }
        }
    }, [location, navigate]);

    // -------------------------------------------------------------------------
    // 3. GESTION DU REMPLACEMENT ET RETRAIT DU MÉDIA
    // -------------------------------------------------------------------------
    const handleReplaceMedia = (e) => {
        if (e) e.preventDefault();
        // Vider l'état média complet
        setMediaUrl('');
        setMediaFile(null);
        setMediaThumbnail('');
        setMediaFilename('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        console.log('🔄 [LIONEL REACT] Média réinitialisé : affichage de la dropzone standard.');
    };

    const handleFileChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            setMediaFile(file);
            setMediaUrl(URL.createObjectURL(file));
            setMediaFilename(file.name);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
            setMediaFile(file);
            setMediaUrl(URL.createObjectURL(file));
            setMediaFilename(file.name);
        }
    };

    // -------------------------------------------------------------------------
    // 4. SOUMISSION DU FORMULAIRE (POST /api/posts)
    // -------------------------------------------------------------------------
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() && !mediaUrl && !mediaFile) {
            setFeedback({
                type: 'error',
                title: 'Attention',
                message: 'Veuillez renseigner un texte explicatif ou sélectionner un média.'
            });
            return;
        }

        setIsSubmitting(true);
        setFeedback(null);

        try {
            const formData = new FormData();
            formData.append('originalContent', content.trim());
            if (authorName.trim()) formData.append('authorName', authorName.trim());
            if (tags.trim()) formData.append('tags', tags.trim());

            if (mediaFile) {
                // Fichier physique local uploadé
                formData.append('media', mediaFile);
            } else if (mediaUrl) {
                // URL de la vidéo déjà générée dans Aya (/download/...)
                formData.append('mediaUrl', mediaUrl);
                if (mediaThumbnail) {
                    formData.append('mediaThumbnail', mediaThumbnail);
                }
            }

            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erreur lors de la soumission du témoignage.');
            }

            setFeedback({
                type: 'success',
                title: '✅ Témoignage soumis avec succès !',
                message: 'Votre publication a été transmise avec succès. Elle est actuellement en cours d\'examen par l\'équipe de modération (statut : En attente) avant sa mise en ligne.'
            });

            // Réinitialisation du formulaire
            setContent('');
            setTags('');
            handleReplaceMedia();

            if (onPostCreated) {
                onPostCreated(result.post);
            }
        } catch (err) {
            console.error('❌ [LIONEL REACT] Erreur soumission :', err);
            setFeedback({
                type: 'error',
                title: 'Erreur de publication',
                message: err.message || 'Une erreur inattendue est survenue.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="publish-card" style={styles.card}>
            <div style={styles.header}>
                <div style={styles.icon}>📢</div>
                <div>
                    <h2 style={styles.title}>Partager un témoignage</h2>
                    <p style={styles.sub}>
                        Publiez une vidéo ou un audio traduit avec sa Smart Description. Tout contenu est vérifié avant mise en ligne.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.grid}>
                    {/* Auteur */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>👤 Votre nom ou pseudonyme :</label>
                        <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="Ex: Alex, Sarah, Un témoin de Gaza..."
                            maxLength={80}
                            style={styles.input}
                        />
                    </div>

                    {/* Mots-clés / Hashtags */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>🏷️ Mots-clés / Hashtags :</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="Ex: Gaza, Temoignage, Espoir, Justice"
                            style={styles.input}
                        />
                    </div>

                    {/* Zone Média : Auto-Hydratée ou Dropzone */}
                    <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
                        <label style={styles.label}>🎬 Fichier média (Vidéo MP4 ou Audio) :</label>

                        {mediaUrl ? (
                            /* Lecteur Preview Auto-Hydraté avec bouton Remplacer */
                            <div style={styles.previewContainer}>
                                <button
                                    type="button"
                                    onClick={handleReplaceMedia}
                                    style={styles.btnRemoveCorner}
                                    title="Retirer ce fichier"
                                >
                                    &times;
                                </button>

                                <video
                                    ref={videoRef}
                                    src={mediaUrl}
                                    controls
                                    playsInline
                                    style={styles.videoPlayer}
                                />

                                <div style={styles.previewBar}>
                                    <div style={styles.previewInfo}>
                                        <span style={styles.previewBadge}>
                                            🎬 {mediaFile ? 'Fichier sélectionné' : 'Vidéo traduite (.ass incrusté)'}
                                        </span>
                                        <span style={styles.previewName}>{mediaFilename}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleReplaceMedia}
                                        style={styles.btnReplace}
                                    >
                                        <span>🔄</span>
                                        <span>Remplacer la vidéo</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Dropzone standard si aucun média n'est chargé */
                            <div
                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                                style={{
                                    ...styles.dropzone,
                                    borderColor: isDragOver ? '#00bcd4' : 'rgba(255, 255, 255, 0.15)',
                                    background: isDragOver ? 'rgba(0, 188, 212, 0.08)' : 'rgba(15, 23, 42, 0.6)'
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="video/*,audio/*"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📁</div>
                                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>
                                    Glissez-déposez une vidéo MP4 ou cliquez pour parcourir vos fichiers
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                    Formats acceptés : MP4, MOV, WEBM, MP3, WAV (jusqu'à 500 Mo)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Texte / Smart Description */}
                    <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
                        <label style={styles.label}>📝 Smart Description & Témoignage (Texte complet) :</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Collez ici la Smart Description générée ou décrivez la scène..."
                            rows={6}
                            required
                            style={styles.textarea}
                        />
                    </div>
                </div>

                <div style={styles.actions}>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            ...styles.btnSubmit,
                            opacity: isSubmitting ? 0.7 : 1,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <span>{isSubmitting ? '⏳' : '🚀'}</span>
                        <span>{isSubmitting ? 'Envoi en cours...' : 'Publier le témoignage'}</span>
                    </button>
                </div>
            </form>

            {/* Bannière Feedback Zéro-JSON */}
            {feedback && (
                <div style={{
                    ...styles.feedbackBanner,
                    background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    borderColor: feedback.type === 'success' ? '#a7f3d0' : '#fecaca',
                    color: feedback.type === 'success' ? '#065f46' : '#991b1b'
                }}>
                    <span style={{ fontSize: '1.4rem' }}>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
                    <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>{feedback.title}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>{feedback.message}</p>
                    </div>
                </div>
            )}
        </section>
    );
}

// -------------------------------------------------------------------------
// STYLES INLINE THÈME AYA STUDIO
// -------------------------------------------------------------------------
const styles = {
    card: {
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        color: '#f8fafc'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '16px'
    },
    icon: {
        fontSize: '2rem',
        background: 'rgba(0, 188, 212, 0.15)',
        border: '1px solid rgba(0, 188, 212, 0.3)',
        padding: '8px 12px',
        borderRadius: '12px'
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: 700,
        margin: '0 0 4px 0',
        color: '#ffffff'
    },
    sub: {
        fontSize: '0.85rem',
        color: '#94a3b8',
        margin: 0
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    label: {
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#cbd5e1'
    },
    input: {
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#f8fafc',
        fontSize: '0.9rem',
        outline: 'none'
    },
    textarea: {
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '10px',
        padding: '12px 14px',
        color: '#f8fafc',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        outline: 'none',
        resize: 'vertical'
    },
    dropzone: {
        border: '2px dashed rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '30px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    previewContainer: {
        position: 'relative',
        background: '#000000',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.15)'
    },
    btnRemoveCorner: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(239, 68, 68, 0.85)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        fontSize: '1.2rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },
    videoPlayer: {
        width: '100%',
        maxHeight: '340px',
        display: 'block',
        background: '#000'
    },
    previewBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },
    previewInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflow: 'hidden'
    },
    previewBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: 'rgba(0, 188, 212, 0.15)',
        color: '#00bcd4',
        border: '1px solid rgba(0, 188, 212, 0.3)'
    },
    previewName: {
        fontSize: '0.85rem',
        color: '#e2e8f0',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '280px'
    },
    btnReplace: {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#f1f5f9',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease'
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '8px'
    },
    btnSubmit: {
        background: 'linear-gradient(135deg, #0b5394 0%, #00bcd4 100%)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        padding: '12px 24px',
        fontSize: '0.95rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 15px rgba(0, 188, 212, 0.3)',
        transition: 'all 0.2s ease'
    },
    feedbackBanner: {
        marginTop: '16px',
        padding: '14px 18px',
        borderRadius: '10px',
        border: '1px solid',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
    }
};
