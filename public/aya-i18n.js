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
            navbarBrandTitle: 'وكيل التَّرْجَمَة آيَة <span class="badge-tag green">Arabe Palestinien ↔ Français</span>',
            navbarBrandSub: 'Studio de doublage, transcription et synchronisation instantanée',
            userConnectedPrefix: '👤 Connecté :',
            userAnonymous: 'Invité / Testeur',
            logoutBtnTitle: 'Se déconnecter',
            navHomeText: 'Accueil / Vocal',
            navTraductionText: 'Traduction & Sous-titres',
            navStudioText: 'Studio TikTok V3',
            navCommunauteText: 'Communauté',
            navModerationText: 'Modération',
            navbarLiveText: 'Serveur Actif',

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
            modeVideoSub: 'Incrustation sous-titres 9:16 & encodage FFmpeg',
            modeExpressTitle: '⚡ Mode Express (Texte Uniquement)',
            modeExpressSub: 'Traduction directe en texte Markdown (< 5s)',

            // Restitution Express
            expressResultTitle: '<span>⚡</span> Traduction Texte Express prête',
            expressSubTitle: 'Restitution instantanée sans encodage vidéo • Format Markdown',
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
            targetFrTitle: 'VOSTFR - Français',
            targetFrSub: 'Sous-titres traduits ou retranscrits en français',
            targetArTitle: 'VOAR - Arabe',
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
            audioNoticeBadge: '✨ Vidéo 9:16 automatique pour audios purs',
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
            chkTiktokPackText: 'Générer le Pack TikTok (Couverture 9:16 & Copywriting)',
            chkTiktokPackSub: 'Optionnel : Couverture 9:16 abstraite (Lionel) & Rédaction optimisée (Steve)',

            // Progression
            statusInit: 'Initialisation du pipeline...',
            logConnected: 'Connexion au serveur établie...',

            // Résultats & Téléchargements
            resultStatusReady: '<span>✅</span> Vidéo sous-titrée disponible',
            successTitleVideo: 'Vidéo générée avec succès !',
            successSubtitleVideo: 'Votre média est prêt à être prévisualisé et partagé.',
            btnDownloadVideoMain: '⬇️ Télécharger la Vidéo',
            btnDownloadSubtitlesMain: '📄 Télécharger les sous-titres',
            btnDownloadMp4Video: '⬇️ Télécharger la Vidéo MP4 (Format original)',
            btnDownloadMp4Audio: '⬇️ Télécharger la Vidéo MP4 (Format 9:16)',
            btnDownloadAss: '📄 Télécharger le fichier .ASS',
            btnDownloadCover: '🖼️ Télécharger la Couverture 9:16 (Lionel)',
            btnDownloadDesc: '📝 Télécharger le Copywriting TikTok (Steve)',
            btnDriveBackup: 'Lien de Sauvegarde',
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
            }
        },
        ar: {
            dir: 'rtl',
            // Navbar Globale
            navbarBrandTitle: 'وكيل التَّرْجَمَة آيَة <span class="badge-tag green">عربي فلسطيني ↔ فرنسي</span>',
            navbarBrandSub: 'استوديو الدبلجة والترجمة الفورية للفيديوهات والتسجيلات',
            userConnectedPrefix: '👤 متصل باسم:',
            userAnonymous: 'زائر / فاحص',
            logoutBtnTitle: 'تسجيل الخروج',
            navHomeText: 'الرئيسية / صوتي',
            navTraductionText: 'الترجمة والدبلجة',
            navStudioText: 'استوديو تيك توك V3',
            navCommunauteText: 'المجتمع',
            navModerationText: 'الإشراف',
            navbarLiveText: 'الخادم نشط ومتصل',

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
            modeVideoSub: 'دمج شريط الترجمة بالكامل وترميز الفيديو 9:16',
            modeExpressTitle: '⚡ النمط السريع (نص فقط)',
            modeExpressSub: 'ترجمة نصية مباشرة بتنسيق ماركداون (< 5 ثوانٍ)',

            // Restitution Express
            expressResultTitle: '<span>⚡</span> الترجمة النصية السريعة جاهزة',
            expressSubTitle: 'تسليم فوري بدون ترميز الفيديو • بتنسيق ماركداون',
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
            targetFrTitle: 'الفرنسية (VOSTFR)',
            targetFrSub: 'شريط ترجمة بالفرنسية الفصيحة والمعاصرة',
            targetArTitle: 'العربية (VOAR)',
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
            audioNoticeBadge: '✨ فيديو 9:16 تلقائي للملفات الصوتية فقط',
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
            chkTiktokPackText: 'إنشاء حزمة تيك توك (غلاف 9:16 ونصوص النشر)',
            chkTiktokPackSub: 'اختياري: غلاف تجريدي 9:16 (ليونيل) ونصوص ترويجية محسنة (ستيف)',

            // Progression
            statusInit: 'جاري تشغيل خط الإنتاج...',
            logConnected: 'تم الاتصال بالخادم بنجاح...',

            // Résultats & Téléchargements
            resultStatusReady: '<span>✅</span> الفيديو المترجم جاهز للتحميل والمعاينة',
            successTitleVideo: 'تم إنشاء الفيديو بنجاح!',
            successSubtitleVideo: 'الوسائط المترجمة جاهزة للمعاينة والتحميل الفوري.',
            btnDownloadVideoMain: '⬇️ تحميل الفيديو',
            btnDownloadSubtitlesMain: '📄 تحميل ملف الترجمة',
            btnDownloadMp4Video: '⬇️ تحميل الفيديو النهائي (MP4)',
            btnDownloadMp4Audio: '⬇️ تحميل الفيديو النهائي بصيغة 9:16',
            btnDownloadAss: '📄 تحميل ملف الترجمة (.ASS)',
            btnDownloadCover: '🖼️ تحميل غلاف تيك توك 9:16 (ليونيل)',
            btnDownloadDesc: '📝 تحميل نصوص النشر والوصف (ستيف)',
            btnDriveBackup: 'رابط النسخ الاحتياطي',
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
            }
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
        updateElementText('navbarLiveText', dict.navbarLiveText);

        const userObj = getUserSession();
        const userNameSpan = document.getElementById('navbarUserName');
        if (userNameSpan) {
            const name = userObj ? (userObj.name || userObj.username) : dict.userAnonymous;
            userNameSpan.textContent = `${dict.userConnectedPrefix} ${name}`;
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

    // 3. Construction de la Navbar Partagée Homogène
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
        const isHome = !isTraduction && !isStudio && !isCommunaute && !isModeration;

        const dict = translations[currentLang] || translations.fr;

        existingHeader.innerHTML = `
            <div class="brand">
                <div class="avatar-badge">
                    <span class="avatar-initials">آية</span>
                    <span class="status-dot"></span>
                </div>
                <div>
                    <h1 id="navbarBrandTitle">${dict.navbarBrandTitle}</h1>
                    <p class="subtitle" id="navbarBrandSub">${dict.navbarBrandSub}</p>
                </div>
            </div>
            <div class="header-actions">
                <!-- Statut Utilisateur & Déconnexion -->
                <div class="user-badge" id="navbarUserBadge">
                    <span id="navbarUserName">👤 متصل</span>
                    <button class="btn-logout" id="navbarLogoutBtn" title="${dict.logoutBtnTitle}">🚪</button>
                </div>
                <!-- Sélecteur de Langue Dynamique -->
                <div class="lang-switcher">
                    <button class="lang-toggle-btn ${currentLang === 'fr' ? 'active' : ''}" id="langFrBtn">🇫🇷 FR</button>
                    <button class="lang-toggle-btn ${currentLang === 'ar' ? 'active' : ''}" id="langArBtn">🇵🇸 العربية</button>
                </div>
                <!-- Lien 1 : Accueil / Vocal -->
                <a href="/" class="btn-nav-link ${isHome ? 'active' : ''}" id="navHomeLink">
                    <span>💬</span> <span id="navHomeText">${dict.navHomeText}</span>
                </a>
                <!-- Lien 2 : Traduction & Sous-titres -->
                <a href="/traduction" class="btn-nav-link ${isTraduction ? 'active' : ''}" id="navTraductionLink">
                    <span>✨</span> <span id="navTraductionText">${dict.navTraductionText}</span>
                </a>
                <!-- Lien 3 : Studio TikTok V3 -->
                <a href="/studio" class="btn-nav-link ${isStudio ? 'active' : ''}" id="navStudioLink">
                    <span>🎬</span> <span id="navStudioText">${dict.navStudioText}</span>
                </a>
                <!-- Lien 4 : Mur Communautaire -->
                <a href="/communaute" class="btn-nav-link ${isCommunaute ? 'active' : ''}" id="navCommunauteLink">
                    <span>🌍</span> <span id="navCommunauteText">${dict.navCommunauteText}</span>
                </a>
                <!-- Lien 5 : Modération (Discret) -->
                <a href="/moderation" class="btn-nav-link ${isModeration ? 'active' : ''}" id="navModerationLink" title="${dict.navModerationText}" style="opacity: 0.88;">
                    <span>🛡️</span> <span id="navModerationText">${dict.navModerationText}</span>
                </a>
                <span class="live-indicator" id="navbarLiveIndicator"><span class="pulse"></span> <span id="navbarLiveText">${dict.navbarLiveText}</span></span>
            </div>
        `;

        // Événements du switcher
        const btnFr = document.getElementById('langFrBtn');
        const btnAr = document.getElementById('langArBtn');
        if (btnFr) btnFr.addEventListener('click', () => setLanguage('fr'));
        if (btnAr) btnAr.addEventListener('click', () => setLanguage('ar'));

        // Événement de déconnexion
        const logoutBtn = document.getElementById('navbarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('aya_user');
                window.location.href = '/logout';
            });
        }

        // Application de la langue enregistrée
        setLanguage(currentLang);
    }

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
