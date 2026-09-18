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
            navbarLiveText: 'Serveur Actif',

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
            btnDownloadMp4Video: '⬇️ Télécharger la Vidéo MP4 (Format original)',
            btnDownloadMp4Audio: '⬇️ Télécharger la Vidéo MP4 (Format 9:16)',
            btnDownloadAss: '📄 Télécharger le fichier .ASS',
            btnDownloadCover: '🖼️ Télécharger la Couverture 9:16 (Lionel)',
            btnDownloadDesc: '📝 Télécharger le Copywriting TikTok (Steve)',

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
            errTelegramTooBig: '⚠️ Cette vidéo Telegram est trop lourde pour un import automatique. Veuillez la télécharger manuellement depuis Telegram et utiliser l\'envoi de fichier classique.'
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
            navbarLiveText: 'الخادم نشط ومتصل',

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
            btnDownloadMp4Video: '⬇️ تحميل الفيديو النهائي (MP4)',
            btnDownloadMp4Audio: '⬇️ تحميل الفيديو النهائي بصيغة 9:16',
            btnDownloadAss: '📄 تحميل ملف الترجمة (.ASS)',
            btnDownloadCover: '🖼️ تحميل غلاف تيك توك 9:16 (ليونيل)',
            btnDownloadDesc: '📝 تحميل نصوص النشر والوصف (ستيف)',

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
            errTelegramTooBig: '⚠️ هذا الفيديو من تيليجرام كبير جداً ولا يمكن استيراده تلقائياً عبر الرابط. يرجى تنزيله يدوياً من تيليجرام ورفعه مباشرة كملف.'
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
        updateElementText('navbarLiveText', dict.navbarLiveText);

        const userObj = getUserSession();
        const userNameSpan = document.getElementById('navbarUserName');
        if (userNameSpan) {
            const name = userObj ? (userObj.name || userObj.username) : dict.userAnonymous;
            userNameSpan.textContent = `${dict.userConnectedPrefix} ${name}`;
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
        const isHome = !isTraduction && !isStudio;

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

    // Exposition globale
    window.AyaI18n = {
        currentLang,
        translations,
        setLanguage,
        initSharedNavbar
    };

    // Initialisation automatique au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSharedNavbar);
    } else {
        initSharedNavbar();
    }
})();
