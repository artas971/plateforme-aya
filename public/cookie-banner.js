/**
 * Aya Studio — Bandeau de Cookies Techniques & RGPD
 * 
 * Conforme à la directive européenne ePrivacy et aux recommandations de la CNIL :
 * Aya Studio utilise exclusivement des cookies techniques de session (connect.sid)
 * strictement indispensables à l'authentification et au fonctionnement de l'application.
 * Aucun cookie publicitaire, commercial ou tiers intrusif n'est déposé.
 */

(function () {
    const CONSENT_KEY = 'aya_cookie_consent';

    // Si le consentement ou l'accusé de réception a déjà été enregistré, on ne réaffiche pas le bandeau
    if (localStorage.getItem(CONSENT_KEY)) {
        return;
    }

    // Détection de la direction / langue
    const isRtl = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';

    const textFr = {
        title: "Cookies techniques & Respect de votre vie privée",
        msg: "Aya Studio utilise exclusivement des <strong>cookies techniques de session</strong> (<code>connect.sid</code>) strictement indispensables au maintien de votre connexion sécurisée et au bon fonctionnement de nos outils IA. <strong>Aucun traceur publicitaire</strong> ni cookie tiers n'est utilisé.",
        linkText: "En savoir plus (Politique RGPD)",
        btnText: "J'ai compris"
    };

    const textAr = {
        title: "ملفات تعريف الارتباط الفنية وحماية الخصوصية",
        msg: "يستخدم استوديو آية حصرياً <strong>ملفات تعريف ارتباط تقنية للجلسة</strong> (<code>connect.sid</code>) الضرورية لأمان اتصالك وعمل أدوات الذكاء الاصطناعي. <strong>لا نستخدم أي ملفات تتبع إعلانية</strong> أو تجارية.",
        linkText: "سياسة الخصوصية (RGPD)",
        btnText: "فهمت ذلك"
    };

    const t = isRtl ? textAr : textFr;

    const bannerHtml = `
        <div id="ayaCookieBanner" class="aya-cookie-banner" role="region" aria-label="Information sur les cookies">
            <div class="aya-cookie-banner-inner">
                <div class="aya-cookie-icon" aria-hidden="true">🍪</div>
                <div class="aya-cookie-text">
                    <strong class="aya-cookie-title">${t.title}</strong>
                    <p class="aya-cookie-desc">${t.msg} <a href="/confidentialite.html" class="aya-cookie-link">${t.linkText}</a>.</p>
                </div>
                <div class="aya-cookie-actions">
                    <button type="button" id="btnAyaCookieAccept" class="aya-cookie-btn">
                        <span>✓</span> ${t.btnText}
                    </button>
                </div>
            </div>
        </div>
    `;

    function injectBanner() {
        if (document.getElementById('ayaCookieBanner')) return;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = bannerHtml.trim();
        const bannerEl = wrapper.firstChild;
        document.body.appendChild(bannerEl);

        const btnAccept = document.getElementById('btnAyaCookieAccept');
        if (btnAccept) {
            btnAccept.addEventListener('click', function () {
                try {
                    localStorage.setItem(CONSENT_KEY, 'accepted_' + new Date().toISOString());
                } catch (e) {
                    // Si localStorage est désactivé ou plein, on ignore
                }

                bannerEl.classList.add('aya-cookie-banner-closing');
                setTimeout(() => {
                    if (bannerEl.parentNode) {
                        bannerEl.parentNode.removeChild(bannerEl);
                    }
                }, 350);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectBanner);
    } else {
        injectBanner();
    }
})();
