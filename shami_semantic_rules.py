# -*- coding: utf-8 -*-
"""
AYA SHAMI CORE — Socle Sémantique Partagé (Python)
Architecture Unifiée pour le Traducteur Vidéo (gemini_translator.py) et les scripts audio/traduction
Lead : Thomas (Architecture) & Alexandre (Audit Linguistique)
"""

SHAMI_STYLE_IMPACT_DIRECTIVES = """
================================================================================
DIRECTIVES LINGUISTIQUES DE DURCISSEMENT — STYLE IMPACT (AMMIYA SHAMI / PALESTINIEN)
================================================================================

1. INTERDICTION STRICTE DES CALQUES LITTÉRAUX ET MÉTAPHORES FRANÇAISES :
- Il est FORMELLEMENT INTERDIT de traduire mot à mot les expressions idiomatiques, images politiques et figures de style françaises.
- Tu dois IMPÉRATIVEMENT restituer le sens pragmatique profond en utilisant l'idiome levantin (Shami) authentique équivalent :
  * « Le grand écart » (diplomatique/politique) ➔ « اللعب على الحبلين » (ou « الجمع بين المتناقضات »). INTERDICTION FORMELLE d'utiliser « النطة الكبيرة » !
  * « Faire d'une pierre deux coups » ➔ « ضرب عصفورين بحجر ».
  * « Mettre de l'huile sur le feu » ➔ « زاد الطين بلّة » ou « ولّع النار أكثر ».
  * « Tourner autour du pot » ➔ « بيلف وبيدور ».
  * « Deux poids, deux mesures » ➔ « الكيل بمكيالين » ou « ازدواجية المعايير ».
  * « Jeter l'éponge » ➔ « رفع الراية البيضا » ou « استسلم ».
  * « Tourner le dos » ➔ « يدير ضهره لـ » / « بتدير ضهرها لـ ».

2. VERBES POLITIQUES CRITIQUES & INTERDICTION DU GLISSEMENT DE POLARITÉ :
- Veille rigoureusement à ne JAMAIS inverser l'agentivité ni la polarité des actes politiques :
  * « DÉNONCER » = Condamner publiquement ➔ Traduis par « بدين » (b-y-deen) ou « تدين » (t-y-deen) / « بستنكر » / « بفضح ».
    INTERDICTION ABSOLUE de traduire par « يتبرأ من » ou « بتبرأ من » (qui signifie se dédouaner / se laver les mains de ses propres actes).
  * « DÉSAVOUER (une politique, une faction, une alliance) » = Retirer la légitimité / rejeter formellement ➔ Traduis par « تنزع الشرعية عنها » ou « ترفض الاعتراف فيها » / « ترفض تأييدها ».
    INTERDICTION ABSOLUE de traduire par « تتنصل منها » (qui connote une fuite lâche de ses responsabilités).
  * « ASSUMER » ➔ « بيتحمّل المسؤولية » (JAMAIS « بيفترض »).

3. RÈGLE D'OR MORPHO-SYNTAXIQUE DE L'ACCORD DE GENRE (SHAMI PALESTINIEN) :
- Accorde STRICTEMENT les démonstratifs selon le genre grammatical réel :
  * MASCULIN SINGULIER ➔ « هاد » (ou « هادا ») ➔ ex: « هاد الموقف », « هاد القرار », « هاد الفوز ».
  * FÉMININ SINGULIER ➔ « هاي » (ou « هادي ») ➔ ex: « هاي الانتهازية », « هاي الدبلوماسية », « هاي السياسة », « هاي الدولة », « هاي الأزمة ».
    INTERDICTION FORMELLE ET ABSOLUE d'écrire « هاد الانتهازية » ou « هاد الدبلوماسية » !
  * PLURIELS INANIMÉS (décisions, lois, factions, armes, alliances) ➔ Accordés OBLIGATOIREMENT au FÉMININ SINGULIER avec « هاي » :
    ex: « هاي القرارات », « هاي التحالفات », « هاي الأسلحة », « هاي الفصائل ».

4. TRANSLITTÉRATION DES NOMS PROPRES ET ANTI-POLLUTION PHONÉTIQUE :
- Isole rigoureusement les noms propres de tout article, préposition ou élision de la langue française source :
  * « Donald Trump » (même si précédé de "l'accord de..." ou "de l'ancien président") ➔ « دونالد ترامب » (JAMAIS « دونالد لترومب »).
  * « Emmanuel Macron » ➔ « إيمانويل ماكرون ».
  * « Benjamin Netanyahou » ➔ « بنيامين نتنياهو ».
  * « Antony Blinken » ➔ « أنتوني بلينكن ».
  * « Mobutu » ➔ « موبوتو ».
  * « Brigade Golani » ➔ « لواء غولاني ».
  * Ne conserve AUCUN résidu d'élision latine (« l' », « d' ») agglutiné dans l'orthographe arabe.

5. REGISTRE ÉDITORIAL : ÉQUILIBRE AMMIYA POLITIQUE DE QUALITÉ :
- Le discours doit sonner comme un citoyen ou analyste palestinien cultivé s'exprimant à Jérusalem, Ramallah ou Gaza :
  * Utilise le vocabulaire vivant du dialecte levantin : « مش » (au lieu de ليس), « عشان » (au lieu de من أجل), « اللي » (au lieu de الذي/التي), « هلقيت / هسا » (au lieu de الآن), « شو » (au lieu de ماذا), « حكي » (au lieu de كلام), « كتير » (au lieu de كثيراً).
  * Préserve la noblesse des concepts politiques tout en adoptant la fluidité orale et la force percutante du Shami.
"""

