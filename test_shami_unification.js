/**
 * Banc de Test de Non-Régression & Synchronisation Sémantique (Agent Alexandre)
 * Valide simultanément le Chat (routes/chat.js) et le Moteur Vidéo (Python/gemini_translator)
 * sur le discours "L'illusion de la solidarité".
 */
require('dotenv').config();
const path = require('path');
const { exec } = require('child_process');
const { formatPythonCommand } = require('./utils/runtime');
const { translateChatBidirectional } = require('./routes/chat');

const sampleExcerpts = [
    {
        name: "Idiome & Métaphore politique (Grand écart)",
        fr: "L'intervention du Maroc à l'ONU met en lumière une diplomatie du grand écart.",
        forbidden: ["النطة الكبيرة", "النطة"],
        expected: ["اللعب على الحبلين", "حبلين"]
    },
    {
        name: "Verbe politique sensible (Dénoncer)",
        fr: "Face aux destructions, le discours officiel dénonce les forces d'occupation.",
        forbidden: ["بتبرأ من", "يتبرأ من", "تتبرأ من"],
        expected: ["بدين", "تدين", "يدين", "استنكار", "بستنكر"]
    },
    {
        name: "Action politique & Retrait de légitimité (Désavouer)",
        fr: "Rabat n'hésite pas à cibler et désavouer les factions armées palestiniennes.",
        forbidden: ["تتنصل منها", "يتنصل منها"],
        expected: ["نزع الشرعية", "تنزع الشرعية", "سحب الشرعية", "ترفض الاعتراف", "رفض الاعتراف", "ترفض تأييد"]
    },
    {
        name: "Translittération nom propre sans particule française",
        fr: "L'allégeance va jusqu'à baptiser une voie rapide marocaine au nom de Donald Trump.",
        forbidden: ["دونالد لترومب", "لترومب"],
        expected: ["دونالد ترامب", "ترامب"]
    },
    {
        name: "Accord de genre morphosyntaxique Shami (Féminin abstrait)",
        fr: "Cet opportunisme cynique rappelle d'anciennes alliances très controversées du Royaume.",
        forbidden: ["هاد الانتهازية"],
        expected: ["هاي الانتهازية", "هادي الانتهازية"]
    }
];

async function runChatTests() {
    console.log("\n========================================================");
    console.log("🧪 [TEST 1/2] Validation du Module Chat (routes/chat.js)");
    console.log("========================================================");
    let chatPass = true;

    for (const item of sampleExcerpts) {
        process.stdout.write(`  ▶ Test: ${item.name} ... `);
        try {
            const res = await translateChatBidirectional(item.fr);
            const arabic = res.translated_text || '';

            let failed = false;
            let failReason = "";

            // Vérification des termes interdits
            for (const f of item.forbidden) {
                if (arabic.includes(f)) {
                    failed = true;
                    failReason = `Contient terme proscrit: "${f}"`;
                    break;
                }
            }

            // Vérification des termes attendus
            if (!failed && item.expected) {
                const foundAny = item.expected.some(e => arabic.includes(e));
                if (!foundAny) {
                    failed = true;
                    failReason = `Manque un des termes attendus: [${item.expected.join(', ')}]`;
                }
            }

            if (failed) {
                chatPass = false;
                console.log(`❌ ÉCHEC`);
                console.log(`     Source   : ${item.fr}`);
                console.log(`     Résultat : ${arabic}`);
                console.log(`     Raison   : ${failReason}`);
            } else {
                console.log(`✅ SUCCÈS`);
                console.log(`     ➔ "${arabic}"`);
            }
        } catch (err) {
            chatPass = false;
            console.log(`❌ ERREUR: ${err.message}`);
        }
    }

    return chatPass;
}

