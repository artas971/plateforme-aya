/**
 * Module Internationalisation Globale (i18n) & Navbar Partagée - Plateforme Aya
 * - Thomas (Architecte) : Mécanique i18n, persistance localStorage, navbar partagée
 * - Nadine (Linguiste)  : Dictionnaire de traduction arabe palestinien soigné & naturel
 * - Lionel (Graphiste)  : Bascule dynamique dir="rtl" / dir="ltr"
 */

(function () {
    // 1. Dictionnaire Nadine Bilingue Complet (Français / Arabe Palestinien)
    const translations = {
        fr: {
            dir: 'ltr',
            // Navbar Globale
            navbarBrandTitle: 'Aya Studio',
            navbarBrandSub: 'Studio de doublage, transcription et synchronisation instantanée',
            userConnectedPrefix: '👤 Connecté :',
            userAnonymous: 'Invité / Testeur',
            logoutBtnTitle: 'Se déconnecter',
            navHomeText: 'Direct',
            navTraducteurText: 'Traducteur',
            navTraductionText: 'Traduction',
            navStudioText: 'Studio Vidéo',
            navCommunauteText: 'Communauté',
            navModerationText: 'Modération',
            navProfilText: 'Profil',
            navbarLiveText: 'Actif',
            // Nouveaux termes vulgarisés Grand Public
            navExchangeText: 'Salon d\'Échange',
            navCreationText: 'Outils de Création',
            navCreationSub: 'Traductions, vidéos et fiches éducatives',
            navTranslationText: 'Traducteur Shami',
            navTranslationSub: 'Traduction instantanée texte et audio',
            navVideoText: 'Création Vidéo',
            navVideoSub: 'Doublage et sous-titrage automatique',
            navCardsText: 'Fiches Éducatives',
            navCardsSub: 'Affiches bilingues & audio TikTok',
            navCommunityText: 'Galerie Communautaire',
            navCommunitySub: 'Témoignages et partages collectifs',
            navAccountText: 'Mon Compte',
            navProfileText: 'Mon Profil',
            navWalletText: 'Mon Portefeuille & Crédits',
            navCreationsText: 'Mes Créations & Historique',
            navAdminText: 'Tour de Contrôle',
            navLogoutText: 'Déconnexion',
            navOnlineText: 'en ligne',
            navCreateActionText: 'Créer',
            navCloseSheetText: 'Fermer',

            // Page Modération Back-Office (Phase 2.5)
            moderationDocTitle: 'AYA Back-Office | Modération des Témoignages',
            moderationHeaderTitle: 'File d\'Attente de Modération',
            moderationHeaderSub: 'Validez les témoignages pour diffusion publique ou archivez les contenus non conformes.',
            moderationPendingStat: 'En Attente',
            moderationApprovedStat: 'Approuvés',
            moderationRejectedStat: 'Rejetés',
            moderationEmptyTitle: 'File de modération vide',
            moderationEmptySub: 'Tous les témoignages ont été traités. Les nouveaux posts soumis apparaîtront automatiquement ici.',
            btnApprovePost: '✅ Approuver & Publier',
            btnRejectPost: '❌ Rejeter',
            toastApproveSuccess: '✅ Témoignage approuvé ! Il est désormais visible sur le Mur Communautaire.',
            toastRejectSuccess: '❌ Témoignage rejeté et archivé hors du mur public.',

            // Page Mur Communautaire (Phase 2 - Issue #10)
            communauteDocTitle: 'Aya - Mur Communautaire des Témoignages',
            communauteHeroTitle: 'Mur Communautaire des Témoignages',
            communauteHeroSub: 'Espace d\'expression, de diffusion et de mémoire collective. Découvrez et partagez des témoignages sous-titrés authentiques.',
            heroPostsLabel: 'Témoignages Partagés',
            publishCardTitle: '📢 Partager un témoignage',
            publishCardSub: 'Publiez une vidéo ou un audio traduit avec sa Smart Description. Tout contenu est vérifié par l\'équipe avant mise en ligne.',
            labelPublishAuthor: 'Votre nom ou pseudonyme :',
            placeholderPublishAuthor: 'Ex: Alex, Sarah, Un témoin de Gaza...',
            labelPublishMedia: 'Fichier média (Vidéo ou Audio) :',
            publishMediaHint: 'Glissez une vidéo MP4 ou un audio (ou utilisez un média déjà généré dans le Studio)',
            labelPublishText: 'Smart Description & Témoignage (Texte complet) :',
            placeholderPublishText: 'Collez ici la Smart Description générée ou décrivez la scène, le contexte et les paroles...',
            labelPublishTags: 'Mots-clés / Hashtags (séparés par des virgules ou espaces) :',
            placeholderPublishTags: 'Ex: Gaza, Temoignage, Espoir, Justice',
            btnPublishSubmit: '<span>🚀</span> Publier le témoignage',
            btnPublishSubmitting: '<span>⏳</span> Envoi et validation en cours...',
            btnReplaceMediaText: 'Remplacer la vidéo',
            publishSuccessTitle: '✅ Témoignage soumis avec succès !',
            publishSuccessMsg: 'Votre publication a été transmise avec succès. Elle est actuellement en cours d\'examen par l\'équipe de modération (statut : En attente) avant sa mise en ligne sur le mur public.',
            feedSectionTitle: '✨ Témoignages Publiés',
            placeholderSearch: 'Rechercher par mot-clé, témoin, tag...',
            feedEmptyTitle: 'Aucun témoignage publié pour le moment',
            feedEmptySub: 'Soyez le premier à partager une vidéo sous-titrée sur le Mur Communautaire !',
            postPendingBadge: '⏳ En attente de modération',
            postApprovedBadge: '✅ Vérifié & Approuvé',
            btnLikePost: '❤️ J\'aime',
            btnSharePost: '🔗 Partager',
            btnCopyPost: '📋 Copier le texte',

            // Page Traduction & Studio
            pageDocTitle: 'Aya Studio V3 - Sous-titrage Automatique Haute Précision',
            pageIntroTitle: 'Sous-titrage Automatique Haute Précision',
            pageIntroSub: 'Glissez votre fichier audio ou vidéo, choisissez la langue cible et générez votre média sous-titré.',

            // Zone Dépose Média & Import Telegram
            dropZoneText: 'Glissez & Déposez votre fichier média ici',
            dropZoneSub: 'ou cliquez pour parcourir vos dossiers (Audio ou Vidéo jusqu\'à 500 Mo)',
            btnRemoveFileTitle: 'Retirer ce fichier',
            uploadOrDivider: 'OU',
            placeholderTelegramUrl: '🔗 Ou coller un lien public Telegram (ex: t.me/canal/123)...',
            btnPasteTelegramTitle: 'Coller depuis le presse-papier',
            telegramHint: '✈️ Importation et sous-titrage automatique depuis tout canal ou message Telegram public.',
            alertNoMediaOrTelegram: 'Veuillez sélectionner un fichier média ou renseigner un lien Telegram public valide.',

            // Mode de traitement (Module 1 vs Module 2)
            labelProcessingMode: '0. Mode de traitement',
            modeVideoTitle: '🎬 Vidéo Complète',
            modeVideoSub: 'Vidéo complète avec sous-titres animés (Format TikTok / Réels)',
            modeExpressTitle: '⚡ Mode Express (Texte Uniquement)',
            modeExpressSub: 'Traduction directe en texte Markdown (< 5s)',

            // Restitution Express
            expressResultTitle: '<span>⚡</span> Traduction Texte Express prête',
            expressSubTitle: 'Traduction rapide du texte uniquement (Lecture et copie immédiates)',
            btnCopyText: '📋 Copier le texte',
            btnCopied: '✅ Copié !',
            btnDownloadMarkdown: '⬇️ Télécharger le Markdown (.md)',
            labelFullText: '📜 Texte Traduit Intégral',
            labelTimestamps: '⏱️ Découpage Horodaté',

            // Sélecteur Langue Source
            labelSourceLang: '1. Langue parlée d\'origine (Source)',
            sourceAutoTitle: 'Détection Automatique',
            sourceAutoSub: 'Détecte automatiquement la voix parlée',
            sourceArTitle: 'Arabe palestinien',
            sourceArSub: 'Dialecte ammiya / Gaza',
            sourceFrTitle: 'Français',
            sourceFrSub: 'Discours original en français',

            // Sélecteur Langue Cible
            labelTargetLang: '2. Langue cible des sous-titres',
            targetFrTitle: 'Français (Sous-titres en français)',
            targetFrSub: 'Sous-titres traduits ou retranscrits en français',
            targetArTitle: 'Arabe (Sous-titres en arabe)',
            targetArSub: 'Sous-titres transcrits en arabe authentique',

            // Style & Couleur
            labelSubColor: '3. Style & Couleur des sous-titres',
            colorYellowTitle: '🟡 Jaune Éclatant',
            colorYellowSub: 'Style officiel TikTok / Reels',
            colorWhiteTitle: '⚪ Blanc Moderne',
            colorWhiteSub: 'Classique & Épuré',
            colorGreenTitle: '🟢 Vert Émeraude',
            colorGreenSub: 'Contraste dynamique',
            colorCyanTitle: '🔵 Cyan Électrique',
            colorCyanSub: 'Style moderne néon',

            // Position Verticale
            labelSubPosition: '4. Position des sous-titres',
            posBottomTitle: '⬇️ Bas (950)',
            posBottomSub: 'Format standard TikTok/Reels',
            posMidTitle: '↕️ Milieu (500)',
            posMidSub: 'Centre de l\'écran',
            posTopTitle: '⬆️ Haut (150)',
            posTopSub: 'Sous l\'en-tête',

            // Choix du Visuel pour Audios
            labelBgTheme: '5. Choix du visuel (Notes vocales & Audios purs uniquement)',
            audioNoticeBadge: '✨ Vidéo verticale automatique pour audios',
            bgPalestineTitle: '🇵🇸 Palestine Résilience',
            bgPalestineSub: 'Noir, Blanc, Vert, Rouge abstrait',
            bgDarkTitle: '🌑 Noir Profond',
            bgDarkSub: 'Minimaliste & contraste OLED',
            bgTurquoiseTitle: '🌊 Turquoise Espoir',
            bgTurquoiseSub: 'Couleur officielle Aya #00bcd4',
            bgTemoignageTitle: '🎙️ Témoignage Sobre',
            bgTemoignageSub: 'Cadre solennel pour récits',

            // Bouton Action & Options
            btnSubmitDefault: '<span>⚡</span> Lancer le traitement & le sous-titrage',
            btnSubmitLoading: '<span>⏳</span> Traitement du média en cours...',
            chkForceReprocess: '🔄 Forcer le retraitement (Ignorer le cache)',
            chkTiktokPackText: 'Générer le Pack TikTok (Vignette & Textes)',
            chkTiktokPackSub: 'Optionnel : Vignette de couverture & Rédaction optimisée SEO',

            // Progression
            statusInit: '✨ Préparation de votre vidéo...',
            logConnected: 'Connexion au serveur établie...',

            // Résultats & Téléchargements
            resultStatusReady: '<span>✅</span> Vidéo sous-titrée disponible',
            successTitleVideo: 'Vidéo générée avec succès !',
            successSubtitleVideo: 'Votre média est prêt à être prévisualisé et partagé.',
            btnDownloadVideoMain: '⬇️ Télécharger la Vidéo',
            btnDownloadSubtitlesMain: '📄 Télécharger les sous-titres',
            btnDownloadMp4Video: '⬇️ Télécharger la Vidéo MP4 (Format original)',
            btnDownloadMp4Audio: '⬇️ Télécharger la Vidéo MP4 (Format Téléphone)',
            btnDownloadAss: '📄 Télécharger le texte des sous-titres au format ASS',
            btnDownloadCover: '🖼️ Télécharger la Vignette Vidéo',
            btnDownloadDesc: '📝 Télécharger la Smart Description SEO',
            btnDriveBackup: 'Sauvegarder sur Google Drive',
            labelVideoContext: '📝 Contexte de la vidéo',
            btnCopyContext: '📋 Copier le texte',
            btnContextCopied: '✅ Copié !',

            // Conseil des Agents
            councilTitle: 'Conseil des 7 Agents IA - Audit & Stratégie',
            councilScoreLabel: 'Note Globale :',
            councilConsultTitle: 'Consulter le Conseil ou un Agent Spécialisé',
            consultOptionAll: '🏛️ Tout le Conseil (Avis collégial)',
            consultPlaceholder: 'Posez une question sur le tempo, le lexique, le cadrage ou l\'impact...',
            consultBtnText: '<span>🚀</span> Demander l\'avis',
            consultThinking: 'Réflexion de l\'agent en cours...',

            // Widget Feedback Testeur
            fbBtnText: 'Feedback Testeur',
            fbModalTitle: 'Signaler un Bug ou une Idée',
            fbAgentBadge: '<span>🛡️</span> <span><b>Agent Thomas</b> analysera et qualifiera automatiquement votre retour pour créer une Issue sur GitHub.</span>',
            fbLabelName: 'Votre nom ou prénom (optionnel) :',
            fbPlaceholderName: 'Ex: Alex, Marie...',
            fbLabelMsg: 'Message brut (Dites-nous tout avec vos propres mots) :',
            fbPlaceholderMsg: 'Ex: Sur ma vidéo de 20s, le mot bulldozer a été sauté au début...',
            fbBtnSubmit: '<span>📤</span> <span>Envoyer le feedback</span>',
            fbBtnSubmitting: '<span>⏳</span> Triage IA & création GitHub...',
            fbSuccessTitle: 'Retour transmis et analysé !',
            fbLinkGitHub: '<span>🐙</span> Voir l\'Issue sur GitHub &rarr;',

            // Atelier de Personnalisation Post-Génération (Option 1)
            restyleSectionTitle: '🎨 Personnaliser les sous-titres',
            restyleSectionSub: 'Changez la couleur ou l\'emplacement en 1 clic sans attendre.',
            restyleColorLabel: 'Couleur des sous-titres :',
            restylePosLabel: 'Emplacement vertical :',
            btnApplyRestyle: '⚡ Mettre à jour la vidéo',
            restyleNotice: 'Prêt en 2 secondes • Gratuit (0 crédit)',
            btnNewVideo: '➕ Traduire une nouvelle vidéo',
            restyleProgress: '🎬 Application de vos nouvelles préférences de style...',
            restyleSuccess: '✨ Sous-titres personnalisés avec succès !',

            // Résilience Anti-Quota & Modèle IA
            badgeModelPrefix: '🧠 Modèle :',
            errAiOverloaded: 'Les serveurs IA sont temporairement surchargés. Veuillez réessayer dans quelques minutes.',
            errTelegramTooBig: '⚠️ Cette vidéo Telegram est trop lourde pour un import automatique. Veuillez la télécharger manuellement depuis Telegram et utiliser l\'envoi de fichier classique.',

            // Dictionnaire d'Erreurs Grand Public - Norme Zéro-JSON (Nadine & Thomas)
            errors: {
                MEDIA_TOO_BIG: {
                    title: "Vidéo trop lourde pour l'import direct",
                    message: "Cette vidéo Telegram dépasse la capacité autorisée pour le téléchargement direct par lien.",
                    solution: "⚠️ Vidéo trop lourde. Solution : Enregistrez-la depuis Telegram et glissez-la directement ici (jusqu'à 500 Mo).",
                    severity: "warning",
                    actionLabel: "📁 Choisir le fichier sur mon appareil"
                },
                INVALID_MEDIA: {
                    title: "Fichier média corrompu ou illisible",
                    message: "Le fichier ne contient aucun flux audio ou vidéo authentique exploitable.",
                    solution: "Vérifiez que votre fichier n'est pas endommagé et réessayez avec un format standard (MP4, MP3, WAV, MOV).",
                    severity: "danger",
                    actionLabel: "🔄 Réessayer"
                },
                TELEGRAM_ERROR: {
                    title: "Lien Telegram inaccessible",
                    message: "Le lien public Telegram n'a pas pu être récupéré ou le média n'est plus disponible.",
                    solution: "Vérifiez que le canal est public et que le lien ressemble à t.me/canal/123, ou téléchargez le média manuellement.",
                    severity: "warning",
                    actionLabel: "🔄 Réessayer"
                },
                AI_QUOTA_EXCEEDED: {
                    title: "Serveurs IA temporairement surchargés",
                    message: "Les ressources des modèles de transcription et de traduction sont momentanément saturées.",
                    solution: "Veuillez patienter 1 à 2 minutes avant de relancer votre demande.",
                    severity: "warning",
                    actionLabel: "🔄 Réessayer"
                },
                NETWORK_ERROR: {
                    title: "Erreur de communication réseau",
                    message: "La connexion avec le serveur a été interrompue pendant le traitement.",
                    solution: "Vérifiez votre connexion Internet et réessayez l'opération.",
                    severity: "danger",
                    actionLabel: "🔄 Réessayer"
                },
                NO_MEDIA_PROVIDED: {
                    title: "Aucun média sélectionné",
                    message: "Veuillez sélectionner un fichier média ou renseigner un lien Telegram public valide.",
                    solution: "Glissez un fichier audio/vidéo ou collez un lien Telegram.",
                    severity: "warning",
                    actionLabel: "📁 Choisir un fichier"
                },
                DEFAULT: {
                    title: "Incident lors de la génération",
                    message: "Une anomalie s'est produite lors de la préparation de vos sous-titres.",
                    solution: "Vérifiez votre fichier ou réessayez dans quelques instants.",
                    severity: "danger",
                    actionLabel: "🔄 Réessayer"
                }
            },

            // Page Espace Profil & Portefeuille (Issue #19)
            profileDocTitle: 'Aya Studio | Mon Profil & Portefeuille Solidaire',
            profileHeaderTitle: '👤 Espace Profil & Portefeuille Solidaire',
            profileHeaderSub: 'Gérez votre identité, suivez vos crédits de traduction et retrouvez toutes vos vidéos archivées.',
            profileAdminTourBtn: '<span>👑</span> Tour de Contrôle Admin',
            profileCardTitle: '<span>✨</span> Mon Identité',
            profileRoleContributor: 'Contributeur',
            avatarUploadTitle: 'Cliquer pour changer votre photo de profil',
            avatarOverlayText: 'Modifier',
            avatarHintText: 'Formats acceptés : PNG, JPG, WebP (< 2 Mo)<br>Normalisé en WebP carré 256x256',
            profileUniqueIdLabel: 'Identifiant Unique',
            btnCopyUsernameTitle: 'Copier le pseudonyme',
            profileNameLabel: 'Nom d\'affichage libre :',
            profileNamePlaceholder: 'Ex: Artas Architecte',
            btnSaveName: '<span>💾</span> Enregistrer',
            profileEmailLabel: 'Adresse E-mail :',
            profileEmailStatusConfirmed: '<span>✅</span> Confirmé',
            walletTitle: '<span>💳</span> Portefeuille Virtuel',
            walletBadgeText: 'Solidaire V2.1',
            walletAvailableLabel: 'Disponibles',
            walletReservedLabel: 'En traitement',
            btnRechargeWallet: '<span>⚡</span> Recharger mon solde',
            walletHint: '💡 1 crédit = 1 vidéo traduite et sous-titrée prête à publier.',
            historyTitle: '<span>🎬</span> Historique de mes Vidéos',
            btnRefreshHistory: '<span>🔄</span> Actualiser',
            historyLoadingText: 'Chargement de votre historique personnel...',
            historyEmptyTitle: 'Aucune vidéo générée pour le moment',
            historyEmptySub: 'Vos vidéos traduites, doublées et sous-titrées apparaîtront automatiquement ici avec leurs liens Google Drive et livrables téléchargeables.',
            btnStartFirstTrad: '<span>✨</span> Lancer une première traduction',
            rechargeModalTitle: '<span>⚡</span> Recharger mes Crédits Aya',
            rechargeBannerTitle: '<span>🛡️</span> Tarification Autofinancée & Transparente',
            rechargeBannerText: 'Chaque recharge couvre strictement les frais techniques de la plateforme. Vos crédits restent valables à vie.',
            paypalSolidarityTitle: '<span>❤️</span> Dons de Solidarité Palestine',
            paypalSolidarityDesc: 'Soutien direct et 100% bénévole à l\'action humanitaire et aux témoins.',
            btnPaypalDonation: '<span>🕊️</span> Don PayPal',

            // Packs de recharge Stripe
            pack1Title: '1 Crédit Flash',
            pack1Desc: '1 vidéo complète : écoute du dialecte + traduction française + sous-titres animés plein écran.',
            pack1Unit: '0,99 € / vidéo',
            pack1Price: '0,99 €',
            pack1Btn: '<span>💳</span> Acheter',
            pack5Title: 'Pack 5 Crédits',
            pack5Badge: 'Populaire',
            pack5Desc: '5 vidéos complètes avec sous-titres animés et archivage Google Drive.',
            pack5Unit: '~0,60 € / vidéo (Économisez 40%)',
            pack5Price: '2,99 €',
            pack5Btn: '<span>💳</span> Acheter',
            pack25Title: 'Pack 25 Crédits',
            pack25Badge: 'Meilleur Tarif',
            pack25Desc: '25 vidéos complètes. Le pack idéal pour les créateurs de contenu réguliers.',
            pack25Unit: '~0,40 € / vidéo (Économisez 60%)',
            pack25Price: '9,99 €',
            pack25Btn: '<span>💳</span> Acheter',

            // Liens Pied de Page Légal & Solidaire
            footerCguLink: 'Conditions Générales (CGU/CGV)',
            footerPrivacyLink: 'Politique de Confidentialité (RGPD)',
            footerPaypalLink: '❤️ Soutenir l\'équipe (PayPal)',
            footerCopyright: '© 2026 Aya Studio — Plateforme de traduction & sous-titrage solidaire. Tous droits réservés.',

            // Studio TikTok V3 (Générique & Pédagogique)
            studioDocTitle: 'Aya Studio V3 - Studio Vidéo TikTok & Éditeur Sous-Titres',
            studioHeroTitle: 'Studio Vidéo TikTok & Éditeur Sous-Titres',
            studioHeroSub: 'Personnalisez votre bandeau d\'accroche, vos titres et générez votre pack vidéo optimisé pour les réseaux sociaux.',
            sec1Title: '1. Sens de Traduction & Mode',
            labelModeSelect: 'Protocole & Langue Source :',
            modeHint: 'Détermine la langue parlée dans le fichier et la langue des sous-titres incrustés.',
            sec2Title: '2. Médias Source & Image de Fond',
            labelMediaType: 'Format du Média Source :',
            sourceMediaHint: 'Formats acceptés : MP3, WAV, OGG, M4A, MP4, MOV, MKV... (jusqu\'à 500 Mo).',
            labelBgFile: '🖼️ 2. Image de Fond Verticale (pour Canevas Vidéo) :',
            bgFileHint: 'Image verticale (format smartphone) servant d\'arrière-plan pour les fichiers audio.',
            sec3Title: '3. Bandeau, Titres & Couleurs',
            chkShowHeader: '🏷️ Afficher le Bandeau d\'Accroche Supérieur',
            labelHeaderText: 'Texte du Bandeau d\'En-tête :',
            placeholderHeaderText: 'Ex: TÉMOIGNAGE DIRECT, ÉDITION SPÉCIALE, ALERTE INFO...',
            headerTextHint: 'Court texte d\'accroche (1 à 3 mots) affiché dans le bandeau rectangulaire en haut de la vidéo.',
            labelHeaderColor: 'Couleur du Bandeau d\'En-tête :',
            labelVideoTitle: 'Titre de la Vidéo :',
            placeholderVideoTitle: 'Ex: Titre clair et percutant résumant le sujet...',
            videoTitleHint: 'Titre principal affiché sous le bandeau, pour capter l\'attention dans les 3 premières secondes.',
            labelTitleColor: '📌 Couleur du Titre (Nuancier 10 teintes) :',
            labelSubColorStudio: '💬 Couleur des Sous-Titres (Nuancier 10 teintes) :',
            sec4Title: '4. Positionnement Dynamique & Zone de Sécurité',
            labelTitleMargin: '📌 Position du Titre (Marge Haute) :',
            labelSubMargin: '💬 Position des Sous-Titres (Marge Basse) :',
            marginHint: 'Ajustez la hauteur verticale pour respecter la zone de sécurité TikTok (Safe Zone) et éviter les boutons de l\'application.',
            sec5Title: '5. Pack Éditorial Post-Vidéo Sélectif',
            editorialHint: 'Cochez les fichiers à inclure automatiquement dans votre pack de téléchargement.',
            chkMp4: '🎬 Vidéo finale prête à publier',
            chkAss: '📄 Fichier de sous-titres (.ASS)',
            chkTxt: '📝 Description pour TikTok',
            chkCover: '🎨 Vignette de couverture',
            btnGenerateStudio: '⚡ VALIDER & CRÉER MA VIDÉO',
            simTitle: '📱 Aperçu Visuel Format Téléphone (TikTok)',
            simRealtime: '● Aperçu Temps Réel Actif',
            optModeVostfr: '🇵🇸 Arabe Palestinien (Gaza) ➔ 🇫🇷 Français (VOSTFR)',
            optModeVoar: '🇫🇷 Français ➔ 🇵🇸 Arabe Palestinien (Gaza Ammiya) (VOAR)',
            optMediaAudio: '🎙️ Fichier Audio (.mpeg / .mp3 / .wav / .ogg / .m4a / .opus / .aac / .flac) + Image de Fond',
            optMediaVideo: '🎬 Fichier Vidéo (.mpeg / .mpg / .mp4 / .mov / .mkv / .webm / .ts)',
            sourceMediaAudioLabel: '📁 1. Fichier Audio Source :',
            sourceMediaVideoLabel: '📁 1. Fichier Vidéo Source :',
            placeholderAudioFile: '📁 Choisissez votre fichier audio ou vidéo (.mpeg, .mp3, .ogg, .mp4...)...',
            placeholderBgFile: '🖼️ Cliquez pour choisir votre image de fond verticale...'
        },
        ar: {
            dir: 'rtl',
            // Navbar Globale
            navbarBrandTitle: 'آية ستوديو',
            navbarBrandSub: 'استوديو الدبلجة والترجمة الفورية للفيديوهات والتسجيلات',
            userConnectedPrefix: '👤 متصل باسم:',
            userAnonymous: 'زائر / فاحص',
            logoutBtnTitle: 'تسجيل الخروج',
            navHomeText: 'المحادثة',
            navTraducteurText: 'المترجم',
            navTraductionText: 'الترجمة',
            navStudioText: 'استوديو الفيديو',
            navCommunauteText: 'المجتمع',
            navModerationText: 'الإشراف',
            navProfilText: 'الملف',
            navbarLiveText: 'متصل',
            // Nouveaux termes vulgarisés Grand Public (Arabe Shami Levantin)
            navExchangeText: 'غرفة الدردشة',
            navCreationText: 'أدوات الإنشاء',
            navCreationSub: 'الترجمة والفيديوهات والبطاقات التعليمية',
            navTranslationText: 'المترجم الشامي',
            navTranslationSub: 'ترجمة فورية للنصوص والتسجيلات',
            navVideoText: 'صانع الفيديوهات',
            navVideoSub: 'دبلجة وتوليد ترجمة مرئية متزامنة',
            navCardsText: 'البطاقات التعليمية',
            navCardsSub: 'بطاقات بلقطات صوتية مزدوجة للتيك توك',
            navCommunityText: 'جدار المجتمع',
            navCommunitySub: 'الشهادات والتجارب الحية المشتركة',
            navAccountText: 'حسابي ورصيدي',
            navProfileText: 'الملف الشخصي',
            navWalletText: 'المحفظة والرصيد',
            navCreationsText: 'أعمالي وسجل الإنتاج',
            navAdminText: 'لوحة التحكم والإدارة',
            navLogoutText: 'تسجيل الخروج',
            navOnlineText: 'متصل',
            navCreateActionText: 'إنشاء',
            navCloseSheetText: 'إغلاق',

            // Page Modération Back-Office (Phase 2.5)
            moderationDocTitle: 'منصة آية - لوحة الإشراف والمراجعة',
            moderationHeaderTitle: 'قائمة انتظار التدقيق والمراجعة',
            moderationHeaderSub: 'اعتمد الشهادات للنشر العام على الجدار أو احفظ المنشورات غير المطابقة.',
            moderationPendingStat: 'قيد الانتظار',
            moderationApprovedStat: 'تمت الموافقة',
            moderationRejectedStat: 'مرفوضة',
            moderationEmptyTitle: 'قائمة الانتظار فارغة',
            moderationEmptySub: 'تمت مراجعة جميع الشهادات بنجاح. ستظهر المنشورات الجديدة هنا فور إرسالها.',
            btnApprovePost: '✅ اعتماد ونشر',
            btnRejectPost: '❌ رفض المنشور',
            toastApproveSuccess: '✅ تم اعتماد الشهادة! وهي الآن معروضة على جدار المجتمع العام.',
            toastRejectSuccess: '❌ تم رفض الشهادة وحفظها بعيداً عن الجدار العام.',

            // Page Mur Communautaire (Phase 2 - Issue #10)
            communauteDocTitle: 'منصة آية - جدار المجتمع والشهادات الحية',
            communauteHeroTitle: 'جدار المجتمع والشهادات الإنسانية',
            communauteHeroSub: 'مساحة للتعبير والتوثيق والذاكرة الحية. استكشف وشارك الشهادات المرئية والمسموعة المترجمة بأمانة.',
            heroPostsLabel: 'شهادات تمت مشاركتها',
            publishCardTitle: '📢 مشاركة شهادة جديدة',
            publishCardSub: 'انشر مقطع فيديو أو صوت مترجم مصحوباً بالوصف الذكي. تخضع جميع المنشورات لمراجعة دقيقة من الفريق قبل الظهور للعامة.',
            labelPublishAuthor: 'اسمك أو اسم مستعار:',
            placeholderPublishAuthor: 'مثال: أحمد، مريم، شاهد من غزة...',
            labelPublishMedia: 'ملف الوسائط (فيديو أو صوت):',
            publishMediaHint: 'اسحب فيديو MP4 أو ملفاً صوتياً (أو شارك عملاً تم توليده مسبقاً في الاستوديو)',
            labelPublishText: 'الوصف الذكي ونص الشهادة كاملاً:',
            placeholderPublishText: 'الصق هنا الوصف الذكي المُولّد أو صف المشهد وسياق الكلام بدقة...',
            labelPublishTags: 'الوسوم والكلمات المفتاحية (مفصولة بفواصل أو مسافات):',
            placeholderPublishTags: 'مثال: غزة، شهادة، أمل، عدالة',
            btnPublishSubmit: '<span>🚀</span> إرسال ونشر الشهادة',
            btnPublishSubmitting: '<span>⏳</span> جاري الإرسال والتسجيل...',
            btnReplaceMediaText: 'استبدال الفيديو',
            publishSuccessTitle: '✅ تم إرسال الشهادة بنجاح!',
            publishSuccessMsg: 'تم استلام منشورك بنجاح. وهو الآن قيد المراجعة والتدقيق من قبل فريق الإشراف (الحالة: قيد الانتظار) قبل ظهوره على الجدار العام.',
            feedSectionTitle: '✨ أحدث الشهادات المنشورة',
            placeholderSearch: 'البحث بالكلمات المفتاحية، الشاهد، الوسم...',
            feedEmptyTitle: 'لا توجد شهادات منشورة حالياً',
            feedEmptySub: 'كن أول من يشارك فيديو مترجماً على جدار المجتمع!',
            postPendingBadge: '⏳ قيد المراجعة',
            postApprovedBadge: '✅ موثق ومعتمد',
            btnLikePost: '❤️ إعجاب',
            btnSharePost: '🔗 مشاركة',
            btnCopyPost: '📋 نسخ النص',

            // Page Traduction & Studio
            pageDocTitle: 'استوديو آية V3 - دبلجة وترجمة الفيديوهات بدقة متناهية',
            pageIntroTitle: 'إنشاء وتوليد الترجمة التلقائية فائقة الدقة',
            pageIntroSub: 'اسحب وأفلت الملف الصوتي أو المرئي، اختر لغة الترجمة واستلم الفيديو مدمجاً باحترافية.',

            // Zone Dépose Média & Import Telegram
            dropZoneText: 'اسحب وأفلت ملف الوسائط هنا للبدء',
            dropZoneSub: 'أو انقر لاختيار ملف من جهازك (صوت أو فيديو حتى 500 ميغابايت)',
            btnRemoveFileTitle: 'إزالة هذا الملف',
            uploadOrDivider: 'أو',
            placeholderTelegramUrl: '🔗 أو الصق رابط تيليجرام عام (مثال: t.me/canal/123)...',
            btnPasteTelegramTitle: 'لصق من الحافظة',
            telegramHint: '✈️ استيراد وترجمة تلقائية من أي قناة أو منشور تيليجرام عام.',
            alertNoMediaOrTelegram: 'يرجى اختيار ملف وسائط أو إدخال رابط تيليجرام عام صحيح.',

            // Mode de traitement (Module 1 vs Module 2)
            labelProcessingMode: '٠. نمط المعالجة',
            modeVideoTitle: '🎬 فيديو كامل مدمج',
            modeVideoSub: 'فيديو كامل بترجمة متحركة (ملائم لتيك توك وإنستغرام)',
            modeExpressTitle: '⚡ النمط السريع (نص فقط)',
            modeExpressSub: 'ترجمة نصية سريعة فقط (للقراءة والنسخ الفوري)',

            // Restitution Express
            expressResultTitle: '<span>⚡</span> الترجمة النصية السريعة جاهزة',
            expressSubTitle: 'ترجمة نصية سريعة فقط (للقراءة والنسخ الفوري)',
            btnCopyText: '📋 نسخ النص',
            btnCopied: '✅ تم النسخ!',
            btnDownloadMarkdown: '⬇️ تحميل ملف ماركداون (.md)',
            labelFullText: '📜 النص الكامل المترجم',
            labelTimestamps: '⏱️ التوقيتات والأجزاء',

            // Sélecteur Langue Source
            labelSourceLang: '١. لغة التسجيل الأصلية (المصدر)',
            sourceAutoTitle: 'التعرف التلقائي',
            sourceAutoSub: 'كشف لغة الصوت تلقائياً بدون تدخل',
            sourceArTitle: 'العربية الفلسطينية',
            sourceArSub: 'اللهجة الغزاوية العامية الأصيلة',
            sourceFrTitle: 'الفرنسية',
            sourceFrSub: 'الكلام الأصلي باللغة الفرنسية',

            // Sélecteur Langue Cible
            labelTargetLang: '٢. اللغة المطلوبة للترجمة (الهدف)',
            targetFrTitle: 'الفرنسية (ترجمة مكتوبة بالفرنسية)',
            targetFrSub: 'شريط ترجمة بالفرنسية الفصيحة والمعاصرة',
            targetArTitle: 'العربية (ترجمة مكتوبة بالعربية)',
            targetArSub: 'شريط ترجمة بالعربية الفلسطينية الأصيلة',

            // Style & Couleur
            labelSubColor: '٣. مظهر ولون شريط الترجمة',
            colorYellowTitle: '🟡 أصفر ساطع',
            colorYellowSub: 'المظهر الرسمي لتيك توك وريلز',
            colorWhiteTitle: '⚪ أبيض عصري',
            colorWhiteSub: 'كلاسيكي ونقي',
            colorGreenTitle: '🟢 أخضر زمردي',
            colorGreenSub: 'تباين جذاب ومريح للعين',
            colorCyanTitle: '🔵 سماوي كهربائي',
            colorCyanSub: 'نمط نيون حديث',

            // Position Verticale
            labelSubPosition: '٤. موضع النص على الشاشة',
            posBottomTitle: '⬇️ أسفل (950)',
            posBottomSub: 'الموضع القياسي لتيك توك وريلز',
            posMidTitle: '↕️ وسط (500)',
            posMidSub: 'مركز الشاشة الرئيسي',
            posTopTitle: '⬆️ أعلى (150)',
            posTopSub: 'أسفل الشريط العلوي',

            // Choix du Visuel pour Audios
            labelBgTheme: '٥. اختيار الخلفية المرئية (خاص بالتسجيلات الصوتية فقط)',
            audioNoticeBadge: '✨ فيديو طولي تلقائي للملفات الصوتية',
            bgPalestineTitle: '🇵🇸 صمود فلسطين',
            bgPalestineSub: 'ألوان العلم الفلسطيني بنمط تجريدي',
            bgDarkTitle: '🌑 أسود ملكي داكن',
            bgDarkSub: 'مظهر أنيق وتباين عالي للشاشات',
            bgTurquoiseTitle: '🌊 فيروزي الأمل',
            bgTurquoiseSub: 'لون هوية آية الرسمي #00bcd4',
            bgTemoignageTitle: '🎙️ شهادة وقورة',
            bgTemoignageSub: 'إطار مهيب خاص بالشهادات الإنسانية',

            // Bouton Action & Options
            btnSubmitDefault: '<span>⚡</span> بدء المعالجة والتوليد الفوري',
            btnSubmitLoading: '<span>⏳</span> جاري معالجة الفيديو والترجمة...',
            chkForceReprocess: '🔄 إعادة المعالجة الإجبارية (تجاوز الذاكرة المؤقتة)',
            chkTiktokPackText: 'إنشاء حزمة تيك توك (غلاف ونصوص النشر)',
            chkTiktokPackSub: 'اختياري: غلاف طولي ونصوص ترويجية محسنة (SEO)',

            // Progression
            statusInit: '✨ جاري تجهيز مقطعكم...',
            logConnected: 'تم الاتصال بالخادم بنجاح...',

            // Résultats & Téléchargements
            resultStatusReady: '<span>✅</span> الفيديو المترجم جاهز',
            successTitleVideo: 'تم إنشاء الفيديو بنجاح!',
            successSubtitleVideo: 'الوسائط الخاصة بك جاهزة للمعاينة والمشاركة.',
            btnDownloadVideoMain: '⬇️ تحميل الفيديو',
            btnDownloadSubtitlesMain: '📄 تحميل ملف الترجمة',
            btnDownloadMp4Video: '⬇️ تحميل الفيديو النهائي (MP4)',
            btnDownloadMp4Audio: '⬇️ تحميل الفيديو النهائي (بصيغة طولية)',
            btnDownloadAss: '📄 تحميل نصوص الترجمة بصيغة ASS',
            btnDownloadCover: '🖼️ تحميل غلاف تيك توك',
            btnDownloadDesc: '📝 تحميل نصوص النشر والوصف الذكي',
            btnDriveBackup: 'حفظ على Google Drive',
            labelVideoContext: '📝 سياق الفيديو',
            btnCopyContext: '📋 نسخ النص',
            btnContextCopied: '✅ تم النسخ!',

            // Conseil des Agents
            councilTitle: 'مجلس الوكلاء السبعة - تدقيق الجودة والاستراتيجية',
            councilScoreLabel: 'التقييم الشامل :',
            councilConsultTitle: 'استشر مجلس الوكلاء أو خبيراً بعينه',
            consultOptionAll: '🏛️ مجلس الوكلاء كاملاً (رأي جماعي)',
            consultPlaceholder: 'اطرح سؤالك حول الإيقاع، المصطلحات، التأطير أو التأثير...',
            consultBtnText: '<span>🚀</span> طلب الرأي والمشورة',
            consultThinking: 'الوكيل يفكر في الرد بدقة...',

            // Widget Feedback Testeur
            fbBtnText: 'ملاحظات الفاحصين',
            fbModalTitle: 'الإبلاغ عن خطأ أو اقتراح تحسين',
            fbAgentBadge: '<span>🛡️</span> <span>سيقوم <b>الوكيل توماس</b> بتحليل وتصنيف تقريرك تلقائياً لإنشاء تذكرة في غيت هاب.</span>',
            fbLabelName: 'اسمك أو لقبك (اختياري):',
            fbPlaceholderName: 'مثال: أنس، آية، سوسو...',
            fbLabelMsg: 'نص الملاحظة (اكتب ملاحظتك بحرية تامة وبكلماتك الخاصة):',
            fbPlaceholderMsg: 'مثال: في الفيديو عند الثانية 12 ظهر خطأ في توقيت النص...',
            fbBtnSubmit: '<span>📤</span> <span>إرسال التقرير الآن</span>',
            fbBtnSubmitting: '<span>⏳</span> جاري التصنيف الذكي وإنشاء التذكرة...',
            fbSuccessTitle: 'تم استلام التقرير وتصنيفه بنجاح!',
            fbLinkGitHub: '<span>🐙</span> معاينة التذكرة على غيت هاب &rarr;',

            // Atelier de Personnalisation Post-Génération (Option 1)
            restyleSectionTitle: '🎨 تخصيص مظهر الترجمة',
            restyleSectionSub: 'غيّر لون أو موضع النصوص بنقرة واحدة فوراً دون انتظار.',
            restyleColorLabel: 'لون نصوص الترجمة :',
            restylePosLabel: 'الموضع الرأسي للترجمة :',
            btnApplyRestyle: '⚡ تحديث مظهر الفيديو',
            restyleNotice: 'جاهز خلال ثانيتين • مجاني تماماً (0 رصيد)',
            btnNewVideo: '➕ ترجمة فيديو جديد',
            restyleProgress: '🎬 جاري تطبيق النمط والألوان التي اخترتها...',
            restyleSuccess: '✨ تم تحديث مظهر الترجمة بنجاح!',

            // Résilience Anti-Quota & Modèle IA
            badgeModelPrefix: '🧠 النموذج:',
            errAiOverloaded: 'خوادم الذكاء الاصطناعي محملة بشكل زائد مؤقتاً. يرجى إعادة المحاولة بعد بضع دقائق.',
            errTelegramTooBig: '⚠️ هذا الفيديو من تيليجرام كبير جداً ولا يمكن استيراده تلقائياً عبر الرابط. يرجى تنزيله يدوياً من تيليجرام ورفعه مباشرة كملف.',

            // قاموس الأخطاء الموجه للمستخدم العام - معيار انعدام كود جيسون (نادين وتوما)
            errors: {
                MEDIA_TOO_BIG: {
                    title: "حجم الفيديو كبير جداً للاستيراد المباشر",
                    message: "هذا الفيديو من تيليجرام يتجاوز الحجم المسموح به للتنزيل التلقائي عبر الرابط.",
                    solution: "⚠️ الفيديو كبير جداً. الحل: احفظه من تطبيق تيليجرام على جهازك واسحبه هنا مباشرة (ندعم حتى 500 ميغابايت).",
                    severity: "warning",
                    actionLabel: "📁 اختيار الملف من الجهاز"
                },
                INVALID_MEDIA: {
                    title: "ملف تالف أو تعذر قراءته",
                    message: "الملف لا يحتوي على أي مسار صوتي أو مرئي حقيقي صالح للاستخدام.",
                    solution: "يرجى التأكد من سلامة الملف وتجربة صيغة قياسية معروفة مثل (MP4, MP3, WAV, MOV).",
                    severity: "danger",
                    actionLabel: "🔄 إعادة المحاولة"
                },
                TELEGRAM_ERROR: {
                    title: "تعذر الاستيراد من تيليجرام",
                    message: "لم نتمكن من الوصول للمحتوى عبر رابط تيليجرام أو أن المنشور غير متاح.",
                    solution: "تأكد من أن القناة عامة وأن الرابط بصيغة t.me/canal/123، أو قم بتنزيل الملف ورفعه يدوياً.",
                    severity: "warning",
                    actionLabel: "🔄 إعادة المحاولة"
                },
                AI_QUOTA_EXCEEDED: {
                    title: "ضغط مؤقت على خوادم الذكاء الاصطناعي",
                    message: "خوادم نماذج التفريغ والترجمة مشغولة حالياً بأقصى طاقتها.",
                    solution: "يرجى الانتظار لمدة دقيقة أو دقيقتين ثم إعادة المحاولة.",
                    severity: "warning",
                    actionLabel: "🔄 إعادة المحاولة"
                },
                NETWORK_ERROR: {
                    title: "انقطاع الاتصال بالشبكة",
                    message: "انقطع الاتصال مع الخادم أثناء معالجة الطلب.",
                    solution: "يرجى التحقق من اتصال الإنترنت لديك ثم المحاولة مجدداً.",
                    severity: "danger",
                    actionLabel: "🔄 إعادة المحاولة"
                },
                NO_MEDIA_PROVIDED: {
                    title: "لم يتم تحديد أي وسائط",
                    message: "يرجى اختيار ملف وسائط أو إدخال رابط تيليجرام عام صحيح.",
                    solution: "اسحب ملفاً صوتياً/مرئياً أو الصق رابط تيليجرام عام للمتابعة.",
                    severity: "warning",
                    actionLabel: "📁 اختيار ملف"
                },
                DEFAULT: {
                    title: "تعذر إتمام المعالجة",
                    message: "حدث خطأ غير متوقع أثناء معالجة وإنشاء شريط الترجمة.",
                    solution: "يرجى التحقق من الملف أو المحاولة مرة أخرى بعد لحظات.",
                    severity: "danger",
                    actionLabel: "🔄 إعادة المحاولة"
                }
            },

            // Page Espace Profil & Portefeuille (Issue #19)
            profileDocTitle: 'منصة آية | الملف الشخصي والمحفظة التضامنية',
            profileHeaderTitle: '👤 الملف الشخصي والمحفظة التضامنية',
            profileHeaderSub: 'إدارة الهوية الشخصية، متابعة أرصدة الترجمة وسجل الفيديوهات المحفوظة.',
            profileAdminTourBtn: '<span>👑</span> لوحة التحكم والإشراف',
            profileCardTitle: '<span>✨</span> بياناتي الشخصية',
            profileRoleContributor: 'مساهم تضامني',
            avatarUploadTitle: 'اضغط لتغيير الصورة الشخصية',
            avatarOverlayText: 'تعديل',
            avatarHintText: 'الصيغ المقبولة: PNG, JPG, WebP (&lt; 2 ميغابايت)<br>تُحفظ مربعة بحجم 256x256',
            profileUniqueIdLabel: 'المعرّف الفريد',
            btnCopyUsernameTitle: 'نسخ اسم المستخدم',
            profileNameLabel: 'الاسم الظاهر:',
            profileNamePlaceholder: 'مثال: أحمد المترجم',
            btnSaveName: '<span>💾</span> حفظ التعديلات',
            profileEmailLabel: 'البريد الإلكتروني:',
            profileEmailStatusConfirmed: '<span>✅</span> موثق',
            walletTitle: '<span>💳</span> المحفظة الرقمية',
            walletBadgeText: 'تضامني V2.1',
            walletAvailableLabel: 'الأرصدة المتاحة',
            walletReservedLabel: 'قيد المعالجة',
            btnRechargeWallet: '<span>⚡</span> شحن الرصيد',
            walletHint: '💡 نقطة واحدة = فيديو واحد مترجم بالكامل وجاهز للنشر مباشرة.',
            historyTitle: '<span>🎬</span> سجل الفيديوهات المترجمة',
            btnRefreshHistory: '<span>🔄</span> تحديث',
            historyLoadingText: 'جاري تحميل سجل فيديوهاتك الشخصية...',
            historyEmptyTitle: 'لا توجد فيديوهات منشأة حتى الآن',
            historyEmptySub: 'ستظهر جميع الفيديوهات التي تترجمها هنا تلقائياً مع روابط الحفظ والتحميل.',
            btnStartFirstTrad: '<span>✨</span> ابدأ أول ترجمة الآن',
            rechargeModalTitle: '<span>⚡</span> شحن أرصدة منصة آية',
            rechargeBannerTitle: '<span>🛡️</span> تسعير شفاف وتغطية تكلفة',
            rechargeBannerText: 'كل باقة تغطي فقط التكاليف التشغيلية للمنصة. رصيدك دائم ولا ينتهي أبداً.',
            paypalSolidarityTitle: '<span>❤️</span> التبرع التضامني المباشر',
            paypalSolidarityDesc: 'دعم مباشر وتطوعي ١٠٠٪ للإغاثة الإنسانية وإيصال صوت الشهود في فلسطين.',
            btnPaypalDonation: '<span>🕊️</span> تبرع عبر PayPal',

            // Packs de recharge Stripe
            pack1Title: 'رصيد واحد سريع',
            pack1Desc: 'فيديو واحد متكامل: استماع للهجة + ترجمة فرنسية + ترجمة متحركة بملء الشاشة.',
            pack1Unit: '<span class="aya-bidi-num">0,99 €</span> / للفيديو',
            pack1Price: '<span class="aya-bidi-num">0,99 €</span>',
            pack1Btn: '<span>💳</span> شراء الآن',
            pack5Title: 'باقة ٥ أرصدة',
            pack5Badge: 'الأكثر طلباً',
            pack5Desc: '٥ فيديوهات كاملة مع شريط ترجمة متحرك وأرشفة على Google Drive.',
            pack5Unit: '<span class="aya-bidi-num">~0,60 €</span> / للفيديو (وفّر ٤٠٪)',
            pack5Price: '<span class="aya-bidi-num">2,99 €</span>',
            pack5Btn: '<span>💳</span> شراء الآن',
            pack25Title: 'باقة ٢٥ رصيداً',
            pack25Badge: 'أفضل قيمة',
            pack25Desc: '٢٥ فيديو كامل ومترجم. الخيار الأمثل لصناع المحتوى والناشطين المنتظمين.',
            pack25Unit: '<span class="aya-bidi-num">~0,40 €</span> / للفيديو (وفّر ٦٠٪)',
            pack25Price: '<span class="aya-bidi-num">9,99 €</span>',
            pack25Btn: '<span>💳</span> شراء الآن',

            // Liens Pied de Page Légal & Solidaire
            footerCguLink: 'الشروط العامة (CGU/CGV)',
            footerPrivacyLink: 'سياسة الخصوصية (RGPD)',
            footerPaypalLink: '❤️ دعم الفريق (PayPal)',
            footerCopyright: '© 2026 استوديو آية — منصة الترجمة والدبلجة التضامنية. جميع الحقوق محفوظة.',

            // Studio TikTok V3 (Générique & Pédagogique)
            studioDocTitle: 'استوديو آية V3 - محرر تيك توك وصانع الترجمة',
            studioHeroTitle: 'استوديو تيك توك ومحرر الترجمة',
            studioHeroSub: 'خصص شريط العنوان العلوي والعناوين وأنشئ حزمة الفيديو المحسنة لمنصات التواصل الاجتماعي.',
            sec1Title: '١. اتجاه الترجمة ونمط المعالجة',
            labelModeSelect: 'بروتوكول ولغة التسجيل الأصلية:',
            modeHint: 'يحدد اللغة المنطوقة في التسجيل ولغة الترجمة النصية المرئية.',
            sec2Title: '٢. وسائط المصدر وصورة الخلفية',
            labelMediaType: 'صيغة وتنسيق الوسائط المصدر:',
            sourceMediaHint: 'الصيغ المقبولة: MP3, WAV, OGG, M4A, MP4, MOV, MKV... (حتى 500 ميغابايت).',
            labelBgFile: '🖼️ ٢. صورة الخلفية الطولية (لكانفاس الفيديو):',
            bgFileHint: 'صورة طولية مناسبة للهاتف كخلفية بصرية للتسجيلات الصوتية.',
            sec3Title: '٣. شريط العنوان والخطوط والألوان',
            chkShowHeader: '🏷️ إظهار شريط العنوان العلوي',
            labelHeaderText: 'نص شريط العنوان العلوي:',
            placeholderHeaderText: 'مثال: شهادة حية، تغطية خاصة، صوت الميدان...',
            headerTextHint: 'نص بارز وموجز (من كلمة إلى ٣ كلمات) في أعلى الفيديو لجذب الانتباه الفوري.',
            labelHeaderColor: 'لون خلفية شريط العنوان العلوي:',
            labelVideoTitle: 'العنوان الرئيسي للفيديو:',
            placeholderVideoTitle: 'مثال: عنوان واضح ومؤثر يوجز محور الحديث...',
            videoTitleHint: 'عنوان رئيسي جذاب يظهر في الثواني الأولى لتوضيح الفكرة.',
            labelTitleColor: '📌 لون العنوان الرئيسي (لوحة ١٠ تدرجات):',
            labelSubColorStudio: '💬 لون شريط الترجمة (لوحة ١٠ تدرجات):',
            sec4Title: '٤. تحديد المواضع ومنطقة الأمان',
            labelTitleMargin: '📌 موضع العنوان (المسافة من الأعلى):',
            labelSubMargin: '💬 موضع الترجمة (المسافة من الأسفل):',
            marginHint: 'اضبط الارتفاع لتفادي تداخل النصوص مع أزرار وأيقونات تطبيق تيك توك (Safe Zone).',
            sec5Title: '٥. حزمة النشر المتكاملة بعد التوليد',
            editorialHint: 'حدد الملفات المطلوب توليدها وتضمينها في حزمة التنزيل النهائية.',
            chkMp4: '🎬 فيديو نهائي جاهز للنشر',
            chkAss: '📄 ملف نصوص الترجمة بصيغة ASS',
            chkTxt: '📝 نص الوصف لتيك توك',
            chkCover: '🎨 غلاف الفيديو المصور',
            btnGenerateStudio: '⚡ اعتماد وإنشاء الفيديو',
            simTitle: '📱 معاينة العرض المرئي للهاتف (تيك توك)',
            simRealtime: '● المعاينة الحية نشطة',
            optModeVostfr: '🇵🇸 عربي فلسطيني (غزة) ➔ 🇫🇷 فرنسي (VOSTFR)',
            optModeVoar: '🇫🇷 فرنسي ➔ 🇵🇸 عربي فلسطيني (عامية غزة) (VOAR)',
            optMediaAudio: '🎙️ ملف صوتي (.mp3 / .wav / .ogg / .m4a / .opus / .aac / .flac) + صورة خلفية',
            optMediaVideo: '🎬 ملف فيديو (.mp4 / .mov / .mkv / .webm / .ts / .mpeg)',
            sourceMediaAudioLabel: '📁 ١. ملف الصوت المصدر:',
            sourceMediaVideoLabel: '📁 ١. ملف الفيديو المصدر:',
            placeholderAudioFile: '📁 اختر ملف الصوت أو الفيديو المصدر (.mp3, .wav, .mp4...)...',
            placeholderBgFile: '🖼️ اضغط لاختيار صورة الخلفية الطولية...'
        }
    };

    // 2. Gestion de l'état linguistique persistant
    let currentLang = localStorage.getItem('aya_lang') || 'fr';

    function setLanguage(lang) {
        if (!translations[lang]) lang = 'fr';
        currentLang = lang;
        localStorage.setItem('aya_lang', lang);

        const dict = translations[lang];

        // Modification des attributs HTML globaux (RTL / LTR)
        document.documentElement.setAttribute('lang', lang);
        document.documentElement.setAttribute('dir', dict.dir);
        if (document.body) {
            document.body.setAttribute('dir', dict.dir);
        }

        // Bascule des boutons du switcher
        const btnFr = document.getElementById('langFrBtn');
        const btnAr = document.getElementById('langArBtn');
        if (btnFr && btnAr) {
            if (lang === 'ar') {
                btnAr.classList.add('active');
                btnFr.classList.remove('active');
            } else {
                btnFr.classList.add('active');
                btnAr.classList.remove('active');
            }
        }

        // Mise à jour des textes de la Navbar
        updateElementText('navbarBrandTitle', dict.navbarBrandTitle, true);
        updateElementText('navbarBrandSub', dict.navbarBrandSub);
        updateElementText('navHomeText', dict.navHomeText);
        updateElementText('navTraductionText', dict.navTraductionText);
        updateElementText('navStudioText', dict.navStudioText);
        updateElementText('navCommunauteText', dict.navCommunauteText);
        updateElementText('navModerationText', dict.navModerationText);
        updateElementText('navProfilText', dict.navProfilText);
        updateElementText('navbarLiveText', dict.navbarLiveText);

        // Nouveaux libellés Desktop & Mobile
        updateElementText('navExchangeText', dict.navExchangeText);
        updateElementText('navCreationText', dict.navCreationText);
        updateElementText('navTranslationText', dict.navTranslationText);
        updateElementText('navTranslationSub', dict.navTranslationSub);
        updateElementText('navVideoText', dict.navVideoText);
        updateElementText('navVideoSub', dict.navVideoSub);
        updateElementText('navCardsText', dict.navCardsText);
        updateElementText('navCardsSub', dict.navCardsSub);
        updateElementText('navCommunityText', dict.navCommunityText);
        updateElementText('navCommunitySub', dict.navCommunitySub);
        updateElementText('navAccountText', dict.navAccountText);
        updateElementText('navProfileText', dict.navProfileText);
        updateElementText('navWalletText', dict.navWalletText);
        updateElementText('navCreationsText', dict.navCreationsText);
        updateElementText('navAdminText', dict.navAdminText);
        updateElementText('navLogoutText', dict.navLogoutText);
        updateElementText('bottomNavExchangeText', dict.navExchangeText);
        updateElementText('bottomNavCreateText', dict.navCreateActionText);
        updateElementText('bottomNavAccountText', dict.navAccountText);
        updateElementText('bottomNavAdminText', dict.navAdminText);
        updateElementText('sheetCreationTitle', dict.navCreationText);
        updateElementText('sheetTransTitle', dict.navTranslationText);
        updateElementText('sheetTransSub', dict.navTranslationSub);
        updateElementText('sheetVideoTitle', dict.navVideoText);
        updateElementText('sheetVideoSub', dict.navVideoSub);
        updateElementText('sheetCardsTitle', dict.navCardsText);
        updateElementText('sheetCardsSub', dict.navCardsSub);
        updateElementText('sheetCommTitle', dict.navCommunityText);
        updateElementText('sheetCommSub', dict.navCommunitySub);

        const userObj = getUserSession();
        const userNameSpan = document.getElementById('navbarUserName');
        const avatarImg = document.getElementById('navbarAvatarImg');
        const creditsSpan = document.getElementById('navbarCreditsCount');
        if (userNameSpan) {
            const name = userObj ? (userObj.name || userObj.username) : dict.userAnonymous;
            userNameSpan.textContent = name;
        }
        if (avatarImg && userObj && userObj.avatar) {
            avatarImg.src = userObj.avatar;
        }
        if (creditsSpan && userObj && userObj.credits !== undefined) {
            creditsSpan.textContent = userObj.credits;
        }

        if (!window._ayaUserSyncDone) {
            window._ayaUserSyncDone = true;
            fetch('/api/user/profile')
                .then(r => r.json())
                .then(d => {
                    if (d && d.success && d.user) {
                        localStorage.setItem('aya_user', JSON.stringify(d.user));
                        const currentAvatar = document.getElementById('navbarAvatarImg');
                        const currentName = document.getElementById('navbarUserName');
                        const currentCredits = document.getElementById('navbarCreditsCount');
                        if (currentAvatar && d.user.avatar) currentAvatar.src = d.user.avatar;
                        if (currentName) currentName.textContent = d.user.name || d.user.username;
                        if (currentCredits && d.user.credits !== undefined) currentCredits.textContent = d.user.credits;
                    }
                })
                .catch(() => {});
        }

        // Mise à jour des textes de la page /moderation
        if (window.location.pathname.includes('moderation')) {
            document.title = dict.moderationDocTitle;
            updateElementText('moderationHeaderTitle', dict.moderationHeaderTitle);
            updateElementText('moderationHeaderSub', dict.moderationHeaderSub);
            updateElementText('labelStatPending', dict.moderationPendingStat);
            updateElementText('labelStatApproved', dict.moderationApprovedStat);
            updateElementText('labelStatRejected', dict.moderationRejectedStat);
            updateElementText('emptyQueueTitle', dict.moderationEmptyTitle);
            updateElementText('emptyQueueSub', dict.moderationEmptySub);
        }

        // Mise à jour des textes de la page /communaute
        if (window.location.pathname.includes('communaute')) {
            document.title = dict.communauteDocTitle;
            updateElementText('communauteHeroTitle', dict.communauteHeroTitle);
            updateElementText('communauteHeroSub', dict.communauteHeroSub);
            updateElementText('heroPostsLabel', dict.heroPostsLabel);
            updateElementText('publishCardTitle', dict.publishCardTitle);
            updateElementText('publishCardSub', dict.publishCardSub);
            updateElementText('labelPublishAuthor', dict.labelPublishAuthor);
            updateElementPlaceholder('authorNameInput', dict.placeholderPublishAuthor);
            updateElementText('labelPublishMedia', dict.labelPublishMedia);
            updateElementText('publishMediaHint', dict.publishMediaHint);
            updateElementText('labelPublishText', dict.labelPublishText);
            updateElementPlaceholder('postContentInput', dict.placeholderPublishText);
            updateElementText('labelPublishTags', dict.labelPublishTags);
            updateElementPlaceholder('tagsInput', dict.placeholderPublishTags);
            updateElementText('feedSectionTitle', dict.feedSectionTitle);
            updateElementPlaceholder('feedSearchInput', dict.placeholderSearch);
            updateElementText('feedEmptyTitle', dict.feedEmptyTitle);
            updateElementText('feedEmptySub', dict.feedEmptySub);
            updateElementText('btnReplaceMediaText', dict.btnReplaceMediaText);

            const btnPublish = document.getElementById('btnPublishPost');
            if (btnPublish && !btnPublish.disabled) {
                btnPublish.innerHTML = dict.btnPublishSubmit;
            }
        }

        // Mise à jour des textes de la page /traduction
        if (window.location.pathname.includes('traduction')) {
            document.title = dict.pageDocTitle;
            updateElementText('pageIntroTitle', dict.pageIntroTitle);
            updateElementText('pageIntroSub', dict.pageIntroSub);
            updateElementText('dropZoneText', dict.dropZoneText);
            updateElementText('dropZoneSub', dict.dropZoneSub);
            updateElementText('uploadOrText', dict.uploadOrDivider);
            updateElementPlaceholder('telegramUrlInput', dict.placeholderTelegramUrl);
            updateElementText('telegramHintText', dict.telegramHint);

            // Mode de traitement
            updateElementText('labelProcessingMode', dict.labelProcessingMode);
            updateElementText('modeVideoTitle', dict.modeVideoTitle);
            updateElementText('modeVideoSub', dict.modeVideoSub);
            updateElementText('modeExpressTitle', dict.modeExpressTitle);
            updateElementText('modeExpressSub', dict.modeExpressSub);

            // Restitution Express
            updateElementText('expressSubTitle', dict.expressSubTitle);
            updateElementText('btnCopyExpressText', dict.btnCopyText);
            updateElementText('btnDownloadMdText', dict.btnDownloadMarkdown);
            updateElementText('labelFullTextTitle', dict.labelFullText);
            updateElementText('labelTimestampsTitle', dict.labelTimestamps);

            updateElementText('labelSourceLang', dict.labelSourceLang);
            updateElementText('sourceAutoTitle', dict.sourceAutoTitle);
            updateElementText('sourceAutoSub', dict.sourceAutoSub);
            updateElementText('sourceArTitle', dict.sourceArTitle);
            updateElementText('sourceArSub', dict.sourceArSub);
            updateElementText('sourceFrTitle', dict.sourceFrTitle);
            updateElementText('sourceFrSub', dict.sourceFrSub);
            updateElementText('labelTargetLang', dict.labelTargetLang);
            updateElementText('targetFrTitle', dict.targetFrTitle);
            updateElementText('targetFrSub', dict.targetFrSub);
            updateElementText('targetArTitle', dict.targetArTitle);
            updateElementText('targetArSub', dict.targetArSub);
            updateElementText('labelSubColor', dict.labelSubColor);
            updateElementText('colorYellowTitle', dict.colorYellowTitle);
            updateElementText('colorYellowSub', dict.colorYellowSub);
            updateElementText('colorWhiteTitle', dict.colorWhiteTitle);
            updateElementText('colorWhiteSub', dict.colorWhiteSub);
            updateElementText('colorGreenTitle', dict.colorGreenTitle);
            updateElementText('colorGreenSub', dict.colorGreenSub);
            updateElementText('colorCyanTitle', dict.colorCyanTitle);
            updateElementText('colorCyanSub', dict.colorCyanSub);
            updateElementText('labelSubPosition', dict.labelSubPosition);
            updateElementText('posBottomTitle', dict.posBottomTitle);
            updateElementText('posBottomSub', dict.posBottomSub);
            updateElementText('posMidTitle', dict.posMidTitle);
            updateElementText('posMidSub', dict.posMidSub);
            updateElementText('posTopTitle', dict.posTopTitle);
            updateElementText('posTopSub', dict.posTopSub);
            updateElementText('labelBgTheme', dict.labelBgTheme);
            updateElementText('audioNoticeBadge', dict.audioNoticeBadge);
            updateElementText('bgPalestineTitle', dict.bgPalestineTitle);
            updateElementText('bgPalestineSub', dict.bgPalestineSub);
            updateElementText('bgDarkTitle', dict.bgDarkTitle);
            updateElementText('bgDarkSub', dict.bgDarkSub);
            updateElementText('bgTurquoiseTitle', dict.bgTurquoiseTitle);
            updateElementText('bgTurquoiseSub', dict.bgTurquoiseSub);
            updateElementText('bgTemoignageTitle', dict.bgTemoignageTitle);
            updateElementText('bgTemoignageSub', dict.bgTemoignageSub);

            updateElementText('chkForceReprocessText', dict.chkForceReprocess);
            updateElementText('chkTiktokPackText', dict.chkTiktokPackText);
            updateElementText('chkTiktokPackSub', dict.chkTiktokPackSub);
            updateElementText('btnDownloadCover', dict.btnDownloadCover);
            updateElementText('btnDownloadDesc', dict.btnDownloadDesc);

            const btnSubmit = document.getElementById('btnSubmit');
            if (btnSubmit && !btnSubmit.disabled) {
                btnSubmit.innerHTML = dict.btnSubmitDefault;
            }
        }

        // Mise à jour du widget de feedback
        updateElementText('ayaFeedbackBtnText', dict.fbBtnText);
        updateElementText('ayaModalTitleText', dict.fbModalTitle);
        updateElementText('ayaFeedbackAgentBadge', dict.fbAgentBadge, true);
        updateElementText('ayaLabelName', dict.fbLabelName);
        updateElementPlaceholder('ayaTesterName', dict.fbPlaceholderName);
        updateElementText('ayaLabelMsg', dict.fbLabelMsg);
        updateElementPlaceholder('ayaRawMessage', dict.fbPlaceholderMsg);
        updateElementText('ayaSubmitFeedbackBtnText', dict.fbBtnSubmit, true);

        // Mise à jour de l'Espace Profil & Portefeuille (Issue #19)
        if (window.location.pathname.includes('profil') || document.getElementById('profileHeaderTitle')) {
            if (dict.profileDocTitle) document.title = dict.profileDocTitle;
            updateElementText('profileHeaderTitle', dict.profileHeaderTitle);
            updateElementText('profileHeaderSub', dict.profileHeaderSub);
            updateElementText('profileAdminTourBtnText', dict.profileAdminTourBtn, true);
            updateElementText('profileCardTitleText', dict.profileCardTitle, true);
            updateElementText('profileRoleBadge', dict.profileRoleContributor);
            updateElementText('profileAvatarOverlayText', dict.avatarOverlayText);
            updateElementText('profileAvatarHint', dict.avatarHintText, true);
            updateElementText('profileUniqueIdLabel', dict.profileUniqueIdLabel);
            updateElementText('profileNameLabel', dict.profileNameLabel);
            updateElementPlaceholder('profileNameInput', dict.profileNamePlaceholder);
            updateElementText('btnSaveName', dict.btnSaveName, true);
            updateElementText('profileEmailLabel', dict.profileEmailLabel);
            updateElementText('profileEmailStatus', dict.profileEmailStatusConfirmed, true);
            updateElementText('walletTitleText', dict.walletTitle, true);
            updateElementText('walletBadgeText', dict.walletBadgeText);
            updateElementText('walletAvailableLabel', dict.walletAvailableLabel);
            updateElementText('walletReservedLabel', dict.walletReservedLabel);
            updateElementText('btnRechargeWallet', dict.btnRechargeWallet, true);
            updateElementText('walletHint', dict.walletHint);
            updateElementText('historyTitleText', dict.historyTitle, true);
            updateElementText('btnRefreshHistory', dict.btnRefreshHistory, true);
            updateElementText('historyLoadingText', dict.historyLoadingText);
            updateElementText('historyEmptyTitle', dict.historyEmptyTitle);
            updateElementText('historyEmptySub', dict.historyEmptySub);
            updateElementText('btnStartFirstTrad', dict.btnStartFirstTrad, true);
            updateElementText('rechargeModalTitle', dict.rechargeModalTitle, true);
            updateElementText('rechargeBannerTitle', dict.rechargeBannerTitle, true);
            updateElementText('rechargeBannerText', dict.rechargeBannerText);
            updateElementText('paypalSolidarityTitle', dict.paypalSolidarityTitle, true);
            updateElementText('btnPaypalDonation', dict.btnPaypalDonation, true);
            const btnPaypalDonationEl = document.getElementById('btnPaypalDonation');
            if (btnPaypalDonationEl) btnPaypalDonationEl.href = 'https://paypal.me/sosoxm2026';

            // Traduction des cartes de packs Stripe dans la modale
            const packsContainer = document.getElementById('stripePacksContainer');
            if (packsContainer) {
                const pack1 = packsContainer.querySelector('[data-pack-id="pack_1"]');
                if (pack1) {
                    const title = pack1.querySelector('.pack-title');
                    const desc = pack1.querySelector('.pack-desc');
                    const unit = pack1.querySelector('.pack-unit-price');
                    const price = pack1.querySelector('.pack-price');
                    const btn = pack1.querySelector('.btn-stripe-buy');
                    if (title) title.textContent = dict.pack1Title;
                    if (desc) desc.textContent = dict.pack1Desc;
                    if (unit) unit.innerHTML = dict.pack1Unit;
                    if (price) price.innerHTML = dict.pack1Price;
                    if (btn) btn.innerHTML = dict.pack1Btn;
                }
                const pack5 = packsContainer.querySelector('[data-pack-id="pack_5"]');
                if (pack5) {
                    const title = pack5.querySelector('.pack-title');
                    const badge = pack5.querySelector('.pack-badge');
                    const desc = pack5.querySelector('.pack-desc');
                    const unit = pack5.querySelector('.pack-unit-price');
                    const price = pack5.querySelector('.pack-price');
                    const btn = pack5.querySelector('.btn-stripe-buy');
                    if (title) title.textContent = dict.pack5Title;
                    if (badge) badge.textContent = dict.pack5Badge;
                    if (desc) desc.textContent = dict.pack5Desc;
                    if (unit) unit.innerHTML = dict.pack5Unit;
                    if (price) price.innerHTML = dict.pack5Price;
                    if (btn) btn.innerHTML = dict.pack5Btn;
                }
                const pack25 = packsContainer.querySelector('[data-pack-id="pack_25"]');
                if (pack25) {
                    const title = pack25.querySelector('.pack-title');
                    const badge = pack25.querySelector('.pack-badge');
                    const desc = pack25.querySelector('.pack-desc');
                    const unit = pack25.querySelector('.pack-unit-price');
                    const price = pack25.querySelector('.pack-price');
                    const btn = pack25.querySelector('.btn-stripe-buy');
                    if (title) title.textContent = dict.pack25Title;
                    if (badge) badge.textContent = dict.pack25Badge;
                    if (desc) desc.textContent = dict.pack25Desc;
                    if (unit) unit.innerHTML = dict.pack25Unit;
                    if (price) price.innerHTML = dict.pack25Price;
                    if (btn) btn.innerHTML = dict.pack25Btn;
                }
            }
        }

        // Mise à jour de la page Studio TikTok V3
        if (window.location.pathname.includes('studio')) {
            if (dict.studioDocTitle) document.title = dict.studioDocTitle;
            updateElementText('studioHeroTitle', dict.studioHeroTitle);
            updateElementText('studioHeroSub', dict.studioHeroSub);
            updateElementText('sec1Title', dict.sec1Title);
            updateElementText('labelModeSelect', dict.labelModeSelect);
            updateElementText('modeHint', dict.modeHint);
            updateElementText('sec2Title', dict.sec2Title);
            updateElementText('labelMediaType', dict.labelMediaType);
            updateElementText('sourceMediaHint', dict.sourceMediaHint);
            updateElementText('labelBgFile', dict.labelBgFile);
            updateElementText('bgFileHint', dict.bgFileHint);
            updateElementText('sec3Title', dict.sec3Title);
            updateElementText('chkShowHeaderLabel', dict.chkShowHeader, true);
            updateElementText('labelHeaderText', dict.labelHeaderText);
            updateElementPlaceholder('header-text-input', dict.placeholderHeaderText);
            updateElementText('headerTextHint', dict.headerTextHint);
            updateElementText('labelHeaderColor', dict.labelHeaderColor);
            updateElementText('labelVideoTitle', dict.labelVideoTitle);
            updateElementPlaceholder('video-title', dict.placeholderVideoTitle);
            updateElementText('videoTitleHint', dict.videoTitleHint);
            updateElementText('labelTitleColor', dict.labelTitleColor);
            updateElementText('labelSubColorStudio', dict.labelSubColorStudio);
            updateElementText('sec4Title', dict.sec4Title);
            updateElementText('labelTitleMargin', dict.labelTitleMargin);
            updateElementText('labelSubMargin', dict.labelSubMargin);
            updateElementText('marginHint', dict.marginHint);
            updateElementText('sec5Title', dict.sec5Title);
            updateElementText('editorialHint', dict.editorialHint);
            updateElementText('chkMp4Label', dict.chkMp4, true);
            updateElementText('chkAssLabel', dict.chkAss, true);
            updateElementText('chkTxtLabel', dict.chkTxt, true);
            updateElementText('chkCoverLabel', dict.chkCover, true);
            updateElementText('simTitle', dict.simTitle);
            updateElementText('simRealtime', dict.simRealtime);

            updateElementText('optModeVostfr', dict.optModeVostfr);
            updateElementText('optModeVoar', dict.optModeVoar);
            updateElementText('optMediaAudio', dict.optMediaAudio);
            updateElementText('optMediaVideo', dict.optMediaVideo);

            const sourceMediaLabel = document.getElementById('source-media-label');
            const mediaType = document.getElementById('media-type');
            if (sourceMediaLabel && mediaType) {
                sourceMediaLabel.innerText = (mediaType.value === 'VIDEO') 
                    ? dict.sourceMediaVideoLabel 
                    : dict.sourceMediaAudioLabel;
            }

            const selectedFileDisplay = document.getElementById('selected-filename-display');
            const sourceMediaInput = document.getElementById('source-media-file');
            if (selectedFileDisplay && (!sourceMediaInput || !sourceMediaInput.files || sourceMediaInput.files.length === 0)) {
                selectedFileDisplay.textContent = dict.placeholderAudioFile;
            }

            const bgFileDisplay = document.getElementById('bg-filename-display');
            const bgFileInput = document.getElementById('bg-file');
            if (bgFileDisplay && (!bgFileInput || !bgFileInput.files || bgFileInput.files.length === 0)) {
                bgFileDisplay.textContent = dict.placeholderBgFile;
            }

            const btnSubmit = document.getElementById('btn-submit');
            if (btnSubmit && !btnSubmit.disabled) {
                btnSubmit.innerHTML = dict.btnGenerateStudio;
            }
        }

        // Mise à jour des liens du pied de page légal & solidaire
        const legalFooter = document.querySelector('.aya-legal-footer');
        if (legalFooter) {
            const cguLink = legalFooter.querySelector('a[href*="cgu"]');
            if (cguLink) cguLink.textContent = dict.footerCguLink;
            const privLink = legalFooter.querySelector('a[href*="confidentialite"]');
            if (privLink) privLink.textContent = dict.footerPrivacyLink;
            const paypalLink = legalFooter.querySelector('a[href*="paypal"]');
            if (paypalLink) {
                paypalLink.textContent = dict.footerPaypalLink;
                paypalLink.href = 'https://paypal.me/sosoxm2026';
            }
            const copyright = legalFooter.querySelector('.aya-legal-footer-copyright');
            if (copyright) copyright.textContent = dict.footerCopyright;
        }

        // Déclenchement d'un événement global pour les autres scripts
        window.dispatchEvent(new CustomEvent('aya:languageChanged', { detail: { lang, dict } }));
    }

    function updateElementText(id, text, isHtml = false) {
        const el = document.getElementById(id);
        if (el && text) {
            if (isHtml) el.innerHTML = text;
            else el.textContent = text;
        }
    }

    function updateElementPlaceholder(id, text) {
        const el = document.getElementById(id);
        if (el && text) el.setAttribute('placeholder', text);
    }

    function getUserSession() {
        try {
            return JSON.parse(localStorage.getItem('aya_user') || 'null');
        } catch (e) {
            return null;
        }
    }

    // 3. Construction de la Navbar Partagée Homogène & Navigation Moderne
    function initSharedNavbar() {
        const existingHeader = document.querySelector('header');
        if (!existingHeader) return;

        // Structure HTML standardisée
        existingHeader.className = 'app-header';
        existingHeader.id = 'ayaGlobalNavbar';

        const path = window.location.pathname;
        const isTraduction = path.includes('traduction');
        const isStudio = path.includes('studio');
        const isCommunaute = path.includes('communaute');
        const isModeration = path.includes('moderation');
        const isTraducteur = path.includes('traducteur');
        const isProfil = path.includes('profil');
        const isFiches = path.includes('fiches');
        const isChat = path.includes('chat') || path === '/chat-en-direct' || path === '/index.html' || (!isTraduction && !isStudio && !isCommunaute && !isModeration && !isTraducteur && !isProfil && !isFiches && !path.includes('cgu') && !path.includes('confidentialite') && !path.includes('login') && !path.includes('admin'));
        const isCreationActive = isTraduction || isStudio || isCommunaute || isTraducteur || isFiches;

        const dict = translations[currentLang] || translations.fr;

        existingHeader.innerHTML = `
            <div class="navbar-container">
                <!-- PÔLE GAUCHE : Identité de Marque -->
                <div class="navbar-brand">
                    <a href="/chat-en-direct" class="brand-link" title="Aya Studio Accueil">
                        <div class="avatar-badge">
                            <img src="/assets/logo_aya_icon.svg" alt="Aya Studio" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.outerHTML='<span class=\'avatar-initials\'>آية</span>'">
                            <span class="status-dot"></span>
                        </div>
                        <div class="brand-text">
                            <span class="brand-title" id="navbarBrandTitle">Aya Studio</span>
                            <span class="brand-badge-ai">Levant IA</span>
                        </div>
                    </a>
                </div>

                <!-- PÔLE CENTRAL : Navigation Épurée avec Menus Déroulants (Desktop) -->
                <nav class="navbar-nav" aria-label="Navigation principale" role="menubar">
                    <!-- 1. Salon d'Échange -->
                    <a href="/chat-en-direct" class="nav-link-modern ${isChat ? 'active' : ''}" id="navExchangeLink" role="menuitem">
                        <span class="nav-icon-live">💬</span>
                        <span id="navExchangeText">${dict.navExchangeText}</span>
                    </a>

                    <!-- 2. Outils de Création (Menu Déroulant Glassmorphism) -->
                    <div class="nav-dropdown-wrapper" id="dropdownCreationWrapper">
                        <button type="button" class="nav-dropdown-btn ${isCreationActive ? 'active' : ''}" id="btnDropdownCreation" aria-haspopup="true" aria-expanded="false" role="menuitem">
                            <span>🎨</span>
                            <span id="navCreationText">${dict.navCreationText}</span>
                            <span class="dropdown-chevron">▾</span>
                        </button>
                        <div class="nav-dropdown-menu" id="menuDropdownCreation" role="menu" aria-label="${dict.navCreationText}">
                            <a href="/traduction" class="dropdown-item ${isTraduction ? 'active' : ''}" role="menuitem">
                                <span class="dropdown-item-icon">✨</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navTranslationText">${dict.navTranslationText}</span>
                                    <span class="dropdown-item-desc" id="navTranslationSub">${dict.navTranslationSub}</span>
                                </div>
                            </a>
                            <a href="/studio" class="dropdown-item ${isStudio ? 'active' : ''}" role="menuitem">
                                <span class="dropdown-item-icon">🎬</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navVideoText">${dict.navVideoText}</span>
                                    <span class="dropdown-item-desc" id="navVideoSub">${dict.navVideoSub}</span>
                                </div>
                            </a>
                            <a href="/fiches" class="dropdown-item ${isFiches ? 'active' : ''}" role="menuitem">
                                <span class="dropdown-item-icon">🎴</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navCardsText">${dict.navCardsText}</span>
                                    <span class="dropdown-item-desc" id="navCardsSub">${dict.navCardsSub}</span>
                                </div>
                            </a>
                            <a href="/communaute" class="dropdown-item ${isCommunaute ? 'active' : ''}" role="menuitem">
                                <span class="dropdown-item-icon">🌍</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navCommunityText">${dict.navCommunityText}</span>
                                    <span class="dropdown-item-desc" id="navCommunitySub">${dict.navCommunitySub}</span>
                                </div>
                            </a>
                        </div>
                    </div>

                    <!-- 3. Mon Compte (Menu Déroulant Glassmorphism) -->
                    <div class="nav-dropdown-wrapper" id="dropdownAccountWrapper">
                        <button type="button" class="nav-dropdown-btn ${isProfil ? 'active' : ''}" id="btnDropdownAccount" aria-haspopup="true" aria-expanded="false" role="menuitem">
                            <span>👤</span>
                            <span id="navAccountText">${dict.navAccountText}</span>
                            <span class="dropdown-chevron">▾</span>
                        </button>
                        <div class="nav-dropdown-menu" id="menuDropdownAccount" role="menu" aria-label="${dict.navAccountText}">
                            <a href="/profil" class="dropdown-item ${isProfil ? 'active' : ''}" role="menuitem">
                                <span class="dropdown-item-icon">👤</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navProfileText">${dict.navProfileText}</span>
                                    <span class="dropdown-item-desc" id="dropdownUserName">--</span>
                                </div>
                            </a>
                            <a href="/profil#packs" class="dropdown-item" role="menuitem">
                                <span class="dropdown-item-icon">⚡</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navWalletText">${dict.navWalletText}</span>
                                    <span class="dropdown-item-desc"><strong id="dropdownCreditsCount">--</strong> crédits restants</span>
                                </div>
                            </a>
                            <a href="/profil#videos" class="dropdown-item" role="menuitem">
                                <span class="dropdown-item-icon">📜</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navCreationsText">${dict.navCreationsText}</span>
                                    <span class="dropdown-item-desc">Vidéos et fiches sauvegardées</span>
                                </div>
                            </a>
                            <div class="dropdown-divider"></div>
                            <button type="button" class="dropdown-item danger" id="dropdownLogoutBtn" role="menuitem">
                                <span class="dropdown-item-icon">🚪</span>
                                <div class="dropdown-item-content">
                                    <span class="dropdown-item-title" id="navLogoutText">${dict.navLogoutText}</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    ${isModeration ? `
                    <a href="/moderation" class="nav-link-modern active" id="navModerationLink">
                        <span>🛡️</span> <span id="navModerationText">${dict.navModerationText}</span>
                    </a>` : ''}
                </nav>

                <!-- PÔLE DROIT : Utilitaires, Solde & Langue -->
                <div class="navbar-actions">
                    <!-- Badge Présence / Personnes Connectées -->
                    <div class="navbar-online-pill" id="navbarOnlineBadge" title="${currentLang === 'ar' ? 'المستخدمون المتصلون حالياً' : 'Personnes connectées en direct'}">
                        <span class="online-pulse-dot"></span>
                        <span id="navbarOnlineCount" class="online-count-text">1 en ligne</span>
                    </div>

                    <!-- Badge Solde Crédits -->
                    <a href="/profil#packs" class="navbar-credits-pill" id="navbarCreditBadge" title="${currentLang === 'ar' ? 'عرض الرصيد والمحفظة' : 'Mon Portefeuille & Crédits'}">
                        <span class="credit-icon">⚡</span>
                        <span id="navbarCreditsCount" class="credit-count">--</span>
                        <span class="credit-unit">${currentLang === 'ar' ? 'رصيد' : 'Cr.'}</span>
                    </a>

                    <!-- Sélecteur de Langue Minimaliste (FR | عربي) -->
                    <div class="lang-switcher-pill">
                        <button class="lang-toggle-btn ${currentLang === 'fr' ? 'active' : ''}" id="langFrBtn" aria-label="Français">FR</button>
                        <span class="lang-sep">|</span>
                        <button class="lang-toggle-btn ${currentLang === 'ar' ? 'active' : ''}" id="langArBtn" aria-label="العربية">عربي</button>
                    </div>
                </div>
            </div>
        `;

        // ── Injection de la Bottom Navigation Mobile ──
        let bottomNav = document.getElementById('ayaBottomNav');
        if (!bottomNav) {
            bottomNav = document.createElement('nav');
            bottomNav.className = 'aya-bottom-nav';
            bottomNav.id = 'ayaBottomNav';
            bottomNav.setAttribute('aria-label', 'Navigation mobile');
            document.body.appendChild(bottomNav);
        }

        bottomNav.innerHTML = `
            <a href="/chat-en-direct" class="bottom-nav-item ${isChat ? 'active' : ''}" id="bottomNavExchange">
                <span class="bottom-nav-icon">💬</span>
                <span class="bottom-nav-label" id="bottomNavExchangeText">${dict.navExchangeText}</span>
            </a>
            <button type="button" class="bottom-nav-item-fab" id="bottomNavCreateFab" aria-label="${dict.navCreateActionText}">
                <span class="fab-circle">
                    <span class="fab-icon">➕</span>
                </span>
                <span class="bottom-nav-label" id="bottomNavCreateText">${dict.navCreateActionText}</span>
            </button>
            <a href="/profil" class="bottom-nav-item ${isProfil ? 'active' : ''}" id="bottomNavAccount">
                <span class="bottom-nav-icon">👤</span>
                <span class="bottom-nav-label" id="bottomNavAccountText">${dict.navAccountText}</span>
            </a>
            <div id="bottomNavAdminContainer" style="display: none; height: 100%;"></div>
        `;

        // ── Injection de la Bottom Sheet Mobile (Tiroir d'actions coulissant) ──
        let sheetBackdrop = document.getElementById('ayaActionSheetBackdrop');
        if (!sheetBackdrop) {
            sheetBackdrop = document.createElement('div');
            sheetBackdrop.className = 'aya-action-sheet-backdrop';
            sheetBackdrop.id = 'ayaActionSheetBackdrop';
            sheetBackdrop.style.display = 'none';
            document.body.appendChild(sheetBackdrop);
        }

        let actionSheet = document.getElementById('ayaActionSheet');
        if (!actionSheet) {
            actionSheet = document.createElement('div');
            actionSheet.className = 'aya-action-sheet';
            actionSheet.id = 'ayaActionSheet';
            actionSheet.style.display = 'none';
            actionSheet.setAttribute('role', 'dialog');
            actionSheet.setAttribute('aria-modal', 'true');
            actionSheet.setAttribute('aria-label', dict.navCreationText);
            document.body.appendChild(actionSheet);
        }

        actionSheet.innerHTML = `
            <div class="sheet-drag-handle"></div>
            <div class="sheet-header">
                <div class="sheet-title-wrap">
                    <span style="font-size: 1.3rem;">🎨</span>
                    <h3 class="sheet-title" id="sheetCreationTitle">${dict.navCreationText}</h3>
                </div>
                <button type="button" class="sheet-close-btn" id="btnSheetClose" aria-label="${dict.navCloseSheetText}">✕</button>
            </div>
            <div class="sheet-grid">
                <a href="/traduction" class="sheet-card ${isTraduction ? 'active' : ''}">
                    <div class="sheet-card-icon">✨</div>
                    <div class="sheet-card-info">
                        <strong id="sheetTransTitle">${dict.navTranslationText}</strong>
                        <small id="sheetTransSub">${dict.navTranslationSub}</small>
                    </div>
                    <span class="sheet-card-arrow">➔</span>
                </a>
                <a href="/studio" class="sheet-card ${isStudio ? 'active' : ''}">
                    <div class="sheet-card-icon">🎬</div>
                    <div class="sheet-card-info">
                        <strong id="sheetVideoTitle">${dict.navVideoText}</strong>
                        <small id="sheetVideoSub">${dict.navVideoSub}</small>
                    </div>
                    <span class="sheet-card-arrow">➔</span>
                </a>
                <a href="/fiches" class="sheet-card ${isFiches ? 'active' : ''}">
                    <div class="sheet-card-icon">🎴</div>
                    <div class="sheet-card-info">
                        <strong id="sheetCardsTitle">${dict.navCardsText}</strong>
                        <small id="sheetCardsSub">${dict.navCardsSub}</small>
                    </div>
                    <span class="sheet-card-arrow">➔</span>
                </a>
                <a href="/communaute" class="sheet-card ${isCommunaute ? 'active' : ''}">
                    <div class="sheet-card-icon">🌍</div>
                    <div class="sheet-card-info">
                        <strong id="sheetCommTitle">${dict.navCommunityText}</strong>
                        <small id="sheetCommSub">${dict.navCommunitySub}</small>
                    </div>
                    <span class="sheet-card-arrow">➔</span>
                </a>
            </div>
        `;

        // ── Gestion des Menus Déroulants Desktop ──
        const creationWrapper = document.getElementById('dropdownCreationWrapper');
        const btnCreation = document.getElementById('btnDropdownCreation');
        const accountWrapper = document.getElementById('dropdownAccountWrapper');
        const btnAccount = document.getElementById('btnDropdownAccount');

        function closeAllDropdowns() {
            if (creationWrapper) {
                creationWrapper.classList.remove('open');
                if (btnCreation) btnCreation.setAttribute('aria-expanded', 'false');
            }
            if (accountWrapper) {
                accountWrapper.classList.remove('open');
                if (btnAccount) btnAccount.setAttribute('aria-expanded', 'false');
            }
        }

        if (btnCreation) {
            btnCreation.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = creationWrapper.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) {
                    creationWrapper.classList.add('open');
                    btnCreation.setAttribute('aria-expanded', 'true');
                }
            });
        }

        if (btnAccount) {
            btnAccount.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = accountWrapper.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) {
                    accountWrapper.classList.add('open');
                    btnAccount.setAttribute('aria-expanded', 'true');
                }
            });
        }

        // ── Gestion de la Bottom Sheet Mobile ──
        const btnFab = document.getElementById('bottomNavCreateFab');
        const btnCloseSheet = document.getElementById('btnSheetClose');

        function openActionSheet() {
            closeAllDropdowns();
            if (sheetBackdrop) sheetBackdrop.style.display = 'block';
            if (actionSheet) {
                actionSheet.style.display = 'block';
                requestAnimationFrame(() => actionSheet.classList.add('open'));
            }
            document.body.style.overflow = 'hidden';
        }

        function closeActionSheet() {
            if (actionSheet) {
                actionSheet.classList.remove('open');
                setTimeout(() => {
                    actionSheet.style.display = 'none';
                    if (sheetBackdrop) sheetBackdrop.style.display = 'none';
                }, 280);
            } else if (sheetBackdrop) {
                sheetBackdrop.style.display = 'none';
            }
            document.body.style.overflow = '';
        }

        if (btnFab) btnFab.addEventListener('click', openActionSheet);
        if (btnCloseSheet) btnCloseSheet.addEventListener('click', closeActionSheet);
        if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeActionSheet);

        actionSheet.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', closeActionSheet);
        });

        // ── Accessibilité WCAG : Clic extérieur & Touche Échap ──
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-dropdown-wrapper')) {
                closeAllDropdowns();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeAllDropdowns();
                closeActionSheet();
            }
        });

        // Événements du switcher
        const btnFr = document.getElementById('langFrBtn');
        const btnAr = document.getElementById('langArBtn');
        if (btnFr) btnFr.addEventListener('click', () => setLanguage('fr'));
        if (btnAr) btnAr.addEventListener('click', () => setLanguage('ar'));

        // Événement de déconnexion
        const logoutBtn = document.getElementById('dropdownLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('aya_user');
                window.location.href = '/logout';
            });
        }

        // Application de la langue enregistrée
        setLanguage(currentLang);

        // Initialisation de la surveillance de présence en direct
        updatePresence();

        // ── Détection Admin & Injection Sécurisée du lien Tour de Contrôle ──
        (async function checkAdminStatus() {
            let isAdmin = false;
            try {
                const localUser = JSON.parse(localStorage.getItem('aya_user') || '{}');
                if (localUser.role === 'admin' || (localUser.email && localUser.email.toLowerCase() === 'artas971@gmail.com') || localUser.username === 'john') {
                    isAdmin = true;
                }
            } catch(e) {}

            try {
                const res = await fetch('/api/user/profile');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.userProfile) {
                        const u = data.userProfile;
                        if (u.role === 'admin' || (u.email && u.email.toLowerCase() === 'artas971@gmail.com') || u.username === 'john') {
                            isAdmin = true;
                            try { localStorage.setItem('aya_user', JSON.stringify(u)); } catch(e) {}
                        }
                    }
                }
            } catch(e) {}

            if (isAdmin) {
                // Desktop
                const navNav = document.querySelector('.navbar-nav');
                if (navNav && !document.getElementById('navAdminLink')) {
                    const isAdminPage = window.location.pathname.includes('admin');
                    const adminLink = document.createElement('a');
                    adminLink.href = '/admin.html';
                    adminLink.className = `nav-link-modern ${isAdminPage ? 'active' : ''}`;
                    adminLink.id = 'navAdminLink';
                    adminLink.style.cssText = 'background: rgba(0, 188, 212, 0.15); border: 1px solid rgba(0, 188, 212, 0.4); color: #67e8f9;';
                    adminLink.innerHTML = `<span>🛡️</span> <span id="navAdminText">${dict.navAdminText || 'Tour de Contrôle'}</span>`;
                    navNav.appendChild(adminLink);
                }

                // Mobile
                const bottomAdminContainer = document.getElementById('bottomNavAdminContainer');
                if (bottomAdminContainer) {
                    bottomAdminContainer.style.display = 'block';
                    bottomAdminContainer.innerHTML = `
                        <a href="/admin.html" class="bottom-nav-item ${window.location.pathname.includes('admin') ? 'active' : ''}" id="bottomNavAdmin">
                            <span class="bottom-nav-icon">🛡️</span>
                            <span class="bottom-nav-label" id="bottomNavAdminText">${dict.navAdminText || 'Admin'}</span>
                        </a>
                    `;
                }

                const adminProfileBtn = document.getElementById('adminTourBtnContainer');
                if (adminProfileBtn) {
                    adminProfileBtn.style.display = 'block';
                }
            }
        })();
    }


    /**
     * Surveillance et affichage dynamique du nombre d'utilisateurs connectés en direct
     */
    async function updatePresence() {
        try {
            const res = await fetch('/api/presence');
            if (!res.ok) return;
            const data = await res.json();
            if (data && typeof data.count === 'number') {
                const navBadge = document.getElementById('navbarOnlineCount');
                const chatBadge = document.getElementById('chatOnlineCount');
                const isAr = (currentLang === 'ar' || document.documentElement.getAttribute('dir') === 'rtl');
                const count = Math.max(1, data.count);
                const text = isAr 
                    ? `${count} ${count > 1 ? 'متصلين' : 'متصل'}` 
                    : `${count} en ligne`;
                if (navBadge) navBadge.textContent = text;
                if (chatBadge) chatBadge.textContent = text;
            }
        } catch (e) {}
    }

    // Intervalle de rafraîchissement de présence (toutes les 12 secondes)
    setInterval(updatePresence, 12000);

    /**
     * Récupère les informations d'une erreur adaptée au Grand Public selon la langue courante
     */
    function getErrorInfo(code, rawMessage = null) {
        const lang = currentLang || localStorage.getItem('aya_lang') || 'fr';
        const dict = translations[lang] || translations.fr;
        const errDict = dict.errors || {};

        let key = code;
        if (!key || !errDict[key]) {
            if (rawMessage && (/media\s+is\s+too\s+big/i.test(rawMessage) || rawMessage.includes('trop lourde') || rawMessage.includes('trop volumineux'))) {
                key = 'MEDIA_TOO_BIG';
            } else if (rawMessage && (/ffprobe/i.test(rawMessage) || rawMessage.includes('invalide') || rawMessage.includes('corrompu') || rawMessage.includes('aucun flux'))) {
                key = 'INVALID_MEDIA';
            } else if (rawMessage && (/quota/i.test(rawMessage) || rawMessage.includes('429') || rawMessage.includes('surchargés') || rawMessage.includes('resource_exhausted'))) {
                key = 'AI_QUOTA_EXCEEDED';
            } else if (rawMessage && (/network/i.test(rawMessage) || rawMessage.includes('réseau') || rawMessage.includes('Failed to fetch') || rawMessage.includes('communication'))) {
                key = 'NETWORK_ERROR';
            } else if (rawMessage && (rawMessage.includes('aucun fichier') || rawMessage.includes('aucun média'))) {
                key = 'NO_MEDIA_PROVIDED';
            } else {
                key = 'DEFAULT';
            }
        }

        const info = errDict[key] || errDict.DEFAULT || {
            title: lang === 'ar' ? "تعذر إتمام المعالجة" : "Incident de traitement",
            message: rawMessage || (lang === 'ar' ? "حدث خطأ غير متوقع." : "Une erreur inattendue est survenue."),
            solution: lang === 'ar' ? "يرجى التحقق من الملف والمحاولة مرة أخرى." : "Veuillez vérifier votre fichier et réessayer.",
            severity: "danger",
            actionLabel: lang === 'ar' ? "إعادة المحاولة" : "Réessayer"
        };

        return {
            code: key,
            title: info.title,
            message: info.message || rawMessage,
            solution: info.solution,
            severity: info.severity || 'danger',
            actionLabel: info.actionLabel || (lang === 'ar' ? "إعادة المحاولة" : "Réessayer")
        };
    }

    // Exposition globale
    window.AyaI18n = {
        get currentLang() { return currentLang; },
        translations,
        setLanguage,
        initSharedNavbar,
        getErrorInfo
    };

    // Initialisation automatique au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSharedNavbar);
    } else {
        initSharedNavbar();
    }
})();