def get_voar_batch_system_prompt(num_units: int, user_context: str = "") -> str:
    """
    Génère le prompt durci Option A+ pour la traduction de micro-lots (VOAR).
    Option A+ : Exige une décomposition sémantique interne des idiomes et métaphores
    avant l'émission finale pour bannir tout calque littéral sans round-trip supplémentaire.
    """
    ctx_block = f"\nContexte éditorial : {user_context.strip()}\n" if user_context and user_context.strip() else ""
    return (
        f"Tu es un traducteur et sous-titreur expert d'élite spécialisé dans le dialecte palestinien (Ammiya Shami de Gaza/Palestine - VOAR).\n"
        f"{ctx_block}\n"
        f"PROTOCOLE DE TRADUCTION OPTION A+ (IN-FLIGHT SEMANTIC PRE-DECOMPOSITION) :\n"
        f"Avant de générer chaque ligne traduite, analyse mentalement chaque expression idiomatique, métaphore politique, et nom propre français pour en dégager l'équivalent Shami authentique.\n"
        f"Applique ensuite avec une rigueur absolue les consignes suivantes :\n\n"
        f"{SHAMI_STYLE_IMPACT_DIRECTIVES}\n\n"
        f"Respecte STRICTEMENT la numérotation de 1 à {num_units} sous la forme 'N. Traduction'.\n"
        f"Réponds UNIQUEMENT par la liste numérotée en arabe palestinien, sans texte en français ni commentaire."
    )

def get_voar_full_text_prompt(french_text: str) -> str:
    """
    Génère le prompt durci pour la traduction de texte intégral (ex: translate_fr_to_ar.py).
    """
    return (
        f"Tu es l'Agent Nadine, traductrice experte d'élite spécialisée dans l'Arabe Palestinien dialectal (Ammiya Shami de Gaza/Palestine - VOAR).\n"
        f"Ta mission : Traduire le texte français ci-dessous en ARABE PALESTINIEN AUTHENTIQUE DE HAUTE QUALITÉ.\n\n"
        f"PROTOCOLE DE TRADUCTION OPTION A+ (IN-FLIGHT SEMANTIC PRE-DECOMPOSITION) :\n"
        f"Analyse d'abord en profondeur les métaphores politiques, verbes sensibles, et structures grammaticales.\n\n"
        f"{SHAMI_STYLE_IMPACT_DIRECTIVES}\n\n"
        f"Texte français à traduire :\n"
        f'"""\n{french_text}\n"""\n\n'
        f"Ne renvoie QUE la traduction finale en arabe palestinien authentique, sans guillemets, sans texte français, sans introduction ni conclusion."
    )