function runPython(command) {
    const formattedCmd = formatPythonCommand(command);
    return new Promise((resolve, reject) => {
        exec(formattedCmd, { cwd: __dirname, env: process.env }, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

async function runVideoModuleTests() {
    console.log("\n========================================================");
    console.log("🧪 [TEST 2/2] Validation du Moteur Vidéo (Python / translate_fr_to_ar.py)");
    console.log("========================================================");

    const testPythonScript = `
import sys
import json
import os
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except Exception: pass
from dotenv import load_dotenv
load_dotenv()

from translate_fr_to_ar import translate_to_palestinian_arabic
from gemini_translator import VIDEO_LRU_CACHE, gemini_batch_translate_units

# Test 1 : Vérification Cache LRU Mémoire (0 ms)
cached_res = VIDEO_LRU_CACHE.get("Le grand écart", mode="VOAR")
assert cached_res == "اللعب على الحبلين", f"Échec Cache LRU: {cached_res}"
print("✅ Cache LRU Mémoire opérationnel : 'Le grand écart' -> 'اللعب على الحبلين' (0 ms)")

# Test 2 : Discours L'illusion de la solidarité
test_cases = [
    ("L'intervention du Maroc à l'ONU met en lumière une diplomatie du grand écart.", ["النطة الكبيرة", "النطة"], ["اللعب على الحبلين", "حبلين"]),
    ("Face aux destructions, le discours officiel dénonce les forces d'occupation.", ["بتبرأ من", "يتبرأ من"], ["بدين", "تدين", "يدين", "استنكار"]),
    ("Rabat n'hésite pas à cibler et désavouer les factions armées palestiniennes.", ["تتنصل منها", "يتنصل منها"], ["تنزع الشرعية", "سحب الشرعية", "ترفض الاعتراف", "ترفض تأييد"]),
    ("L'allégeance va jusqu'à baptiser une voie rapide marocaine au nom de Donald Trump.", ["دونالد لترومب", "لترومب"], ["دونالد ترامب", "ترامب"]),
    ("Cet opportunisme cynique rappelle d'anciennes alliances très controversées du Royaume.", ["هاد الانتهازية"], ["هاي الانتهازية", "هادي الانتهازية"])
]

all_ok = True
for name, forbidden, expected in test_cases:
    ar_res = translate_to_palestinian_arabic(name)
    err = None
    for f in forbidden:
        if f in ar_res:
            err = f"Contient terme interdit: '{f}'"
            break
    if not err and not any(e in ar_res for e in expected):
        err = f"Manque terme attendu parmi {expected}"
    
    if err:
        print(f"❌ Python Échec: {name} -> {ar_res} ({err})")
        all_ok = False
    else:
        print(f"✅ Python Succès: '{name}' -> '{ar_res}'")

if not all_ok:
    sys.exit(1)
print("ALL_PYTHON_TESTS_PASSED")
`;

    const tmpPyPath = path.join(__dirname, 'temp_test_shami.py');
    const fs = require('fs');
    fs.writeFileSync(tmpPyPath, testPythonScript, 'utf8');

    try {
        const out = await runPython(`python "${tmpPyPath}"`);
        console.log(out);
        return out.includes("ALL_PYTHON_TESTS_PASSED");
    } catch (err) {
        console.error("Erreur Python:", err.message);
        return false;
    } finally {
        if (fs.existsSync(tmpPyPath)) fs.unlinkSync(tmpPyPath);
    }
}

async function main() {
    console.log("🚀 Lancement du Protocole de Vérification Croisée 'Aya Shami Core'...");
    const chatOk = await runChatTests();
    const videoOk = await runVideoModuleTests();

    console.log("\n========================================================");
    console.log("📊 RÉSULTAT DE L'AUDIT CROISÉ");
    console.log("========================================================");
    console.log(`  - Module Chat (/chat-en-direct)        : ${chatOk ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`  - Module Vidéo (/traduction & Python)  : ${videoOk ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);

    if (chatOk && videoOk) {
        console.log("\n🎉 CERTIFICATION VALIDÉE À 100% : Les deux moteurs sont parfaitement unifiés !");
        process.exit(0);
    } else {
        console.error("\n⚠️ Des ajustements sont encore nécessaires.");
        process.exit(1);
    }
}

main();
