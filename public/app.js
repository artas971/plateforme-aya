document.addEventListener('DOMContentLoaded', () => {
    document.cookie = "bypass-tunnel-reminder=true; path=/; max-age=31536000";

    async function safeFetchJson(url, options = {}) {
        options.headers = options.headers || {};
        if (!(options.body instanceof FormData)) {
            if (!options.headers['Content-Type'] && !options.headers['content-type'] && options.method && options.method.toUpperCase() !== 'GET') {
                options.headers['Content-Type'] = 'application/json';
            }
        }
        options.headers['Bypass-Tunnel-Reminder'] = 'true';
        options.headers['bypass-tunnel-reminder'] = 'true';

        let res;
        try {
            res = await fetch(url, options);
        } catch (netErr) {
            throw new Error("Impossible de se connecter au serveur (" + netErr.message + ")");
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await res.text();
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                throw new Error("Page d'avertissement Cloudflare Tunnel ou erreur HTML détectée. Veuillez rafraîchir la page ou vérifier la connexion.");
            }
            throw new Error(`Réponse serveur non-JSON (${res.status}) : ${text.substring(0, 100)}`);
        }

        const data = await res.json();
        if (!res.ok && !data.error) {
            data.error = `Erreur serveur HTTP ${res.status}`;
        }
        return data;
    }

    async function pollJobResult(jobId) {
        const maxAttempts = 180;
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusData = await safeFetchJson(`/api/job-status/${jobId}`);
            if (statusData.status === 'completed') {
                return statusData.result;
            }
            if (statusData.status === 'failed') {
                throw new Error(statusData.error || "Échec du traitement audio");
            }
        }
        throw new Error("Délai d'attente dépassé pour la traduction");
    }

    // DOM Elements Retrieval
    const htmlTag = document.getElementById('htmlTag');
    const langFrBtn = document.getElementById('langFrBtn');
    const langArBtn = document.getElementById('langArBtn');
    const modalLangFrBtn = document.getElementById('modalLangFrBtn');
    const modalLangArBtn = document.getElementById('modalLangArBtn');

    const loginModal = document.getElementById('loginModal');
    const loginUsernameInput = document.getElementById('loginUsernameInput');
    const loginPasswordInput = document.getElementById('loginPasswordInput');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const userBadge = document.getElementById('userBadge');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    const recordMicBtn = document.getElementById('recordMicBtn');
    const recIcon = document.getElementById('recIcon');
    const recBtnText = document.getElementById('recBtnText');
    const recTimer = document.getElementById('recTimer');

    const audioSelect = document.getElementById('audioSelect');
    const selectAudioTargetLang = document.getElementById('selectAudioTargetLang');
    const adminLocalFilesSection = document.getElementById('adminLocalFilesSection');
    const processAudioBtn = document.getElementById('processAudioBtn');
    const sendReceivedAudioToJohnBtn = document.getElementById('sendReceivedAudioToJohnBtn');
    const receivedAudioActionsStack = document.getElementById('receivedAudioActionsStack');
    const sendReceivedAudioWhatsAppBtn = document.getElementById('sendReceivedAudioWhatsAppBtn');
    const downloadReceivedAudioBtn = document.getElementById('downloadReceivedAudioBtn');

    // Beta Mode Video Subtitles DOM Elements
    const betaSubtitleSection = document.getElementById('betaSubtitleSection');
    const assEditorTextarea = document.getElementById('assEditorTextarea');
    const btnBurnSubtitles = document.getElementById('btnBurnSubtitles');
    let currentVideoFilename = null;
    let currentAssFilename = null;
    
    const ayaVideo = document.getElementById('ayaVideo');
    const ayaAudio = document.getElementById('ayaAudio');
    const arabicText = document.getElementById('arabicText');
    const phoneticText = document.getElementById('phoneticText');
    const frenchText = document.getElementById('frenchText');
    const frenchAudio = document.getElementById('frenchAudio');
    const playFrenchBtn = document.getElementById('playFrenchBtn');
    const vocabChips = document.getElementById('vocabChips');

    const copyArabicTextBtn = document.getElementById('copyArabicTextBtn');
    const copyFrenchTextBtn = document.getElementById('copyFrenchTextBtn');

    const voiceSelect = document.getElementById('voiceSelect');
    const replyInputFr = document.getElementById('replyInputFr');
    const replyInputAr = document.getElementById('replyInputAr');
    const generateReplyFrBtn = document.getElementById('generateReplyFrBtn');
    const generateReplyArBtn = document.getElementById('generateReplyArBtn');

    const replyResult = document.getElementById('replyResult');
    const arabicReplyText = document.getElementById('arabicReplyText');
    const arabicReplyAudio = document.getElementById('arabicReplyAudio');
    const copyReplyArabicBtn = document.getElementById('copyReplyArabicBtn');
    const flagResult = document.getElementById('flagResult');
    
    const sendAudioToJohnBtn = document.getElementById('sendAudioToJohnBtn');
    const sendAudioWhatsAppBtn = document.getElementById('sendAudioWhatsAppBtn');
    const downloadAudioBtn = document.getElementById('downloadAudioBtn');
    const purgeAudioBtn = document.getElementById('purgeAudioBtn');

    const triggerFileBrowseBtn = document.getElementById('triggerFileBrowseBtn');
    const directFileInput = document.getElementById('directFileInput');
    const uploadTargetLangSelect = document.getElementById('uploadTargetLangSelect');

    const chatHistoryBox = document.getElementById('chatHistoryBox');
    const chatInputText = document.getElementById('chatInputText');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatMicBtn = document.getElementById('chatMicBtn');

    // Admin Chat Toolbar Elements
    const adminChatToolbar = document.getElementById('adminChatToolbar');
    const adminToggleChatBtn = document.getElementById('adminToggleChatBtn');
    const adminArchiveChatBtn = document.getElementById('adminArchiveChatBtn');
    const adminResetChatBtn = document.getElementById('adminResetChatBtn');
    let isChatDisabled = false;

    // WhatsApp Desktop Guidance Modal Elements
    const whatsappGuidanceModal = document.getElementById('whatsappGuidanceModal');
    const closeWhatsAppGuidanceBtn = document.getElementById('closeWhatsAppGuidanceBtn');
    const waDismissBtn = document.getElementById('waDismissBtn');
    const waOpenWebBtn = document.getElementById('waOpenWebBtn');
    const waGuidanceFileName = document.getElementById('waGuidanceFileName');

    // App State Variables
    let audioDataList = [];
    let currentGeneratedAudioFile = "";
    let currentArabicTranslation = "";
    let currentAudioUrl = "";
    let currentReceivedAudioUrl = "";
    let currentReceivedAudioFile = "";
    let currentUser = JSON.parse(localStorage.getItem('aya_user') || 'null');
    let currentLang = localStorage.getItem('aya_lang') || 'ar';
    let currentChatAudio = null;

    // Microphone Recording Variables
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let recInterval = null;
    let recSeconds = 0;

    // Chat Microphone Recording Variables
    let chatMediaRecorder = null;
    let chatAudioChunks = [];
    let isChatRecording = false;

    // Complete i18n Dictionary
    const i18n = {
        fr: {
            dir: "ltr",
            pageTitle: 'Aya Translator Agent | Traduction Audio Arabe-Français',
            loginTitle: 'Connexion Sécurisée - Agent Aya',
            loginSub: 'Entrez votre nom d\'utilisateur et mot de passe pour vous connecter :',
            labelUsername: 'Identifiant / Nom d\'utilisateur :',
            labelPassword: 'Mot de passe :',
            loginUsernamePlaceholder: 'Identifiant (ex: aya ou soso)...',
            loginPasswordPlaceholder: 'Mot de passe...',
            loginBtn: '🔓 Se Connecter',
            loginErrorText: '❌ Identifiant ou mot de passe incorrect.',
            headerTitle: 'Agent Traducteur Aya <span class="badge-tag">Arabe Palestinien ↔ Français</span>',
            headerSub: 'Traduisez vos audios et générez vos réponses en un clic',
            userConnectedPrefix: '👤 Connecté :',
            logoutBtnTitle: 'Se déconnecter',
            navStudioText: 'Studio TikTok V3',
            liveIndicatorText: '<span class="pulse"></span> Serveur Actif (localhost:3000)',
            titleReceived: "Fichiers Audio reçus d'Aya",
            msgTime: "Dossier audio_a_traiter",
            titleDirectUpload: '📤 Envoyer un fichier Audio / Vidéo à traduire',
            subDirectUpload: 'Sélectionnez la langue souhaitée avant d\'envoyer votre fichier (enregistré dans audio_a_traiter) :',
            labelUploadTargetLang: 'Langue cible de la traduction :',
            uploadOptFr: '🇫🇷 Traduire en Français (Audio/Vidéo en Arabe)',
            uploadOptAr: '🇵🇸 Traduire en Arabe Palestinien (Audio/Vidéo en Français)',
            triggerFileBrowseBtn: '📁 Choisir un fichier Audio/Vidéo & Traduire',
            titleMicRec: '🎙️ Enregistrer une note vocale en direct (Microphone)',
            subMicRec: 'Parlez dans votre micro pour enregistrer et traduire directement :',
            recBtnText: 'Commencer l\'enregistrement',
            recStopBtnText: 'Arrêter & Traduire',
            labelAudioSelect: "📂 Choisir l'audio/vidéo à traduire :",
            labelSelectAudioTargetLang: 'Langue de la traduction à générer :',
            selectTargetOptFr: '🇫🇷 Traduire & Vocaliser en Français',
            selectTargetOptAr: '🇵🇸 Traduire & Vocaliser en Arabe Palestinien',
            processAudioBtn: '<span class="btn-icon">✨</span> Générer la Note Vocale en Français',
            processAudioBtnFr: '<span class="btn-icon">✨</span> Générer la Note Vocale en Français',
            processAudioBtnAr: '<span class="btn-icon">✨</span> Générer la Note Vocale en Arabe',
            sendReceivedAudioToJohnBtn: '📥 Envoyer cet audio dans le dossier "Message pour John"',
            sendReceivedAudioWhatsAppBtn: '💬 Envoyer l\'Audio sur WhatsApp (Partage Direct)',
            downloadReceivedAudioBtn: '⬇️ Télécharger la Note Vocale (.mp3)',
            labelArabicBox: 'العربية (Texte d\'origine en Arabe)',
            labelFrenchBox: 'Traduction en Français',
            arabicLoadingText: 'Chargement du texte arabe...',
            frenchLoadingText: 'Chargement de la traduction française...',
            phoneticLabel: 'Phonétique : ',
            copyArabicTextBtn: '📋 Copier le texte en Arabe',
            playFrenchBtn: '<span class="btn-icon">🔊</span> Écouter en Français',
            playFrenchPauseBtn: '<span class="btn-icon">⏸️</span> Pause la lecture',
            copyFrenchTextBtn: '📋 Copier la traduction en Français',
            titleVocab: '💡 Vocabulaire & Mots-clés de l\'audio :',
            titleSend: 'Générer une Note Vocale & Traduction',
            labelVoiceSelect: 'Voix Arabe :',
            voices: [
                { value: "ar-JO-SanaNeural", label: "🌸 Sana (Voix Féminine Levant / Palestinienne)" },
                { value: "ar-LB-LaylaNeural", label: "🌸 Layla (Voix Féminine Libanaise)" },
                { value: "ar-LB-RamiNeural", label: "🎙️ Rami (Voix Masculine Levant)" },
                { value: "ar-EG-SalmaNeural", label: "🌸 Salma (Voix Féminine Égyptienne)" }
            ],
            labelSectionFrToAr: 'Écrire en Français (Pour note vocale en Arabe Palestinien)',
            labelSectionArToFr: 'Écrire en Arabe (Pour traduire et vocaliser en Français)',
            labelReplyInputFr: 'Votre message en Français :',
            labelReplyInputAr: 'Votre message en Arabe :',
            replyPlaceholderFr: 'Tapez votre réponse en français ici...',
            replyPlaceholderAr: 'اكتب رسالتك باللغة العربية هنا...',
            generateReplyFrBtn: '<span class="btn-icon">✨</span> Générer la Note Vocale en Arabe',
            generateReplyArBtn: '<span class="btn-icon">✨</span> Générer la Note Vocale & Traduction en Français',
            labelArabicResult: 'Traduction avec vocalisation',
            copyReplyArabicBtn: '📋 Copier le texte',
            titleAudioCard: 'Note Vocale Générée',
            voiceUsedSub: 'Enregistrée dans fichiers_reponse_a_envoyer',
            sendAudioWhatsAppBtn: '💬 Envoyer l\'Audio sur WhatsApp (Partage Direct)',
            downloadAudioBtn: '⬇️ Télécharger la Note Vocale (.mp3)',
            sendAudioToJohnBtn: '📥 Envoyer cet audio dans le dossier "Message pour John"',
            purgeAudioBtn: '🗑️ Purger cet audio du disque',
            titleChatHeader: 'Chat Éphémère Traduit (Messages & Audios)',
            badgeChatTimer: '🕒 Suppression automatique après 24h',
            subChatInfo: 'Vos messages texte et vocaux sont automatiquement traduits et vocalisés selon la langue de votre compte. Chaque message est conservé exactement 24h puis définitivement purgé du disque.',
            chatMicBtnTitle: 'Enregistrer une note vocale',
            chatInputPlaceholder: 'Écrivez votre message...',
            btnChatSendText: 'Envoyer',
            chatEmptyNotice: '💬 Aucune conversation en cours. Tapez votre premier message !',
            chatPlayAudioText: 'Écouter l\'audio',
            adminToggleChatDisable: '⏸️ Désactiver le Chat',
            adminToggleChatEnable: '▶️ Réactiver le Chat',
            adminArchiveChatBtn: '📦 Archiver la Conversation',
            adminResetChatBtn: '🗑️ Réinitialiser (Effacer) le Chat',
            chatDisabledNotice: '🔒 Le chat est temporairement désactivé par l\'administrateur.',
            betaSubTitle: '🎬 Mode Bêta : Aperçu & Édition des Sous-Titres (.ASS)',
            betaSubDesc: 'Le fichier de sous-titres a été généré en Français avec le timing exact. Vous pouvez relire et modifier le texte ou les horodatages ci-dessous avant d\'incruster les sous-titres sur la vidéo finalisée :',
            labelAssEditor: '📝 Contenu du fichier .ASS (Modifiable) :',
            btnBurnSubtitles: '🎬 Générer la Vidéo Sous-Titrée MP4 (Incrustation)',
            alertAssGenerating: '⏳ Génération des sous-titres .ASS en cours...',
            alertAssSuccess: '✅ Fichier de sous-titres .ASS généré avec succès ! Vous pouvez vérifier et éditer le texte ci-dessous.',
            alertBurningLoading: '⏳ Incrustation des sous-titres sur la vidéo MP4 en cours (veuillez patienter)...',
            alertBurningSuccess: '✅ Vidéo sous-titrée MP4 générée avec succès !',
            alertChatResetConfirm: 'Êtes-vous sûr de vouloir réinitialiser et effacer la conversation ? Cette action est irréversible.',
            alertChatResetSuccess: '✅ La conversation a été totalement réinitialisée et effacée.',
            alertChatArchiveSuccess: '✅ La conversation a été archivée avec succès dans le dossier Message pour John !',
            footerText: 'Agent Traducteur Aya &bull; Interface Web & Serveur Local (localhost:3000)',
            // WhatsApp Guidance Modal Translations
            waGuidanceTitle: '✅ Note Vocale MP3 Téléchargée !',
            waGuidanceSub: 'Le fichier audio <strong id="waGuidanceFileName" class="filename-badge">note_vocale.mp3</strong> est maintenant dans vos Téléchargements.',
            waStep1Title: '1. Fichier prêt dans les Téléchargements',
            waStep1Desc: 'Le fichier audio MP3 a été enregistré automatiquement sur votre ordinateur.',
            waStep2Title: '2. Ouvrez votre conversation WhatsApp Web',
            waStep2Desc: 'Cliquez sur le bouton ci-dessous pour accéder directement à WhatsApp Web.',
            waStep3Title: '3. Glissez-déposez le fichier MP3',
            waStep3Desc: 'Faites glisser le fichier téléchargé dans la discussion pour l\'envoyer en note vocale.',
            waBtnOpenText: 'Ouvrir WhatsApp Web',
            waBtnDismissText: 'J\'ai compris / Fermer',
            alertPreparingAudio: '⏳ Préparation du fichier audio...',
            // Alerts & Feedback
            alertMicPermission: "Veuillez autoriser l'accès au microphone dans votre navigateur.",
            alertUploadLoading: '⏳ Téléversement et traduction du fichier en cours...',
            alertUploadSuccess: '✅ Fichier enregistré dans audio_a_traiter et traduit !',
            alertUploadError: 'Erreur lors de l\'envoi du fichier : ',
            alertMicProcessing: '<span class="btn-icon">⏳</span> Traitement et traduction du micro en cours...',
            alertMicError: 'Erreur micro : ',
            alertSendToJohnSuccess: '✅ Envoyé dans le dossier Message pour John !',
            alertSendToJohnError: 'Erreur : Impossible d\'envoyer dans le dossier',
            alertCopyArabicSuccess: 'Texte Arabe copié !',
            alertCopyFrenchSuccess: 'Traduction FR copiée !',
            alertCopySuccess: 'Texte copié !',
            alertCopyFallback: 'Texte à copier :\n\n',
            alertNoAudioShare: 'Aucun fichier audio disponible.',
            alertWhatsAppOpened: '✅ Partage WhatsApp ouvert !',
            alertWhatsAppDownloaded: '✅ Audio .mp3 téléchargé & WhatsApp ouvert !',
            alertNoAudioDownload: 'Aucun audio à télécharger.',
            alertAudioDownloaded: '✅ Note vocale .mp3 téléchargée !',
            alertProcessLoading: '<span class="btn-icon">⏳</span> Traduction en cours...',
            alertProcessLoadingFr: '<span class="btn-icon">⏳</span> Traduction Arabe ➔ Français en cours...',
            alertProcessLoadingAr: '<span class="btn-icon">⏳</span> Traduction Français ➔ Arabe en cours...',
            alertProcessError: 'Erreur lors de la traduction : ',
            alertPlayFrenchFirst: 'Veuillez générer la traduction française d\'abord.',
            alertPurgeSuccess: '🗑️ Audio purgé du disque avec succès !',
            alertReplyFrEmpty: 'Veuillez saisir votre message en français.',
            alertReplyFrLoading: '<span class="btn-icon">⏳</span> Traduction en Arabe en cours...',
            alertReplyArEmpty: 'Veuillez saisir votre message en arabe.',
            alertReplyArLoading: '<span class="btn-icon">⏳</span> Traduction en Français en cours...',
            alertConnError: 'Erreur de connexion au serveur.',
            alertChatError: 'Erreur chat : ',
            alertChatVoiceError: 'Erreur lors de l\'envoi de la note vocale.'
        },
        ar: {
            dir: "rtl",
            pageTitle: 'وكيل التَّرْجَمَة آيَة | ترجمة صوتية عربي - فرنسي',
            loginTitle: 'تسجيل الدخول الآمن - وكيل آية',
            loginSub: 'أدخل اسم المستخدم وكلمة المرور الخاصة بك للمتابعة:',
            labelUsername: 'اسم المستخدم:',
            labelPassword: 'كلمة المرور:',
            loginUsernamePlaceholder: 'اسم المستخدم (مثال: aya أو soso)...',
            loginPasswordPlaceholder: 'كلمة المرور...',
            loginBtn: '🔓 تسجيل الدخول',
            loginErrorText: '❌ اسم المستخدم أو كلمة المرور غير صحيحة.',
            headerTitle: 'وكيل التَّرْجَمَة آيَة <span class="badge-tag green">عربي فلسطيني ↔ فرنسي</span>',
            headerSub: 'ترجمة التسجيلات الصوتية وإنشاء الردود الصوتية بنقرة واحدة',
            userConnectedPrefix: '👤 تسجيل الدخول باسم:',
            logoutBtnTitle: 'تسجيل الخروج',
            navStudioText: 'استوديو تيك توك V3',
            liveIndicatorText: '<span class="pulse"></span> الخادم نشط ومتصل',
            titleReceived: 'الملفات والتسجيلات الصوتية الواردة',
            msgTime: 'مجلد التسجيلات الواردة',
            titleDirectUpload: '📤 إرسال ملف صوتي أو فيديو للترجمة',
            subDirectUpload: 'اختر اللغة المطلوبة للترجمة قبل إرسال الملف:',
            labelUploadTargetLang: 'اللغة المطلوبة للترجمة:',
            uploadOptFr: '🇫🇷 الترجمة إلى اللغة الفرنسية (الصوت/الفيديو بالعربية)',
            uploadOptAr: '🇵🇸 الترجمة إلى العربية الفلسطينية (الصوت/الفيديو بالفرنسية)',
            triggerFileBrowseBtn: '📁 اختيار ملف صوت/فيديو للترجمة المباشرة',
            titleMicRec: '🎙️ تسجيل ملاحظة صوتية مباشرة (مايكروفون)',
            subMicRec: 'تحدثي في المايكروفون للتسجيل والترجمة المباشرة:',
            recBtnText: 'بدء التسجيل الصوتي',
            recStopBtnText: 'إيقاف التسجيل والترجمة',
            labelAudioSelect: '📂 اختيار التسجيل الصوتي أو الفيديو للترجمة:',
            labelSelectAudioTargetLang: 'اللغة المطلوبة لإنشاء الترجمة والصوت:',
            selectTargetOptFr: '🇫🇷 الترجمة وإنشاء الصوت بالفرنسية',
            selectTargetOptAr: '🇵🇸 الترجمة وإنشاء الصوت بالعربية الفلسطينية',
            processAudioBtn: '<span class="btn-icon">✨</span> إنشاء واستماع باللغة الفرنسية',
            processAudioBtnFr: '<span class="btn-icon">✨</span> إنشاء واستماع باللغة الفرنسية',
            processAudioBtnAr: '<span class="btn-icon">✨</span> إنشاء واستماع بالعربية الفلسطينية',
            sendReceivedAudioToJohnBtn: '📥 إرسال هذا التسجيل إلى مجلد "رسالة إلى جون"',
            sendReceivedAudioWhatsAppBtn: '💬 إرسال التسجيل الصوتي عبر واتساب (مشاركة مباشرة)',
            downloadReceivedAudioBtn: '⬇️ تحميل الملف الصوتي (.mp3)',
            labelArabicBox: 'النص الأصلي باللغة العربية',
            labelFrenchBox: 'الترجمة إلى اللغة الفرنسية',
            arabicLoadingText: 'جاري تحميل النص العربي...',
            frenchLoadingText: 'جاري تحميل الترجمة الفرنسية...',
            phoneticLabel: 'النطق الصوتي: ',
            copyArabicTextBtn: '📋 نسخ النص العربي',
            playFrenchBtn: '<span class="btn-icon">🔊</span> الاستماع بالفرنسية',
            playFrenchPauseBtn: '<span class="btn-icon">⏸️</span> إيقاف مؤقت',
            copyFrenchTextBtn: '📋 نسخ الترجمة الفرنسية',
            titleVocab: '💡 مفردات وكلمات مفتاحية من التسجيل:',
            titleSend: 'إنشاء تسجيل صوتي وترجمة',
            labelVoiceSelect: 'اختيار الصوت العربي:',
            voices: [
                { value: "ar-JO-SanaNeural", label: "🌸 سناء (صوت أنثوي فلسطيني / بلاد الشام)" },
                { value: "ar-LB-LaylaNeural", label: "🌸 ليلى (صوت أنثوي لبناني)" },
                { value: "ar-LB-RamiNeural", label: "🎙️ رامي (صوت رجالي بلاد الشام)" },
                { value: "ar-EG-SalmaNeural", label: "🌸 سلمى (صوت أنثوي مصري)" }
            ],
            labelSectionFrToAr: 'كتابة بالفرنسية (لإنشاء تسجيل صوتي بالعربية الفلسطينية)',
            labelSectionArToFr: 'كتابة باللغة العربية (للترجمة والتسجيل الصوتي بالفرنسية)',
            labelReplyInputFr: 'رسالتك باللغة الفرنسية:',
            labelReplyInputAr: 'الرسالة باللغة العربية:',
            replyPlaceholderFr: 'اكتب ردك باللغة الفرنسية هنا...',
            replyPlaceholderAr: 'اكتبي رسالتك باللغة العربية هنا...',
            generateReplyFrBtn: '<span class="btn-icon">✨</span> إنشاء التسجيل الصوتي بالعربية',
            generateReplyArBtn: '<span class="btn-icon">✨</span> إنشاء التسجيل الصوتي والترجمة بالفرنسية',
            labelArabicResult: 'الترجمة مع الصوت المسموع',
            copyReplyArabicBtn: '📋 نسخ النص',
            titleAudioCard: 'التسجيل الصوتي المنشأ',
            voiceUsedSub: 'محفوظ في مجلد الردود',
            sendAudioWhatsAppBtn: '💬 إرسال التسجيل الصوتي عبر واتساب (مشاركة مباشرة)',
            downloadAudioBtn: '⬇️ تحميل الملف الصوتي (.mp3)',
            sendAudioToJohnBtn: '📥 إرسال هذا التسجيل إلى مجلد "رسالة إلى جون"',
            purgeAudioBtn: '🗑️ حذف التسجيل الصوتي من القرص',
            titleChatHeader: 'المحادثة المباشرة المؤقتة المترجمة (رسائل وأصوات)',
            badgeChatTimer: '🕒 الحذف التلقائي للرسائل بعد 24 ساعة',
            subChatInfo: 'تترجم رسائلك النصية والصوتية تلقائياً حسب لغة حسابك. تُحفظ كل رسالة لمدة 24 ساعة ثم تُحذف تلقائياً من القرص.',
            chatMicBtnTitle: 'تسجيل ملاحظة صوتية',
            chatInputPlaceholder: 'اكتبي رسالتك هنا...',
            btnChatSendText: 'إرسال',
            chatEmptyNotice: '💬 لا توجد رسائل حالياً في المحادثة المؤقتة. اكتبي رسالتك الأولى!',
            chatPlayAudioText: 'استماع للتسجيل',
            adminToggleChatDisable: '⏸️ تعطيل المحادثة',
            adminToggleChatEnable: '▶️ إعادة تفعيل المحادثة',
            adminArchiveChatBtn: '📦 أرشفة المحادثة',
            adminResetChatBtn: '🗑️ إعادة تعيين (حذف) المحادثة',
            chatDisabledNotice: '🔒 المحادثة معطلة حالياً بواسطة المسؤول.',
            betaSubTitle: '🎬 وضع تجريبي: معاينة وتعديل ملف الترجمة (.ASS)',
            betaSubDesc: 'تم إنشاء ملف الترجمة باللغة الفرنسية مع التوقيت الدقيق. يمكنك مراجعة وتعديل النص أو التوقيت أدناه قبل دمج الترجمة على الفيديو النهائي:',
            labelAssEditor: '📝 محتوى ملف .ASS (قابل للتعديل):',
            btnBurnSubtitles: '🎬 دمج الترجمة وإنشاء فيديو MP4',
            alertAssGenerating: '⏳ جاري إنشاء ملف الترجمة .ASS...',
            alertAssSuccess: '✅ تم إنشاء ملف الترجمة .ASS بنجاح! يمكنك مراجعة وتعديل النص أدناه.',
            alertBurningLoading: '⏳ جاري دمج الترجمة على الفيديو (يرجى الانتظار)...',
            alertBurningSuccess: '✅ تم إنشاء الفيديو المترجم MP4 بنجاح!',
            alertChatResetConfirm: 'هل أنت تأكد من إعادة تعيين وحذف المحادثة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.',
            alertChatResetSuccess: '✅ تمت إعادة تعيين المحادثة وحذفها بالكامل.',
            alertChatArchiveSuccess: '✅ تمت أرشفة المحادثة بنجاح في مجلد رسالة إلى جون!',
            footerText: 'وكيل الترجمة آية &bull; واجهة الويب والخادم المحلي (localhost:3000)',
            // WhatsApp Guidance Modal Translations
            waGuidanceTitle: '✅ تم تحميل الملاحظة الصوتية MP3 بنجاح!',
            waGuidanceSub: 'تم حفظ الملف الصوتي <strong id="waGuidanceFileName" class="filename-badge">note_vocale.mp3</strong> في مجلد التحميلات (Downloads) على جهازك.',
            waStep1Title: '1. الملف جاهز في مجلد التحميلات',
            waStep1Desc: 'تم تنزيل ملف الصوت بصيغة MP3 تلقائياً على جهاز الكمبيوتر.',
            waStep2Title: '2. افتحي محادثة واتساب ويب',
            waStep2Desc: 'اضغطي على الزر بالأسفل لفتح واتساب ويب في نافذة جديدة.',
            waStep3Title: '3. اسحبي الملف وأفلتيه في المحادثة',
            waStep3Desc: 'اسحبي ملف MP3 المُحمّل وأسقطيه داخل المحادثة لإرساله مباشرة كملاحظة صوتية.',
            waBtnOpenText: 'فتح واتساب ويب (WhatsApp Web)',
            waBtnDismissText: 'فهمت ذلك / إغلاق',
            alertPreparingAudio: '⏳ جاري تجهيز الملف الصوتي...',
            // Alerts & Feedback
            alertMicPermission: "يرجى السماح بالوصول إلى المايكروفون في المتصفح.",
            alertUploadLoading: '⏳ جاري رفع الملف وترجمته...',
            alertUploadSuccess: '✅ تم حفظ الملف في مجلد التسجيلات وترجمته بنجاح!',
            alertUploadError: 'خطأ في إرسال الملف: ',
            alertMicProcessing: '<span class="btn-icon">⏳</span> جاري معالجة التسجيل المباشر وترجمته...',
            alertMicError: 'خطأ في المايكروفون: ',
            alertSendToJohnSuccess: '✅ تم الحفظ في مجلد رسالة إلى جون بنجاح!',
            alertSendToJohnError: 'خطأ: تعذر الإرسال إلى المجلد',
            alertCopyArabicSuccess: 'تم نسخ النص العربي بنجاح!',
            alertCopyFrenchSuccess: 'تم نسخ الترجمة الفرنسية بنجاح!',
            alertCopySuccess: 'تم نسخ النص بنجاح!',
            alertCopyFallback: 'النص للنسخ:\n\n',
            alertNoAudioShare: 'لا يوجد تسجيل صوتي متاح للمشاركة.',
            alertWhatsAppOpened: '✅ تم فتح خيارات المشاركة عبر واتساب!',
            alertWhatsAppDownloaded: '✅ تم تحميل الصوت وفتح واتساب!',
            alertNoAudioDownload: 'لا يوجد تسجيل صوتي للتحميل.',
            alertAudioDownloaded: '✅ تم تحميل التسجيل الصوتي بنجاح!',
            alertProcessLoading: '<span class="btn-icon">⏳</span> جاري الترجمة وإنشاء الصوت...',
            alertProcessLoadingFr: '<span class="btn-icon">⏳</span> جاري الترجمة وإنشاء الصوت بالفرنسية...',
            alertProcessLoadingAr: '<span class="btn-icon">⏳</span> جاري الترجمة وإنشاء الصوت بالعربية...',
            alertProcessError: 'خطأ أثناء الترجمة: ',
            alertPlayFrenchFirst: 'يرجى ترجمة التسجيل أولاً للاستماع إلى الصوت الفرنسي.',
            alertPurgeSuccess: '🗑️ تم حذف التسجيل الصوتي من القرص بنجاح!',
            alertReplyFrEmpty: 'يرجى كتابة رسالتك باللغة الفرنسية.',
            alertReplyFrLoading: '<span class="btn-icon">⏳</span> جاري الترجمة وإنشاء الصوت العربي...',
            alertReplyArEmpty: 'يرجى كتابة رسالتك باللغة العربية.',
            alertReplyArLoading: '<span class="btn-icon">⏳</span> جاري الترجمة وإنشاء الصوت الفرنسي...',
            alertConnError: 'خطأ في الاتصال بالخادم.',
            alertChatError: 'خطأ في المحادثة: ',
            alertChatVoiceError: 'خطأ أثناء إرسال التسجيل الصوتي.'
        }
    };

    // Safe Helper Functions for DOM Updating
    function setInnerHTML(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.innerHTML = val;
    }

    function setTextContent(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.textContent = val;
    }

    function setPlaceholder(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.setAttribute('placeholder', val);
    }

    function applyLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('aya_lang', lang);

        const dict = i18n[lang] || i18n.ar;

        if (htmlTag) {
            htmlTag.setAttribute('dir', dict.dir);
            htmlTag.setAttribute('lang', lang);
        }

        document.title = dict.pageTitle;

        // Toggle Switcher Active Buttons
        if (lang === 'ar') {
            if (langArBtn) langArBtn.classList.add('active');
            if (langFrBtn) langFrBtn.classList.remove('active');
            if (modalLangArBtn) modalLangArBtn.classList.add('active');
            if (modalLangFrBtn) modalLangFrBtn.classList.remove('active');
        } else {
            if (langFrBtn) langFrBtn.classList.add('active');
            if (langArBtn) langArBtn.classList.remove('active');
            if (modalLangFrBtn) modalLangFrBtn.classList.add('active');
            if (modalLangArBtn) modalLangArBtn.classList.remove('active');
        }

        // Login Modal Translations
        setInnerHTML('loginTitle', dict.loginTitle);
        setInnerHTML('loginSub', dict.loginSub);
        setInnerHTML('labelUsername', dict.labelUsername);
        setInnerHTML('labelPassword', dict.labelPassword);
        setPlaceholder('loginUsernameInput', dict.loginUsernamePlaceholder);
        setPlaceholder('loginPasswordInput', dict.loginPasswordPlaceholder);
        setInnerHTML('loginBtn', dict.loginBtn);
        setInnerHTML('loginError', dict.loginErrorText);

        // Header Translations
        setInnerHTML('headerTitle', dict.headerTitle);
        setInnerHTML('headerSub', dict.headerSub);
        setInnerHTML('navStudioText', dict.navStudioText);
        setInnerHTML('liveIndicatorText', dict.liveIndicatorText);
        if (logoutBtn) logoutBtn.setAttribute('title', dict.logoutBtnTitle);

        if (userNameDisplay) {
            const userName = currentUser ? (currentUser.name || currentUser.username) : (lang === 'ar' ? 'آية' : 'Aya');
            userNameDisplay.textContent = `${dict.userConnectedPrefix} ${userName}`;
        }

        // Left Column Translations
        setInnerHTML('titleReceived', dict.titleReceived);
        setInnerHTML('msgTime', dict.msgTime);
        setInnerHTML('titleDirectUpload', dict.titleDirectUpload);
        setInnerHTML('subDirectUpload', dict.subDirectUpload);
        setInnerHTML('labelUploadTargetLang', dict.labelUploadTargetLang);
        setInnerHTML('uploadOptFr', dict.uploadOptFr);
        setInnerHTML('uploadOptAr', dict.uploadOptAr);
        setInnerHTML('triggerFileBrowseBtn', dict.triggerFileBrowseBtn);
        setInnerHTML('titleMicRec', dict.titleMicRec);
        setInnerHTML('subMicRec', dict.subMicRec);
        if (!isRecording && recBtnText) recBtnText.textContent = dict.recBtnText;
        setInnerHTML('labelAudioSelect', dict.labelAudioSelect);
        setInnerHTML('processAudioBtn', dict.processAudioBtn);
        setInnerHTML('sendReceivedAudioToJohnBtn', dict.sendReceivedAudioToJohnBtn);
        setInnerHTML('sendReceivedAudioWhatsAppBtn', dict.sendReceivedAudioWhatsAppBtn);
        setInnerHTML('downloadReceivedAudioBtn', dict.downloadReceivedAudioBtn);
        setInnerHTML('labelArabicBox', dict.labelArabicBox);
        setInnerHTML('labelFrenchBox', dict.labelFrenchBox);
        setInnerHTML('copyArabicTextBtn', dict.copyArabicTextBtn);
        setInnerHTML('playFrenchBtn', dict.playFrenchBtn);
        setInnerHTML('copyFrenchTextBtn', dict.copyFrenchTextBtn);
        setInnerHTML('titleVocab', dict.titleVocab);

        // Beta Subtitle Section Translations
        setInnerHTML('betaSubTitle', dict.betaSubTitle);
        setInnerHTML('betaSubDesc', dict.betaSubDesc);
        setInnerHTML('labelAssEditor', dict.labelAssEditor);
        setInnerHTML('btnBurnSubtitles', dict.btnBurnSubtitles);

        // Right Column Translations
        setInnerHTML('titleSend', dict.titleSend);
        setInnerHTML('labelVoiceSelect', dict.labelVoiceSelect);

        // Localize Voice Select Options
        if (voiceSelect) {
            const currentVoiceVal = voiceSelect.value || 'ar-JO-SanaNeural';
            voiceSelect.innerHTML = '';
            dict.voices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.value;
                opt.textContent = v.label;
                if (v.value === currentVoiceVal) opt.selected = true;
                voiceSelect.appendChild(opt);
            });
        }

        setInnerHTML('labelSectionFrToAr', dict.labelSectionFrToAr);
        setInnerHTML('labelSectionArToFr', dict.labelSectionArToFr);
        setInnerHTML('labelReplyInputFr', dict.labelReplyInputFr);
        setInnerHTML('labelReplyInputAr', dict.labelReplyInputAr);
        setPlaceholder('replyInputFr', dict.replyPlaceholderFr);
        setPlaceholder('replyInputAr', dict.replyPlaceholderAr);
        setInnerHTML('generateReplyFrBtn', dict.generateReplyFrBtn);
        setInnerHTML('generateReplyArBtn', dict.generateReplyArBtn);
        setInnerHTML('labelArabicResult', dict.labelArabicResult);
        setInnerHTML('copyReplyArabicBtn', dict.copyReplyArabicBtn);
        setInnerHTML('titleAudioCard', dict.titleAudioCard);
        setInnerHTML('voiceUsedSub', dict.voiceUsedSub);
        setInnerHTML('sendAudioWhatsAppBtn', dict.sendAudioWhatsAppBtn);
        setInnerHTML('downloadAudioBtn', dict.downloadAudioBtn);
        setInnerHTML('sendAudioToJohnBtn', dict.sendAudioToJohnBtn);
        setInnerHTML('purgeAudioBtn', dict.purgeAudioBtn);

        // WhatsApp Guidance Modal Translations
        setInnerHTML('waGuidanceTitle', dict.waGuidanceTitle);
        setInnerHTML('waGuidanceSub', dict.waGuidanceSub);
        setInnerHTML('waStep1Title', dict.waStep1Title);
        setInnerHTML('waStep1Desc', dict.waStep1Desc);
        setInnerHTML('waStep2Title', dict.waStep2Title);
        setInnerHTML('waStep2Desc', dict.waStep2Desc);
        setInnerHTML('waStep3Title', dict.waStep3Title);
        setInnerHTML('waStep3Desc', dict.waStep3Desc);
        setInnerHTML('waBtnOpenText', dict.waBtnOpenText);
        setInnerHTML('waBtnDismissText', dict.waBtnDismissText);

        // Chat Ephemeral Translations
        setInnerHTML('titleChatHeader', dict.titleChatHeader);
        setInnerHTML('badgeChatTimer', dict.badgeChatTimer);
        setInnerHTML('subChatInfo', dict.subChatInfo);
        if (chatMicBtn && !isChatRecording) chatMicBtn.setAttribute('title', dict.chatMicBtnTitle);
        setPlaceholder('chatInputText', dict.chatInputPlaceholder);
        setInnerHTML('btnChatSendText', dict.btnChatSendText);
        setInnerHTML('adminArchiveChatBtn', dict.adminArchiveChatBtn);
        setInnerHTML('adminResetChatBtn', dict.adminResetChatBtn);

        setInnerHTML('footerText', dict.footerText);

        // Pre-select opposite target language by default for existing audio selector
        if (selectAudioTargetLang) {
            selectAudioTargetLang.value = (lang === 'fr' ? 'ar' : 'fr');
        }
        setInnerHTML('labelSelectAudioTargetLang', dict.labelSelectAudioTargetLang);
        setInnerHTML('optSelectTargetFr', dict.selectTargetOptFr || dict.uploadOptFr);
        setInnerHTML('optSelectTargetAr', dict.selectTargetOptAr || dict.uploadOptAr);
        updateProcessAudioButtonText();

        // Refresh Current Audio View & Chat History
        if (audioDataList.length > 0 && audioSelect) {
            const selectedItem = audioDataList.find(a => a.filename === audioSelect.value);
            if (selectedItem) displaySelectedAudio(selectedItem);
        }
        loadChatMessages();
        window.dispatchEvent(new CustomEvent('aya:languageChanged', { detail: { lang, dict } }));
    }

    // Language Toggle Listeners
    if (langFrBtn) langFrBtn.addEventListener('click', () => applyLanguage('fr'));
    if (langArBtn) langArBtn.addEventListener('click', () => applyLanguage('ar'));
    if (modalLangFrBtn) modalLangFrBtn.addEventListener('click', () => applyLanguage('fr'));
    if (modalLangArBtn) modalLangArBtn.addEventListener('click', () => applyLanguage('ar'));

    // Direct File Upload & Translate Functionality
    if (triggerFileBrowseBtn && directFileInput) {
        triggerFileBrowseBtn.addEventListener('click', () => {
            directFileInput.click();
        });

        directFileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            const selectedFile = files[0];
            const targetLang = uploadTargetLangSelect ? uploadTargetLangSelect.value : 'fr';
            const dict = i18n[currentLang];

            triggerFileBrowseBtn.disabled = true;
            triggerFileBrowseBtn.innerHTML = dict.alertUploadLoading;

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('target_lang', targetLang);

            try {
                let data = await safeFetchJson('/api/upload-and-translate', {
                    method: 'POST',
                    body: formData
                });
                if (data.async && data.jobId) {
                    data = await pollJobResult(data.jobId);
                }
                if (data.success) {
                    if (arabicText) arabicText.textContent = data.original_text;
                    if (frenchText) frenchText.textContent = data.translation;
                    if (frenchAudio) frenchAudio.src = data.audio_url;

                    if (frenchAudio && frenchAudio.src) {
                        frenchAudio.play().catch(() => {});
                    }

                    currentReceivedAudioUrl = data.audio_url;
                    currentReceivedAudioFile = data.audio_url ? data.audio_url.split('?')[0].split('/').pop() : "note_vocale.mp3";
                    if (receivedAudioActionsStack) receivedAudioActionsStack.classList.remove('hidden');

                    await loadAudioMessages();
                    alert(dict.alertUploadSuccess);
                } else {
                    alert((dict.alertUploadError) + (data.error || ""));
                }
            } catch (err) {
                console.error("Direct upload error:", err);
                alert(dict.alertUploadError + err.message);
            } finally {
                triggerFileBrowseBtn.disabled = false;
                triggerFileBrowseBtn.innerHTML = dict.triggerFileBrowseBtn;
                directFileInput.value = '';
            }
        });
    }

    // Live Microphone Recording Functionality
    async function startMicRecording() {
        const dict = i18n[currentLang];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await uploadAndProcessMicRecord(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            recSeconds = 0;
            if (recTimer) {
                recTimer.classList.remove('hidden');
                recTimer.textContent = '🔴 00:00';
            }
            if (recIcon) recIcon.textContent = '⏹️';
            if (recBtnText) recBtnText.textContent = dict.recStopBtnText;

            recInterval = setInterval(() => {
                recSeconds++;
                const mins = String(Math.floor(recSeconds / 60)).padStart(2, '0');
                const secs = String(recSeconds % 60).padStart(2, '0');
                if (recTimer) recTimer.textContent = `🔴 ${mins}:${secs}`;
            }, 1000);

        } catch (err) {
            console.error("Microphone access error:", err);
            alert(dict.alertMicPermission);
        }
    }

    function stopMicRecording() {
        const dict = i18n[currentLang];
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            clearInterval(recInterval);
            if (recTimer) recTimer.classList.add('hidden');
            if (recIcon) recIcon.textContent = '🔴';
            if (recBtnText) recBtnText.textContent = dict.recBtnText;
        }
    }

    async function uploadAndProcessMicRecord(blob) {
        const dict = i18n[currentLang];
        if (processAudioBtn) {
            processAudioBtn.disabled = true;
            processAudioBtn.innerHTML = dict.alertMicProcessing;
        }

        const formData = new FormData();
        formData.append('audio', blob, `rec_micro_${Date.now()}.webm`);

        try {
            let data = await safeFetchJson('/api/upload-microphone', {
                method: 'POST',
                body: formData
            });
            if (data.async && data.jobId) {
                data = await pollJobResult(data.jobId);
            }
            if (data.arabic_text) {
                if (arabicText) arabicText.textContent = data.arabic_text;
                if (frenchText) frenchText.textContent = data.french_translation;
                if (frenchAudio) {
                    frenchAudio.src = data.french_audio_url;
                    frenchAudio.play().catch(() => {});
                }
                currentReceivedAudioUrl = data.french_audio_url;
                currentReceivedAudioFile = data.french_audio_url ? data.french_audio_url.split('?')[0].split('/').pop() : "note_vocale.mp3";
                if (receivedAudioActionsStack) receivedAudioActionsStack.classList.remove('hidden');
                await loadAudioMessages();
            } else {
                alert(dict.alertMicError + (data.error || ""));
            }
        } catch (err) {
            console.error("Mic upload error:", err);
            alert(dict.alertMicError + err.message);
        } finally {
            if (processAudioBtn) {
                processAudioBtn.disabled = false;
                processAudioBtn.innerHTML = dict.processAudioBtn;
            }
        }
    }

    if (recordMicBtn) {
        recordMicBtn.addEventListener('click', () => {
            if (!isRecording) {
                startMicRecording();
            } else {
                stopMicRecording();
            }
        });
    }

    // Login Modal & Status Verification
    function checkLoginStatus() {
        const dict = i18n[currentLang];
        if (currentUser && currentUser.username) {
            if (loginModal) loginModal.classList.add('hidden');
            if (userNameDisplay) {
                const name = currentUser.name || currentUser.username;
                userNameDisplay.textContent = `${dict.userConnectedPrefix} ${name}`;
            }

            // Only display local computer files section and admin chat toolbar for Admin / Owner (John)
            const isAdmin = (currentUser.role === 'admin' || currentUser.username.toLowerCase() === 'john');
            if (adminLocalFilesSection) {
                if (isAdmin) {
                    adminLocalFilesSection.classList.remove('hidden');
                } else {
                    adminLocalFilesSection.classList.add('hidden');
                }
            }
            if (adminChatToolbar) {
                if (isAdmin) {
                    adminChatToolbar.classList.remove('hidden');
                } else {
                    adminChatToolbar.classList.add('hidden');
                }
            }

            loadAudioMessages();
        } else {
            if (loginModal) loginModal.classList.remove('hidden');
            if (adminLocalFilesSection) adminLocalFilesSection.classList.add('hidden');
            if (adminChatToolbar) adminChatToolbar.classList.add('hidden');
        }
    }

    if (loginBtn && loginUsernameInput && loginPasswordInput) {
        loginBtn.addEventListener('click', async () => {
            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();
            if (!username || !password) return;

            try {
                const data = await safeFetchJson('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });
                if (data.success) {
                    currentUser = data.user;
                    localStorage.setItem('aya_user', JSON.stringify(currentUser));
                    localStorage.setItem('aya_auth_token', data.token);
                    if (loginError) loginError.classList.add('hidden');
                    checkLoginStatus();
                } else {
                    if (loginError) loginError.classList.remove('hidden');
                }
            } catch (err) {
                if (loginError) loginError.classList.remove('hidden');
            }
        });

        loginPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginBtn.click();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('aya_user');
            localStorage.removeItem('aya_auth_token');
            currentUser = null;
            if (loginUsernameInput) loginUsernameInput.value = '';
            if (loginPasswordInput) loginPasswordInput.value = '';
            checkLoginStatus();
        });
    }

    // Send to John Folder
    async function sendToJohnFolder(payload, buttonEl) {
        const dict = i18n[currentLang];
        try {
            payload.sender = currentUser ? (currentUser.name || currentUser.username) : (currentLang === 'ar' ? 'آية' : 'Utilisateur');
            const res = await fetch('/api/send-to-john', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                if (buttonEl) {
                    const originalHTML = buttonEl.innerHTML;
                    buttonEl.innerHTML = dict.alertSendToJohnSuccess;
                    buttonEl.style.borderColor = '#10b981';
                    buttonEl.style.color = '#10b981';

                    setTimeout(() => {
                        buttonEl.innerHTML = originalHTML;
                        buttonEl.style.borderColor = '';
                        buttonEl.style.color = '';
                    }, 3000);
                }
            } else {
                alert(dict.alertSendToJohnError + " : " + (data.error || ""));
            }
        } catch (err) {
            console.error("Send to John error:", err);
            alert(dict.alertSendToJohnError);
        }
    }

    if (sendReceivedAudioToJohnBtn) {
        sendReceivedAudioToJohnBtn.addEventListener('click', () => {
            const selectedFilename = audioSelect ? audioSelect.value : null;
            sendToJohnFolder({ target_type: 'audio', filename: selectedFilename }, sendReceivedAudioToJohnBtn);
        });
    }

    if (sendAudioToJohnBtn) {
        sendAudioToJohnBtn.addEventListener('click', () => {
            sendToJohnFolder({ target_type: 'audio', filename: currentGeneratedAudioFile }, sendAudioToJohnBtn);
        });
    }

    // Copy to Clipboard
    async function copyToClipboard(text, buttonEl, successLabel) {
        if (!text || !text.trim()) return;
        const cleanText = text.trim();
        const dict = i18n[currentLang];

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(cleanText);
            } else {
                const tempArea = document.createElement('textarea');
                tempArea.value = cleanText;
                document.body.appendChild(tempArea);
                tempArea.select();
                document.execCommand('copy');
                document.body.removeChild(tempArea);
            }

            if (buttonEl) {
                const originalHTML = buttonEl.innerHTML;
                buttonEl.innerHTML = `✅ ${successLabel}`;
                buttonEl.style.borderColor = '#10b981';
                buttonEl.style.color = '#10b981';

                setTimeout(() => {
                    buttonEl.innerHTML = originalHTML;
                    buttonEl.style.borderColor = '';
                    buttonEl.style.color = '';
                }, 2500);
            }
        } catch (err) {
            console.error("Copy failed", err);
            alert(dict.alertCopyFallback + cleanText);
        }
    }

    // WhatsApp Pure Audio Sharing (Mobile Direct Share & Desktop Native WhatsApp Launcher)
    async function shareOrSendAudioWhatsApp(buttonEl, customUrl, customFile) {
        const dict = i18n[currentLang] || i18n.ar;

        // Audio URL resolution
        let audioUrl = customUrl || currentReceivedAudioUrl || currentAudioUrl;
        if (!audioUrl && frenchAudio && frenchAudio.src) audioUrl = frenchAudio.src;
        if (!audioUrl && arabicReplyAudio && arabicReplyAudio.src) audioUrl = arabicReplyAudio.src;

        // Audio File Name resolution
        let audioFileName = customFile || currentReceivedAudioFile || currentGeneratedAudioFile || "note_vocale.mp3";
        if (audioUrl && audioUrl.includes('/') && (!customFile || customFile === "note_vocale.mp3")) {
            const extracted = audioUrl.split('?')[0].split('/').pop();
            if (extracted && (extracted.endsWith('.mp3') || extracted.endsWith('.wav') || extracted.endsWith('.ogg') || extracted.endsWith('.webm') || extracted.endsWith('.m4a'))) {
                audioFileName = extracted;
            }
        }

        if (!audioUrl) {
            return alert(currentLang === 'ar' ? '⚠️ يرجى اختيار أو إنشاء تسجيل صوتي أولاً.' : '⚠️ Veuillez d\'abord sélectionner ou générer une note vocale.');
        }

        let originalHTML = "";
        if (buttonEl) {
            originalHTML = buttonEl.innerHTML;
            buttonEl.innerHTML = currentLang === 'ar' ? '⏳ جاري فتح تطبيق واتساب...' : '⏳ Ouverture de WhatsApp...';
        }

        try {
            const resp = await fetch(audioUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const mimeType = blob.type || "audio/mp3";
            const file = new File([blob], audioFileName, { type: mimeType });

            // 1. Mobile Phone Direct Sharing via Web Share API (PURE AUDIO ONLY, ZERO TEXT!)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file]
                });

                if (buttonEl) {
                    buttonEl.innerHTML = currentLang === 'ar' ? '✅ تم فتح واتساب للمشاركة المباشرة!' : '✅ WhatsApp ouvert pour le partage !';
                    buttonEl.style.borderColor = '#10b981';
                    buttonEl.style.color = '#10b981';
                    setTimeout(() => {
                        buttonEl.innerHTML = originalHTML;
                        buttonEl.style.borderColor = '';
                        buttonEl.style.color = '';
                    }, 3500);
                }
                return;
            }
        } catch (mobileErr) {
            if (mobileErr.name === 'AbortError') {
                if (buttonEl) buttonEl.innerHTML = originalHTML;
                return;
            }
            console.log("Web share failed or canceled:", mobileErr);
        }

        // 2. Desktop Action: Download ONLY the MP3 file & launch WhatsApp Desktop Application (whatsapp://send)
        try {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = audioFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (dlErr) {
            console.error("Download error:", dlErr);
        }

        try {
            window.location.href = 'whatsapp://send';
        } catch (e) {
            window.open('https://web.whatsapp.com/', '_blank');
        }

        if (buttonEl) {
            buttonEl.innerHTML = currentLang === 'ar' ? '✅ تم فتح تطبيق واتساب!' : '✅ Application WhatsApp ouverte !';
            buttonEl.style.borderColor = '#10b981';
            buttonEl.style.color = '#10b981';
            setTimeout(() => {
                buttonEl.innerHTML = originalHTML;
                buttonEl.style.borderColor = '';
                buttonEl.style.color = '';
            }, 3500);
        }
    }

    // Modal Helpers for WhatsApp Desktop Guidance
    function showWhatsAppDesktopGuidance(fileName) {
        if (waGuidanceFileName && fileName) {
            waGuidanceFileName.textContent = fileName;
        }
        if (whatsappGuidanceModal) {
            whatsappGuidanceModal.classList.remove('hidden');
        }
    }

    function hideWhatsAppDesktopGuidance() {
        if (whatsappGuidanceModal) {
            whatsappGuidanceModal.classList.add('hidden');
        }
    }

    if (closeWhatsAppGuidanceBtn) {
        closeWhatsAppGuidanceBtn.addEventListener('click', hideWhatsAppDesktopGuidance);
    }
    if (waDismissBtn) {
        waDismissBtn.addEventListener('click', hideWhatsAppDesktopGuidance);
    }
    if (waOpenWebBtn) {
        waOpenWebBtn.addEventListener('click', () => {
            window.location.href = 'whatsapp://send';
            hideWhatsAppDesktopGuidance();
        });
    }
    if (whatsappGuidanceModal) {
        whatsappGuidanceModal.addEventListener('click', (e) => {
            if (e.target === whatsappGuidanceModal) {
                hideWhatsAppDesktopGuidance();
            }
        });
    }

    // Helper function to check if text is purely an instructional / placeholder message
    function isInstructionOrPlaceholderText(text) {
        if (!text || typeof text !== 'string') return true;
        const clean = text.trim();
        if (!clean || clean === '...' || clean === '…' || clean === '---' || clean.length < 2) return true;

        const lower = clean.toLowerCase();
        const instructionPatterns = [
            'chargement',
            'جاري تحميل',
            'جاهز للترجمة',
            'prêt à être traduit',
            'pret a etre traduit',
            'اضغط على',
            'cliquez',
            'écoutez',
            'ecoutez',
            'الاستماع بالفرنسية',
            'النص الأصلي',
            'نص أصلي',
            'traduction en français',
            'traduction française',
            'traduction avec vocalisation',
            'الترجمة مع الصوت',
            'fichier audio prêt',
            'ملف صوتي جاهز',
            'tapez votre réponse',
            'اكتب رسالتك',
            'اكتبي رسالتك',
            'اكتب ردك',
            'اختر التسجيل',
            'choisir l\'audio'
        ];

        return instructionPatterns.some(pattern => lower.includes(pattern.toLowerCase()));
    }

    if (sendAudioWhatsAppBtn) {
        sendAudioWhatsAppBtn.addEventListener('click', () => {
            shareOrSendAudioWhatsApp(sendAudioWhatsAppBtn);
        });
    }

    // Instant MP3 Audio Download Handler
    if (downloadAudioBtn) {
        downloadAudioBtn.addEventListener('click', () => {
            const dict = i18n[currentLang];
            if (!currentAudioUrl) return alert(dict.alertNoAudioDownload);
            const a = document.createElement('a');
            a.href = currentAudioUrl;
            a.download = currentGeneratedAudioFile || "note_vocale.mp3";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            const originalHTML = downloadAudioBtn.innerHTML;
            downloadAudioBtn.innerHTML = dict.alertAudioDownloaded;
            downloadAudioBtn.style.borderColor = '#10b981';
            downloadAudioBtn.style.color = '#10b981';

            setTimeout(() => {
                downloadAudioBtn.innerHTML = originalHTML;
                downloadAudioBtn.style.borderColor = '';
                downloadAudioBtn.style.color = '';
            }, 3000);
        });
    }

    // Action Handlers for Received / Direct Upload Audio Stack
    if (sendReceivedAudioWhatsAppBtn) {
        sendReceivedAudioWhatsAppBtn.addEventListener('click', () => {
            shareOrSendAudioWhatsApp(sendReceivedAudioWhatsAppBtn, currentReceivedAudioUrl, currentReceivedAudioFile, 'received');
        });
    }

    if (downloadReceivedAudioBtn) {
        downloadReceivedAudioBtn.addEventListener('click', () => {
            const dict = i18n[currentLang] || i18n.ar;
            if (!currentReceivedAudioUrl) return alert(dict.alertNoAudioDownload || "Aucun audio disponible.");
            const a = document.createElement('a');
            a.href = currentReceivedAudioUrl;
            a.download = currentReceivedAudioFile || "note_vocale.mp3";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            const originalHTML = downloadReceivedAudioBtn.innerHTML;
            downloadReceivedAudioBtn.innerHTML = dict.alertAudioDownloaded;
            downloadReceivedAudioBtn.style.borderColor = '#10b981';
            downloadReceivedAudioBtn.style.color = '#10b981';

            setTimeout(() => {
                downloadReceivedAudioBtn.innerHTML = originalHTML;
                downloadReceivedAudioBtn.style.borderColor = '';
                downloadReceivedAudioBtn.style.color = '';
            }, 3000);
        });
    }

    // Load Audio Messages List
    async function loadAudioMessages() {
        try {
            const res = await fetch('/api/messages');
            const data = await res.json();

            if (data.audios && data.audios.length > 0 && audioSelect) {
                audioDataList = data.audios;
                const prevSelected = audioSelect.value;
                audioSelect.innerHTML = '';

                audioDataList.forEach((item) => {
                    const opt = document.createElement('option');
                    opt.value = item.filename;
                    const durationLabel = item.duration ? (currentLang === 'ar' && item.duration === '59 sec' ? '59 ثانية' : (currentLang === 'ar' && item.duration === 'Audio' ? 'تسجيل صوتي' : item.duration)) : '';
                    opt.textContent = `🎙️ ${item.title || item.filename} ${durationLabel ? '(' + durationLabel + ')' : ''}`;
                    if (item.filename === prevSelected) opt.selected = true;
                    audioSelect.appendChild(opt);
                });

                const itemToDisplay = audioDataList.find(a => a.filename === audioSelect.value) || audioDataList[0];
                displaySelectedAudio(itemToDisplay);
            }
        } catch (err) {
            console.error("Failed to load audio messages:", err);
        }
    }

    function displaySelectedAudio(item) {
        if (!item) return;
        const dict = i18n[currentLang];

        if (arabicText) arabicText.textContent = item.arabic_text || dict.arabicLoadingText;
        if (phoneticText) {
            phoneticText.textContent = item.phonetic ? `${dict.phoneticLabel}"${item.phonetic}"` : '';
        }
        if (frenchText) frenchText.textContent = item.french_translation || dict.frenchLoadingText;
        if (frenchAudio) frenchAudio.src = item.french_audio_url || '';

        if (item.french_audio_url && item.french_audio_url.trim() !== '') {
            currentReceivedAudioUrl = item.french_audio_url;
            currentReceivedAudioFile = item.french_audio_url.split('?')[0].split('/').pop() || "note_vocale.mp3";
            if (receivedAudioActionsStack) receivedAudioActionsStack.classList.remove('hidden');
        } else {
            currentReceivedAudioUrl = "";
            currentReceivedAudioFile = "";
            if (receivedAudioActionsStack) receivedAudioActionsStack.classList.add('hidden');
        }

        if (ayaVideo && ayaAudio) {
            if (item.filename.endsWith('.mp4') || item.filename.endsWith('.mov')) {
                ayaVideo.classList.remove('hidden');
                ayaAudio.classList.add('hidden');
                ayaVideo.src = item.media_url;
            } else {
                ayaVideo.classList.add('hidden');
                ayaAudio.classList.remove('hidden');
                ayaAudio.src = item.media_url;
            }
        }

        if (vocabChips) {
            vocabChips.innerHTML = '';
            if (item.vocab && item.vocab.length > 0) {
                item.vocab.forEach(v => {
                    const chip = document.createElement('span');
                    chip.className = 'chip';
                    chip.innerHTML = `<strong class="ar">${v.ar}</strong> = ${v.fr}`;
                    vocabChips.appendChild(chip);
                });
            }
        }
    }

    if (audioSelect) {
        audioSelect.addEventListener('change', (e) => {
            const selectedFilename = e.target.value;
            const item = audioDataList.find(a => a.filename === selectedFilename);
            if (item) displaySelectedAudio(item);
        });
    }

    // Dynamic helper to update process audio button label based on target language
    function updateProcessAudioButtonText() {
        if (!processAudioBtn) return;
        const dict = i18n[currentLang] || i18n.ar;
        const target = selectAudioTargetLang ? selectAudioTargetLang.value : (currentLang === 'fr' ? 'ar' : 'fr');
        if (target === 'ar') {
            processAudioBtn.innerHTML = dict.processAudioBtnAr || dict.processAudioBtn;
        } else {
            processAudioBtn.innerHTML = dict.processAudioBtnFr || dict.processAudioBtn;
        }
    }

    if (selectAudioTargetLang) {
        selectAudioTargetLang.addEventListener('change', () => {
            updateProcessAudioButtonText();
        });
    }

    if (processAudioBtn && audioSelect) {
        processAudioBtn.addEventListener('click', async () => {
            const selectedFilename = audioSelect.value;
            if (!selectedFilename) return;
            const dict = i18n[currentLang] || i18n.ar;
            const targetLang = selectAudioTargetLang ? selectAudioTargetLang.value : (currentLang === 'fr' ? 'ar' : 'fr');

            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.mpg'].some(ext => selectedFilename.toLowerCase().endsWith(ext));

            processAudioBtn.disabled = true;
            processAudioBtn.innerHTML = isVideo ? dict.alertAssGenerating : (targetLang === 'ar' ? (dict.alertProcessLoadingAr || dict.alertProcessLoading) : (dict.alertProcessLoadingFr || dict.alertProcessLoading));

            try {
                if (isVideo && targetLang === 'fr') {
                    // Video Subtitle Beta Workflow (.ASS preview & editor)
                    const data = await safeFetchJson('/api/video/generate-ass', {
                        method: 'POST',
                        body: JSON.stringify({ filename: selectedFilename, target_lang: 'fr' })
                    });

                    if (data.success) {
                        currentVideoFilename = selectedFilename;
                        currentAssFilename = data.ass_filename;

                        if (assEditorTextarea) assEditorTextarea.value = data.ass_content;
                        if (betaSubtitleSection) betaSubtitleSection.classList.remove('hidden');

                        if (arabicText) arabicText.textContent = data.full_arabic_text;
                        if (frenchText) frenchText.textContent = data.full_french_translation;

                        alert(dict.alertAssSuccess);
                    } else {
                        alert(dict.alertProcessError + (data.error || ""));
                    }
                } else {
                    let data = await safeFetchJson('/api/process-audio', {
                        method: 'POST',
                        body: JSON.stringify({ filename: selectedFilename, target_lang: targetLang })
                    });
                    if (data.async && data.jobId) {
                        data = await pollJobResult(data.jobId);
                    }

                    if (data.arabic_text) {
                        if (arabicText) arabicText.textContent = data.arabic_text;
                        if (frenchText) frenchText.textContent = data.french_translation;
                        if (frenchAudio) {
                            frenchAudio.src = data.french_audio_url;
                            frenchAudio.play().catch(() => {});
                        }

                        currentReceivedAudioUrl = data.french_audio_url;
                        currentReceivedAudioFile = data.french_audio_url ? data.french_audio_url.split('?')[0].split('/').pop() : "note_vocale.mp3";

                        if (receivedAudioActionsStack) receivedAudioActionsStack.classList.remove('hidden');

                        const itemIndex = audioDataList.findIndex(a => a.filename === selectedFilename);
                        if (itemIndex !== -1) {
                            audioDataList[itemIndex].arabic_text = data.arabic_text;
                            audioDataList[itemIndex].french_translation = data.french_translation;
                            audioDataList[itemIndex].french_audio_url = data.french_audio_url;
                        }
                    } else {
                        alert(dict.alertProcessError + (data.error || ""));
                    }
                }
            } catch (err) {
                console.error(err);
                alert(dict.alertProcessError + err.message);
            } finally {
                processAudioBtn.disabled = false;
                updateProcessAudioButtonText();
            }
        });
    }

    // Burn Subtitles Button Listener (Beta Subtitles Incrustation)
    if (btnBurnSubtitles) {
        btnBurnSubtitles.addEventListener('click', async () => {
            const dict = i18n[currentLang] || i18n.ar;
            if (!currentVideoFilename) {
                return alert("Veuillez sélectionner un fichier vidéo d'abord.");
            }

            btnBurnSubtitles.disabled = true;
            btnBurnSubtitles.innerHTML = dict.alertBurningLoading;

            try {
                const editedAssContent = assEditorTextarea ? assEditorTextarea.value : '';
                const data = await safeFetchJson('/api/video/burn-subtitles', {
                    method: 'POST',
                    body: JSON.stringify({
                        video_filename: currentVideoFilename,
                        ass_filename: currentAssFilename,
                        ass_content: editedAssContent
                    })
                });

                if (data.success) {
                    if (ayaVideo) {
                        ayaVideo.src = `${data.video_url}?t=${Date.now()}`;
                        ayaVideo.classList.remove('hidden');
                        if (ayaAudio) ayaAudio.classList.add('hidden');
                        ayaVideo.play().catch(() => {});
                    }
                    alert(dict.alertBurningSuccess);
                } else {
                    alert("Erreur lors de l'incrustation : " + (data.error || ""));
                }
            } catch (err) {
                console.error("Burn subtitles error:", err);
                alert("Erreur lors de l'incrustation : " + err.message);
            } finally {
                btnBurnSubtitles.disabled = false;
                btnBurnSubtitles.innerHTML = dict.btnBurnSubtitles;
            }
        });
    }

    // Play French Audio Button
    if (playFrenchBtn && frenchAudio) {
        playFrenchBtn.addEventListener('click', () => {
            const dict = i18n[currentLang];
            if (!frenchAudio.src) return alert(dict.alertPlayFrenchFirst);
            if (frenchAudio.paused) {
                frenchAudio.play().catch(() => {});
                playFrenchBtn.innerHTML = dict.playFrenchPauseBtn;
            } else {
                frenchAudio.pause();
                playFrenchBtn.innerHTML = dict.playFrenchBtn;
            }
        });

        frenchAudio.addEventListener('ended', () => {
            const dict = i18n[currentLang];
            playFrenchBtn.innerHTML = dict.playFrenchBtn;
        });
    }

    // Copy Text Buttons
    if (copyArabicTextBtn && arabicText) {
        copyArabicTextBtn.addEventListener('click', () => {
            const dict = i18n[currentLang];
            copyToClipboard(arabicText.textContent, copyArabicTextBtn, dict.alertCopyArabicSuccess);
        });
    }

    if (copyFrenchTextBtn && frenchText) {
        copyFrenchTextBtn.addEventListener('click', () => {
            const dict = i18n[currentLang];
            copyToClipboard(frenchText.textContent, copyFrenchTextBtn, dict.alertCopyFrenchSuccess);
        });
    }

    if (copyReplyArabicBtn && arabicReplyText) {
        copyReplyArabicBtn.addEventListener('click', () => {
            const dict = i18n[currentLang];
            copyToClipboard(arabicReplyText.textContent, copyReplyArabicBtn, dict.alertCopySuccess);
        });
    }

    // Purge Audio from Disk Button
    if (purgeAudioBtn) {
        purgeAudioBtn.addEventListener('click', async () => {
            if (!currentGeneratedAudioFile) return;
            const dict = i18n[currentLang];

            try {
                await fetch('/api/purge-audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: currentGeneratedAudioFile })
                });

                if (replyResult) replyResult.classList.add('hidden');
                currentGeneratedAudioFile = '';
                currentAudioUrl = '';
                alert(dict.alertPurgeSuccess);
            } catch (err) {
                console.error("Purge error:", err);
            }
        });
    }

    // SECTION 1: Generate Arabic Audio Note from French Input
    if (generateReplyFrBtn && replyInputFr) {
        generateReplyFrBtn.addEventListener('click', async () => {
            const inputVal = replyInputFr.value.trim();
            const dict = i18n[currentLang];

            if (!inputVal) {
                alert(dict.alertReplyFrEmpty);
                replyInputFr.focus();
                return;
            }

            generateReplyFrBtn.disabled = true;
            generateReplyFrBtn.innerHTML = dict.alertReplyFrLoading;

            try {
                const data = await safeFetchJson('/api/reply-to-aya', {
                    method: 'POST',
                    body: JSON.stringify({
                        text_fr: inputVal,
                        voice: voiceSelect ? voiceSelect.value : 'ar-JO-SanaNeural'
                    })
                });
                if (data.arabic_translation) {
                    if (arabicReplyText) arabicReplyText.textContent = data.arabic_translation;
                    if (arabicReplyAudio) arabicReplyAudio.src = data.audio_url;
                    currentGeneratedAudioFile = data.audio_file;
                    currentArabicTranslation = data.arabic_translation;
                    currentAudioUrl = data.audio_url;

                    if (flagResult) flagResult.textContent = '🇵🇸';
                    if (replyResult) replyResult.classList.remove('hidden');
                    if (arabicReplyAudio) arabicReplyAudio.play().catch(() => {});
                } else {
                    alert((dict.alertConnError) + " : " + (data.error || ""));
                }
            } catch (err) {
                console.error(err);
                alert(dict.alertConnError);
            } finally {
                generateReplyFrBtn.disabled = false;
                generateReplyFrBtn.innerHTML = dict.generateReplyFrBtn;
            }
        });
    }

    // SECTION 2: Generate French Audio Note & Translation from Arabic Input
    if (generateReplyArBtn && replyInputAr) {
        generateReplyArBtn.addEventListener('click', async () => {
            const inputVal = replyInputAr.value.trim();
            const dict = i18n[currentLang];

            if (!inputVal) {
                alert(dict.alertReplyArEmpty);
                replyInputAr.focus();
                return;
            }

            generateReplyArBtn.disabled = true;
            generateReplyArBtn.innerHTML = dict.alertReplyArLoading;

            try {
                const data = await safeFetchJson('/api/reply-in-french', {
                    method: 'POST',
                    body: JSON.stringify({
                        text_ar: inputVal,
                        voice: 'fr-FR-VivienneMultilingualNeural'
                    })
                });
                if (data.french_translation) {
                    if (arabicReplyText) arabicReplyText.textContent = data.french_translation;
                    if (arabicReplyAudio) arabicReplyAudio.src = data.audio_url;
                    currentGeneratedAudioFile = data.audio_file;
                    currentArabicTranslation = data.french_translation;
                    currentAudioUrl = data.audio_url;

                    if (flagResult) flagResult.textContent = '🇫🇷';
                    if (replyResult) replyResult.classList.remove('hidden');
                    if (arabicReplyAudio) arabicReplyAudio.play().catch(() => {});
                } else {
                    alert((dict.alertConnError) + " : " + (data.error || ""));
                }
            } catch (err) {
                console.error(err);
                alert(dict.alertConnError);
            } finally {
                generateReplyArBtn.disabled = false;
                generateReplyArBtn.innerHTML = dict.generateReplyArBtn;
            }
        });
    }

    // -------------------------------------------------------------
    // CHAT ÉPHÉMÈRE 24H LOGIC & REAL-TIME SYNC
    // -------------------------------------------------------------
    async function loadChatMessages() {
        if (!chatHistoryBox) return;
        const dict = i18n[currentLang];

        try {
            const res = await fetch('/api/chat/messages');
            const data = await res.json();
            const messages = data.messages || [];
            isChatDisabled = !!data.disabled;

            const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.username.toLowerCase() === 'john');

            // Update Admin Toggle Button text & style
            if (adminToggleChatBtn) {
                if (isChatDisabled) {
                    adminToggleChatBtn.innerHTML = dict.adminToggleChatEnable;
                    adminToggleChatBtn.style.color = '#34d399';
                    adminToggleChatBtn.style.borderColor = '#10b981';
                } else {
                    adminToggleChatBtn.innerHTML = dict.adminToggleChatDisable;
                    adminToggleChatBtn.style.color = '#93c5fd';
                    adminToggleChatBtn.style.borderColor = '#3b82f6';
                }
            }

            // Lock / Unlock Chat Inputs
            if (chatInputText) {
                chatInputText.disabled = isChatDisabled;
                if (isChatDisabled) {
                    chatInputText.placeholder = dict.chatDisabledNotice;
                } else {
                    chatInputText.placeholder = dict.chatInputPlaceholder;
                }
            }
            if (chatSendBtn) chatSendBtn.disabled = isChatDisabled;
            if (chatMicBtn) chatMicBtn.disabled = isChatDisabled;

            // Handle UI display when disabled
            if (isChatDisabled) {
                if (!isAdmin) {
                    chatHistoryBox.innerHTML = `
                        <div style="text-align: center; color: #f87171; padding: 30px; font-weight: 600; font-size: 0.95rem; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                            ${dict.chatDisabledNotice}
                        </div>
                    `;
                    return;
                }
            }

            if (messages.length === 0) {
                chatHistoryBox.innerHTML = `
                    <div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.9rem;">
                        ${dict.chatEmptyNotice}
                    </div>
                `;
                return;
            }

            chatHistoryBox.innerHTML = '';
            if (isChatDisabled && isAdmin) {
                const noticeBanner = document.createElement('div');
                noticeBanner.style.cssText = 'text-align: center; color: #f87171; padding: 8px; font-size: 0.85rem; font-weight: 600; background: rgba(239, 68, 68, 0.15); border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(239, 68, 68, 0.3);';
                noticeBanner.textContent = currentLang === 'ar' ? '⚠️ المحادثة معطلة حالياً للمستخدمين (وضع المسؤول)' : '⚠️ Le chat est désactivé pour les utilisateurs (Mode Admin)';
                chatHistoryBox.appendChild(noticeBanner);
            }

            const myName = currentUser ? (currentUser.name || currentUser.username).toLowerCase() : '';

            messages.forEach(msg => {
                const isMe = myName && msg.sender.toLowerCase().includes(myName);
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;

                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let audioBtnHTML = '';
                if (msg.audioUrl) {
                    audioBtnHTML = `
                        <div class="chat-audio-controls">
                            <button class="chat-play-btn" data-audio="${msg.audioUrl}">
                                🔊 ${dict.chatPlayAudioText}
                            </button>
                        </div>
                    `;
                }

                bubble.innerHTML = `
                    <div class="chat-sender-name">
                        <span>👤 ${msg.sender}</span>
                        <span class="chat-time-tag">🕒 ${timeStr}</span>
                    </div>
                    <div class="chat-text-original">${msg.originalText}</div>
                    <div class="chat-text-translated">✨ ${msg.translatedText}</div>
                    ${audioBtnHTML}
                `;

                chatHistoryBox.appendChild(bubble);
            });

            // Attach Play Audio Listeners
            const playBtns = chatHistoryBox.querySelectorAll('.chat-play-btn');
            playBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const audioUrl = btn.getAttribute('data-audio');
                    if (audioUrl) {
                        if (currentChatAudio) {
                            currentChatAudio.pause();
                        }
                        currentChatAudio = new Audio(audioUrl);
                        currentChatAudio.play().catch(() => {});
                    }
                });
            });

            // Scroll to bottom
            chatHistoryBox.scrollTop = chatHistoryBox.scrollHeight;
        } catch (err) {
            console.error("Failed to load chat messages:", err);
        }
    }

    async function sendChatMessage() {
        if (!chatInputText) return;
        const textVal = chatInputText.value.trim();
        if (!textVal) return;
        const dict = i18n[currentLang];

        if (chatSendBtn) {
            chatSendBtn.disabled = true;
            chatSendBtn.innerHTML = '⏳';
        }

        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textVal,
                    sender: currentUser ? (currentUser.name || currentUser.username) : (currentLang === 'ar' ? 'آية' : 'Utilisateur'),
                    userLang: currentLang
                })
            });

            const data = await res.json();
            if (data.success) {
                chatInputText.value = '';
                await loadChatMessages();
            } else {
                alert(dict.alertChatError + (data.error || ""));
            }
        } catch (err) {
            console.error("Chat send error:", err);
        } finally {
            if (chatSendBtn) {
                chatSendBtn.disabled = false;
                chatSendBtn.innerHTML = '🚀 <span id="btnChatSendText">' + dict.btnChatSendText + '</span>';
            }
        }
    }

    // Chat Voice Recording Logic
    async function startChatMicRecording() {
        const dict = i18n[currentLang];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chatMediaRecorder = new MediaRecorder(stream);
            chatAudioChunks = [];

            chatMediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) chatAudioChunks.push(e.data);
            };

            chatMediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chatAudioChunks, { type: 'audio/webm' });
                await uploadAndSendChatAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            chatMediaRecorder.start();
            isChatRecording = true;
            if (chatMicBtn) {
                chatMicBtn.innerHTML = '⏹️';
                chatMicBtn.style.animation = 'pulseRecording 1.5s infinite';
            }
        } catch (err) {
            console.error("Chat microphone error:", err);
            alert(dict.alertMicPermission);
        }
    }

    function stopChatMicRecording() {
        if (chatMediaRecorder && isChatRecording) {
            chatMediaRecorder.stop();
            isChatRecording = false;
            if (chatMicBtn) {
                chatMicBtn.innerHTML = '🎙️';
                chatMicBtn.style.animation = '';
            }
        }
    }

    async function uploadAndSendChatAudio(blob) {
        const dict = i18n[currentLang];
        if (chatMicBtn) {
            chatMicBtn.disabled = true;
            chatMicBtn.innerHTML = '⏳';
        }

        const formData = new FormData();
        formData.append('audio', blob, `chat_rec_${Date.now()}.webm`);
        formData.append('userLang', currentLang);
        formData.append('sender', currentUser ? (currentUser.name || currentUser.username) : (currentLang === 'ar' ? 'آية' : 'Utilisateur'));

        try {
            const res = await fetch('/api/chat/send-audio', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                await loadChatMessages();
            } else {
                alert(dict.alertChatVoiceError + " : " + (data.error || ""));
            }
        } catch (err) {
            console.error("Chat audio upload error:", err);
            alert(dict.alertChatVoiceError);
        } finally {
            if (chatMicBtn) {
                chatMicBtn.disabled = false;
                chatMicBtn.innerHTML = '🎙️';
            }
        }
    }

    if (chatMicBtn) {
        chatMicBtn.addEventListener('click', () => {
            if (!isChatRecording) {
                startChatMicRecording();
            } else {
                stopChatMicRecording();
            }
        });
    }

    if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
    if (chatInputText) {
        chatInputText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    // Admin Chat Toolbar Action Handlers
    if (adminToggleChatBtn) {
        adminToggleChatBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/chat/toggle-status', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    await loadChatMessages();
                }
            } catch (err) {
                console.error("Toggle chat error:", err);
            }
        });
    }

    if (adminResetChatBtn) {
        adminResetChatBtn.addEventListener('click', async () => {
            const dict = i18n[currentLang];
            if (!confirm(dict.alertChatResetConfirm)) return;
            try {
                const res = await fetch('/api/chat/reset', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(dict.alertChatResetSuccess);
                    await loadChatMessages();
                }
            } catch (err) {
                console.error("Reset chat error:", err);
            }
        });
    }

    if (adminArchiveChatBtn) {
        adminArchiveChatBtn.addEventListener('click', async () => {
            const dict = i18n[currentLang];
            try {
                const res = await fetch('/api/chat/archive', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(dict.alertChatArchiveSuccess);
                }
            } catch (err) {
                console.error("Archive chat error:", err);
            }
        });
    }

    // Auto-refresh chat every 4 seconds
    setInterval(loadChatMessages, 4000);

    // VOSTFR Video TikTok & ASS Subtitle Creator Handler (Protocole V3)
    const vostfrMediaFileInput = document.getElementById('vostfrMediaFileInput');
    const vostfrVideoTitle = document.getElementById('vostfrVideoTitle');
    const vostfrBgImageInput = document.getElementById('vostfrBgImageInput');
    const generateVostfrVideoBtn = document.getElementById('generateVostfrVideoBtn');
    const vostfrResultSection = document.getElementById('vostfrResultSection');
    const vostfrPreviewVideo = document.getElementById('vostfrPreviewVideo');
    const downloadVostfrMp4Btn = document.getElementById('downloadVostfrMp4Btn');
    const downloadAssFileBtn = document.getElementById('downloadAssFileBtn');

    if (generateVostfrVideoBtn && vostfrBgImageInput) {
        generateVostfrVideoBtn.addEventListener('click', async () => {
            const title = vostfrVideoTitle ? vostfrVideoTitle.value.trim() : "Titre de la vidéo";
            const bgFile = vostfrBgImageInput.files[0];
            const mediaFile = vostfrMediaFileInput ? vostfrMediaFileInput.files[0] : null;

            if (!bgFile) {
                alert("Veuillez sélectionner une photo de fond d'écran depuis vos dossiers.");
                vostfrBgImageInput.focus();
                return;
            }

            generateVostfrVideoBtn.disabled = true;
            generateVostfrVideoBtn.innerHTML = "⏳ Traduction & Génération de la vidéo TikTok .ASS en cours...";

            const formData = new FormData();
            formData.append('title', title);
            formData.append('bg_image', bgFile);
            if (mediaFile) {
                formData.append('media_file', mediaFile);
            } else {
                formData.append('audio_filename', currentReceivedAudioFile || '');
                formData.append('subtitle_text', (frenchText ? frenchText.textContent : '') || title);
            }

            try {
                let data = await safeFetchJson('/api/generate-vostfr-video', {
                    method: 'POST',
                    body: formData
                });

                if (data.async && data.jobId) {
                    data = await pollJobResult(data.jobId);
                }

                if (data.video_url) {
                    if (vostfrPreviewVideo) vostfrPreviewVideo.src = data.video_url;
                    if (downloadVostfrMp4Btn) {
                        downloadVostfrMp4Btn.href = data.video_url;
                        downloadVostfrMp4Btn.setAttribute('download', data.mp4_filename || 'vostfr_tiktok.mp4');
                    }
                    if (downloadAssFileBtn) {
                        downloadAssFileBtn.href = data.ass_url;
                        downloadAssFileBtn.setAttribute('download', data.ass_filename || 'subtitles.ass');
                    }
                    if (vostfrResultSection) vostfrResultSection.classList.remove('hidden');
                    alert("✨ Vidéo TikTok 1080x1920 & Sous-titres .ASS générés avec succès (Protocole V3) !");
                } else {
                    alert("Erreur lors de la génération vidéo : " + (data.error || ""));
                }
            } catch (err) {
                console.error("VOSTFR Generation error:", err);
                alert("Erreur : " + err.message);
            } finally {
                generateVostfrVideoBtn.disabled = false;
                generateVostfrVideoBtn.innerHTML = "✨ Générer la Vidéo TikTok 1080x1920 & Sous-titres .ASS";
            }
        });
    }

    // Initial Execution
    applyLanguage(currentLang);
    checkLoginStatus();
    loadChatMessages();
});
