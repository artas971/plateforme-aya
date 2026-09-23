/**
 * test_vocab_generation.js
 * Test unitaire et fonctionnel autonome du Service de Fiches Vocabulaire Premium
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateFullVocabularyCard } = require('./services/vocabularyCardService');

async function runTest() {
    console.log("======================================================================");
    console.log("🧪 TEST EXPRESS J1 : Générateur Fiches Vocabulaire & Audio (9:16)");
    console.log("======================================================================");

    const startTime = Date.now();
    const testTheme = "salutations_et_bienveillance";

    try {
        console.log(`\n⏳ Lancement du pipeline pour le thème : "${testTheme}"...`);
        const result = await generateFullVocabularyCard({
            theme: testTheme,
            outputId: `test_fiche_j1_${Date.now()}`
        });

        console.log("\n======================================================================");
        console.log("✅ RÉSULTAT DE LA GÉNÉRATION DU SERVICE :");
        console.log("======================================================================");
        console.log(`- Card ID   : ${result.cardId}`);
        console.log(`- Titre FR  : ${result.titleFr}`);
        console.log(`- Titre AR  : ${result.titleAr}`);
        console.log(`- Image JPG : ${result.imagePath} (${fs.statSync(result.imagePath).size} octets)`);
        console.log(`- Audio MP3 : ${result.audioPath} (${fs.statSync(result.audioPath).size} octets)`);
        console.log(`- URL Image : ${result.imageUrl}`);
        console.log(`- URL Audio : ${result.audioUrl}`);
        console.log(`- Durée tot.: ${((Date.now() - startTime) / 1000).toFixed(1)} secondes`);

        console.log("\n📚 DÉTAIL DES 5 MOTS GÉNÉRÉS :");
        result.words.forEach((w, i) => {
            console.log(`  ${i + 1}. [${w.icon || '✨'}] ${w.french} ➔ ${w.arabic}`);
            console.log(`     - Phonétique pour Francophone : [${w.phoneticFr}]`);
            console.log(`     - Phonétique pour Arabophone  : [${w.phoneticAr}]`);
        });

        if (fs.existsSync(result.imagePath) && fs.existsSync(result.audioPath)) {
            console.log("\n🎉 TEST VALIDÉ À 100% : Les fichiers JPG et MP3 existent et sont prêts pour TikTok/Live.");
            process.exit(0);
        } else {
            console.error("\n❌ ÉCHEC : Un ou plusieurs fichiers n'ont pas été créés.");
            process.exit(1);
        }

    } catch (err) {
        console.error("\n❌ ERREUR LORS DU TEST :", err);
        process.exit(1);
    }
}

runTest();
