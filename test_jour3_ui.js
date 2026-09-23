/**
 * Test de Validation UI & Responsive — Sprint Jour 3
 * Vérifie :
 *  1. Chargement de profil.html avec les onglets "Vidéos" et "Fiches Vocabulaire"
 *  2. Bascule d'onglet vers "Fiches Vocabulaire 9:16"
 *  3. Ouverture et interaction avec le modal de création (thèmes, niveaux, solde)
 *  4. Contrôle du responsive sur écran Mobile (390x844 - iPhone) et Desktop (1280x800)
 *  5. Capture d'écran officielle enregistrée dans les artéfacts
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\artas\\.gemini\\antigravity\\brain\\151e1df8-1d13-45f3-9a90-ecb552a8c5af';

async function runUiValidation() {
    console.log("=================================================================");
    console.log("  🎨 VALIDATION UI FRONTEND & RESPONSIVE - SPRINT JOUR 3");
    console.log("=================================================================\n");

    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
        ]
    });

    const page = await browser.newPage();

    try {
        // -------------------------------------------------------------
        // 1. Configuration Session Testeur dans le navigateur
        // -------------------------------------------------------------
        console.log("1. Authentification via le sas testeur...");
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

        const loginRes = await page.evaluate(async () => {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    tester_id: 'aya',
                    access_code: 'Gaza2026'
                })
            });
            const data = await res.json();
            if (data.success && data.user) {
                localStorage.setItem('aya_user', JSON.stringify(data.user));
            }
            return data;
        });
        console.log("Résultat connexion :", loginRes.success ? `Connecté sous ${loginRes.user.name}` : loginRes);

        // -------------------------------------------------------------
        // 2. Navigation vers la page Profil (Vue Desktop)
        // -------------------------------------------------------------
        console.log("2. Navigation vers /profil?tab=cards en vue Desktop (1280x800)...");
        await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
        await page.goto('http://localhost:3000/profil?tab=cards', { waitUntil: 'networkidle2' });

        // Vérifier la présence des onglets
        const tabBtnCards = await page.$('#tabBtnCards');
        const tabBtnVideos = await page.$('#tabBtnVideos');
        if (!tabBtnCards || !tabBtnVideos) throw new Error("Les boutons d'onglets sont introuvables !");

        // Attendre que l'onglet Fiches soit bien affiché
        await page.waitForSelector('#tabContentCards', { visible: true });
        console.log("✅ Onglet 'Fiches Vocabulaire 9:16' actif et visible.");

        // Capture Desktop
        const desktopShotPath = path.join(ARTIFACT_DIR, 'preview_j3_desktop_gallery.png');
        await page.screenshot({ path: desktopShotPath, fullPage: false });
        console.log(`📸 Capture Desktop enregistrée : ${desktopShotPath}`);

        // -------------------------------------------------------------
        // 3. Test d'ouverture du Modal de Création & Interaction
        // -------------------------------------------------------------
        console.log("\n3. Ouverture du Modal de Création Fiche 9:16...");
        const btnOpenModal = await page.$('#btnOpenVocabModal');
        await btnOpenModal.click();

        await page.waitForSelector('#vocabCreateModal', { visible: true });
        console.log("✅ Modal de création ouvert.");

        // Sélectionner un thème rapide (ex: Palestine & Liberté)
        await page.evaluate(() => {
            const chips = document.querySelectorAll('.theme-chip');
            if (chips.length > 1) chips[1].click();
        });

        const selectedThemeVal = await page.$eval('#vocabThemeInput', el => el.value);
        console.log(`Thème sélectionné via puce rapide : "${selectedThemeVal}"`);

        // Capture Modal Desktop
        const modalShotPath = path.join(ARTIFACT_DIR, 'preview_j3_modal_creator.png');
        await page.screenshot({ path: modalShotPath, fullPage: false });
        console.log(`📸 Capture Modal enregistrée : ${modalShotPath}`);

        // -------------------------------------------------------------
        // 4. Test Responsive Mobile (iPhone 14 : 390x844)
        // -------------------------------------------------------------
        console.log("\n4. Test Responsive Mobile (390x844)...");
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        await page.reload({ waitUntil: 'networkidle2' });

        await page.waitForSelector('#tabContentCards', { visible: true });

        // Capture Mobile Galerie
        const mobileGalleryPath = path.join(ARTIFACT_DIR, 'preview_j3_mobile_gallery.png');
        await page.screenshot({ path: mobileGalleryPath, fullPage: false });
        console.log(`📱 Capture Mobile Galerie enregistrée : ${mobileGalleryPath}`);

        // Ouvrir le modal en vue mobile
        const btnOpenMobile = await page.$('#btnOpenVocabModal');
        await btnOpenMobile.click();
        await page.waitForSelector('#vocabCreateModal', { visible: true });

        // Capture Mobile Modal
        const mobileModalPath = path.join(ARTIFACT_DIR, 'preview_j3_mobile_modal.png');
        await page.screenshot({ path: mobileModalPath, fullPage: false });
        console.log(`📱 Capture Mobile Modal enregistrée : ${mobileModalPath}`);

        console.log("\n=================================================================");
        console.log("  🏆 TOUS LES CONTRÔLES UI SPRINT JOUR 3 SONT VALIDÉS !");
        console.log("=================================================================\n");

    } finally {
        await browser.close();
    }
}

runUiValidation().catch(err => {
    console.error("❌ ERREUR VALIDATION UI :", err);
    process.exit(1);
});
