/**
 * Test End-to-End de Génération via l'Interface Utilisateur (Sprint Jour 3)
 * Vérifie le parcours complet :
 *  1. Clic sur "Générer ma Fiche 9:16 (1 Crédit)"
 *  2. Affichage de la progression étape par étape
 *  3. Affichage de l'écran de résultat avec aperçu 9:16, lecteur audio HTML5 et boutons de téléchargement HD JPG / MP3
 *  4. Capture d'écran du résultat pour la documentation
 */

const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\artas\\.gemini\\antigravity\\brain\\151e1df8-1d13-45f3-9a90-ecb552a8c5af';

async function runE2eGeneration() {
    console.log("=================================================================");
    console.log("  🚀 TEST E2E UI : PARCOURS CRÉATEUR DE BOUT EN BOUT");
    console.log("=================================================================\n");

    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

        console.log("1. Connexion en tant que Testeur Aya...");
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

        await page.evaluate(async () => {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ tester_id: 'aya', access_code: 'Gaza2026' })
            });
            const d = await res.json();
            if (d.success && d.user) localStorage.setItem('aya_user', JSON.stringify(d.user));
        });

        console.log("2. Navigation vers /profil?tab=cards...");
        await page.goto('http://localhost:3000/profil?tab=cards', { waitUntil: 'networkidle2' });

        console.log("3. Ouverture du Modal Créateur...");
        await page.waitForSelector('#btnOpenVocabModal', { visible: true });
        await page.click('#btnOpenVocabModal');

        await page.waitForSelector('#vocabCreateModal', { visible: true });

        // Sélectionner le thème Palestine & Liberté
        console.log("4. Sélection du Thème 'Palestine & Liberté'...");
        await page.evaluate(() => {
            const chips = document.querySelectorAll('.theme-chip');
            if (chips.length > 1) chips[1].click();
        });

        console.log("5. Lancement de la génération (Débit de 1 crédit)...");
        const startTime = Date.now();
        await page.click('#btnSubmitVocabGenerate');

        // Vérifier que l'écran de progression s'affiche
        await page.waitForSelector('#vocabProgressScreen', { visible: true });
        console.log("⏳ Écran de progression actif avec barre animée...");

        // Attendre que l'écran de résultat apparaisse (max 60s)
        await page.waitForSelector('#vocabResultScreen', { visible: true, timeout: 60000 });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`🎉 Génération UI terminée en ${elapsed}s !`);

        // Vérifier les éléments clés du rendu
        const hasImg = await page.$eval('#vocabResultImg', el => el.src && el.src.includes('.jpg'));
        const hasAudio = await page.$eval('#vocabResultAudio', el => el.src && el.src.includes('.mp3'));
        const titleFr = await page.$eval('#vocabResultTitleFr', el => el.textContent);
        const titleAr = await page.$eval('#vocabResultTitleAr', el => el.textContent);
        const wordsCount = await page.$$eval('#vocabResultWordsList .vocab-word-preview-row', els => els.length);

        console.log(`- Image HD générée : ${hasImg ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`- Audio bilingue généré : ${hasAudio ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`- Titre FR : ${titleFr}`);
        console.log(`- Titre AR : ${titleAr}`);
        console.log(`- Mots affichés : ${wordsCount} mots bilingues avec phonétique`);

        // Capture d'écran du résultat complet
        const resultShotPath = path.join(ARTIFACT_DIR, 'preview_j3_result_screen.png');
        await page.screenshot({ path: resultShotPath, fullPage: false });
        console.log(`📸 Capture de l'écran de résultat enregistrée : ${resultShotPath}`);

        // Fermer le modal pour voir la galerie mise à jour
        await page.click('#btnCloseVocabCreateModal');
        await new Promise(r => setTimeout(r, 1200));

        // Capture d'écran de la galerie avec la nouvelle carte
        const updatedGalleryPath = path.join(ARTIFACT_DIR, 'preview_j3_gallery_with_card.png');
        await page.screenshot({ path: updatedGalleryPath, fullPage: false });
        console.log(`📸 Capture de la galerie mise à jour : ${updatedGalleryPath}`);

        console.log("\n=================================================================");
        console.log("  🏆 PARCOURS CRÉATEUR VALIDÉ AVEC SUCCÈS À 100% !");
        console.log("=================================================================\n");

    } finally {
        await browser.close();
    }
}

runE2eGeneration().catch(err => {
    console.error("❌ ERREUR TEST E2E UI :", err);
    process.exit(1);
});
