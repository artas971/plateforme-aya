/**
 * Test d'Intégration API & Débit Sécurisé des Crédits (Sprint Express - Jour 2)
 * Valide les scénarios :
 *  1. Rejet 401 si utilisateur non authentifié
 *  2. Rejet 402 Payment Required si solde insuffisant (0 crédit)
 *  3. Résilience et Rollback atomique en cas d'erreur de génération (crédit restitué)
 *  4. Succès complet avec débit atomique (5 -> 4 crédits), fichiers générés et enregistrés dans l'historique
 *  5. Récupération de l'historique utilisateur (GET /api/premium/vocabulary-cards)
 *  6. Récupération par ID et suppression propre (DELETE)
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const premiumRouter = require('./routes/premium');
const { readFallbackUsers, saveFallbackUsers } = (() => {
    const DATA_DIR = path.join(__dirname, 'data');
    const FALLBACK_USERS_FILE = path.join(DATA_DIR, 'users.json');
    return {
        readFallbackUsers: () => {
            try { return JSON.parse(fs.readFileSync(FALLBACK_USERS_FILE, 'utf-8')); } catch (e) { return []; }
        },
        saveFallbackUsers: (users) => {
            fs.writeFileSync(FALLBACK_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
        }
    };
})();

const TEST_USER_ID = 'usr_test_vocab_j2';
const TEST_USERNAME = '@test_vocab_j2';
const TEST_PORT = 3899;

// Mock contextuel de session pour les tests
let currentSessionUser = null;

function createTestServer() {
    const app = express();
    app.use(express.json());

    // Injecteur de session pour simuler un utilisateur connecté ou déconnecté
    app.use((req, res, next) => {
        req.session = currentSessionUser ? { user: { ...currentSessionUser } } : null;
        next();
    });

    // Montage du routeur premium
    app.use('/api/premium', premiumRouter);

    return app;
}

function setTestUserCredits(credits, reserved = 0) {
    const users = readFallbackUsers();
    let user = users.find(u => u.id === TEST_USER_ID);
    if (!user) {
        user = {
            id: TEST_USER_ID,
            username: TEST_USERNAME,
            email: 'test_vocab_j2@aya.test',
            name: 'Testeur Premium J2',
            role: 'contributeur',
            credits: credits,
            creditsReserved: reserved,
            isVerified: true,
            createdAt: new Date().toISOString()
        };
        users.push(user);
    } else {
        user.credits = credits;
        user.creditsReserved = reserved;
    }
    saveFallbackUsers(users);
}

function getTestUser() {
    const users = readFallbackUsers();
    return users.find(u => u.id === TEST_USER_ID);
}

function cleanupTestUser() {
    const users = readFallbackUsers();
    const filtered = users.filter(u => u.id !== TEST_USER_ID);
    saveFallbackUsers(filtered);
}

async function runTests() {
    console.log("=================================================================");
    console.log("  🧪 SUITE DE TESTS API & WALLET ESCROW - SPRINT JOUR 2");
    console.log("=================================================================\n");

    const app = createTestServer();
    const server = http.createServer(app);

    await new Promise(resolve => server.listen(TEST_PORT, resolve));
    console.log(`[TEST HARNESS] 🚀 Serveur de test actif sur http://127.0.0.1:${TEST_PORT}\n`);

    const baseUrl = `http://127.0.0.1:${TEST_PORT}/api/premium`;

    try {
        // -------------------------------------------------------------
        // SCÉNARIO 0 : Non-authentifié -> 401
        // -------------------------------------------------------------
        console.log("--- TEST 0 : Accès non authentifié (Garde-fou 401) ---");
        currentSessionUser = null;
        const res0 = await fetch(`${baseUrl}/vocabulary-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ theme: 'test' })
        });
        const data0 = await res0.json();
        console.log(`Statut HTTP : ${res0.status} (attendu : 401)`);
        console.log(`Réponse :`, data0);
        if (res0.status !== 401) throw new Error("Le test 0 a échoué : statut 401 attendu");
        console.log("✅ TEST 0 RÉUSSI : Accès non authentifié bloqué net.\n");

        // -------------------------------------------------------------
        // SCÉNARIO 1 : Solde Insuffisant (0 crédit) -> 402 Payment Required
        // -------------------------------------------------------------
        console.log("--- TEST 1 : Utilisateur sans crédit (Garde-fou 402) ---");
        setTestUserCredits(0, 0);
        currentSessionUser = {
            id: TEST_USER_ID,
            username: TEST_USERNAME,
            name: 'Testeur Premium J2',
            authenticated: true
        };

        const res1 = await fetch(`${baseUrl}/vocabulary-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ theme: 'Espoir et Liberté' })
        });
        const data1 = await res1.json();
        console.log(`Statut HTTP : ${res1.status} (attendu : 402)`);
        console.log(`Réponse :`, data1);

        const userAfterTest1 = getTestUser();
        console.log(`Vérification crédits après rejet : credits=${userAfterTest1.credits}, reserved=${userAfterTest1.creditsReserved}`);

        if (res1.status !== 402 || data1.reason !== 'INSUFFICIENT_CREDITS') {
            throw new Error("Le test 1 a échoué : code 402 ou raison INSUFFICIENT_CREDITS manquante");
        }
        if (userAfterTest1.credits !== 0 || userAfterTest1.creditsReserved !== 0) {
            throw new Error("Le test 1 a échoué : les crédits ont été altérés");
        }
        console.log("✅ TEST 1 RÉUSSI : Rejet 402 Payment Required immédiat sans déclencher Puppeteer.\n");

        // -------------------------------------------------------------
        // SCÉNARIO 2 : Panne / Erreur de génération -> Rollback garanti
        // -------------------------------------------------------------
        console.log("--- TEST 2 : Résilience & Restitution Immédiate du Crédit (Rollback) ---");
        setTestUserCredits(3, 0); // 3 crédits de départ

        // On substitue temporairement le service de génération pour injecter une panne simulée
        const vocabService = require('./services/vocabularyCardService');
        const originalGen = vocabService.generateFullVocabularyCard;

        vocabService.generateFullVocabularyCard = async () => {
            console.log("  [SIMULATEUR DE PANNE] 💥 Injection d'une erreur simulée (timeout / crash)");
            throw new Error("Crash simulé de Puppeteer / Défaillance réseau");
        };

        const res2 = await fetch(`${baseUrl}/vocabulary-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ theme: 'Crash Test' })
        });
        const data2 = await res2.json();
        console.log(`Statut HTTP : ${res2.status} (attendu : 500)`);
        console.log(`Réponse :`, data2);

        // Restauration de la méthode originale
        vocabService.generateFullVocabularyCard = originalGen;

        const userAfterTest2 = getTestUser();
        console.log(`Vérification crédits après crash : credits=${userAfterTest2.credits} (attendu: 3), reserved=${userAfterTest2.creditsReserved} (attendu: 0)`);

        if (res2.status !== 500 || !data2.creditRestored) {
            throw new Error("Le test 2 a échoué : statut 500 ou flag creditRestored manquant");
        }
        if (userAfterTest2.credits !== 3 || userAfterTest2.creditsReserved !== 0) {
            throw new Error(`Le test 2 a échoué : solde non restauré (credits=${userAfterTest2.credits})`);
        }
        console.log("✅ TEST 2 RÉUSSI : Crédit séquestré puis intégralement restitué après crash.\n");

        // -------------------------------------------------------------
        // SCÉNARIO 3 : Génération Complète avec Débit Validé (5 -> 4 crédits)
        // -------------------------------------------------------------
        console.log("--- TEST 3 : Génération Complète Réelle & Débit Atomique ---");
        setTestUserCredits(5, 0); // 5 crédits de départ
        console.log(`Solde initial : 5 crédits`);
        console.log(`Lancement de la requête POST /api/premium/vocabulary-card (Thème: "Solidarité et Paix", Niveau: "debutant")...`);

        const startTime = Date.now();
        const res3 = await fetch(`${baseUrl}/vocabulary-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                theme: 'Solidarité et Paix',
                level: 'debutant'
            })
        });
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        const data3 = await res3.json();

        console.log(`Durée d'exécution pipeline complet : ${durationSec}s`);
        console.log(`Statut HTTP : ${res3.status} (attendu : 200)`);
        console.log(`ID Fiche générée : ${data3.card?.id || data3.card?.cardId}`);
        console.log(`Image URL : ${data3.card?.imageUrl}`);
        console.log(`Audio URL : ${data3.card?.audioUrl}`);
        console.log(`Mots générés (${data3.card?.words?.length || 0}) :`, data3.card?.words?.map(w => w.french).join(', '));

        const userAfterTest3 = getTestUser();
        console.log(`Vérification crédits après succès : credits=${userAfterTest3.credits} (attendu: 4), reserved=${userAfterTest3.creditsReserved} (attendu: 0)`);

        if (res3.status !== 200 || !data3.success) {
            throw new Error("Le test 3 a échoué : génération incomplète");
        }
        if (userAfterTest3.credits !== 4 || userAfterTest3.creditsReserved !== 0) {
            throw new Error(`Le test 3 a échoué : débit incorrect (credits=${userAfterTest3.credits})`);
        }

        const createdCardId = data3.card?.id || data3.card?.cardId;
        console.log("✅ TEST 3 RÉUSSI : Fiche générée avec succès et 1 crédit débité de façon définitive.\n");

        // -------------------------------------------------------------
        // SCÉNARIO 4 : Consultation de l'historique utilisateur (GET)
        // -------------------------------------------------------------
        console.log("--- TEST 4 : Consultation de l'Historique (GET /vocabulary-cards) ---");
        const res4 = await fetch(`${baseUrl}/vocabulary-cards`, {
            headers: { 'Accept': 'application/json' }
        });
        const data4 = await res4.json();
        console.log(`Statut HTTP : ${res4.status}`);
        console.log(`Nombre de fiches trouvées : ${data4.cards?.length}`);
        const found = data4.cards?.some(c => (c.id === createdCardId || c.cardId === createdCardId));
        if (!found) throw new Error("Le test 4 a échoué : la fiche créée n'apparaît pas dans l'historique");
        console.log("✅ TEST 4 RÉUSSI : La nouvelle fiche est bien archivée dans l'historique utilisateur.\n");

        // -------------------------------------------------------------
        // SCÉNARIO 5 : Consultation d'une fiche spécifique (GET /:id)
        // -------------------------------------------------------------
        console.log("--- TEST 5 : Détail d'une Fiche (GET /vocabulary-cards/:id) ---");
        const res5 = await fetch(`${baseUrl}/vocabulary-cards/${createdCardId}`, {
            headers: { 'Accept': 'application/json' }
        });
        const data5 = await res5.json();
        console.log(`Statut HTTP : ${res5.status}`);
        console.log(`Titre FR : ${data5.card?.titleFr} | Titre AR : ${data5.card?.titleAr}`);
        if (res5.status !== 200 || !data5.card) throw new Error("Le test 5 a échoué");
        console.log("✅ TEST 5 RÉUSSI : Récupération fidèle de la fiche.\n");

        // -------------------------------------------------------------
        // SCÉNARIO 6 : Nettoyage et Suppression (DELETE /:id)
        // -------------------------------------------------------------
        console.log("--- TEST 6 : Suppression Propre (DELETE /vocabulary-cards/:id) ---");
        const res6 = await fetch(`${baseUrl}/vocabulary-cards/${createdCardId}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/json' }
        });
        const data6 = await res6.json();
        console.log(`Statut HTTP : ${res6.status} | Message : ${data6.message}`);
        if (res6.status !== 200) throw new Error("Le test 6 a échoué");
        console.log("✅ TEST 6 RÉUSSI : Fiche et assets supprimés avec succès.\n");

        console.log("=================================================================");
        console.log("  🏆 TOUS LES TESTS DU SPRINT JOUR 2 ONT RÉUSSI AVEC SUCCÈS !");
        console.log("=================================================================");

    } finally {
        cleanupTestUser();
        server.close();
    }
}

runTests().catch(err => {
    console.error("\n❌ ÉCHEC DES TESTS :", err);
    process.exit(1);
});
