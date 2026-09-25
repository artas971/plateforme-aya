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

6. BANNISSEMENT ABSOLU DU JARGON TRANSLITTÉRÉ ET DES PARENTHÈSES MÉTALINGUISTIQUES :
- Il est FORMELLEMENT INTERDIT de translittérer des termes abstraits occidentaux ou d'ajouter des parenthèses d'explication du type "(أو الكلام)" :
  * « Cette rhétorique » ➔ « هاد الخطاب » ou « هاد الحكي » (INTERDICTION ABSOLUE d'écrire « الرتوريكا » !).
  * Aucun mot de jargon occidental calqué (ex: « رتوريكا », « كونسيبت ») n'est toléré. Traduis toujours par le mot arabe vivant naturel.
  * ZÉRO note de traducteur ou parenthèse explicative dans le texte final.

7. FAUX-AMIS DIPLOMATIQUES CRITIQUES (RETENUE vs TRÊVE) :
- Ne confonds JAMAIS la retenue politique avec un cessez-le-feu :
  * « Cette retenue diplomatique » ➔ « هاد التحفظ الدبلوماسي » ou « هاد الحذر الدبلوماسي ».
  * INTERDICTION FORMELLE de traduire par « هاي الهدنة الدبلوماسية » (« هدنة » signifie exclusivement une trêve ou un armistice militaire).

8. EXPRESSIONS POLITIQUES IMAGÉES & CYNISME :
- Ne traduis pas littéralement les métaphores d'impact et de cynisme :
  * « Pèse lourdement sur le nombre de morts » ➔ « كلفت كتير من أرواح الضحايا » (ou « زادت من حصيلة الضحايا » / « أرواح الشهداء » si le contexte local l'exige). INTERDICTION FORMELLE du registre religieux cérémoniel ou grandiloquent type « كان ثمنها غالي من دماء آلاف الشهداء » ! Conserve la rigueur de l'imputation politique chiffrée et froide. L'impact doit découler de la clarté du fait dénoncé, pas de grandiloquence verbale.
  * « Opportunisme cynique » ➔ « الانتهازية عديمة المبادئ » (variante dialectale orale admise : « انتهازية بلا حيا »). BANNISSEMENT STRICT de « وقحة » / « الفجة » (qui relèvent de l'impolitesse ou insolence enfantine et non du machiavélisme d'État) ainsi que de « الساخرة ».
  * Emphase de contraste (« Le Maroc, lui... » / « Quant au Maroc... ») ➔ Employer exclusivement la structure Shami naturelle : « أما النظام المغربي، فهو عم بيسرّع... » (ou « أما المغرب، فهو... ») ou la coordination fluide : « والنظام المغربي عم بيسرّع... ». INTERDICTION FORMELLE ET ABSOLUE de l'hallucination lexicale « المغامر » (qui n'a aucun rapport avec le pronom d'insistance « lui ») !

9. PRÉCISION INSTITUTIONNELLE & DISSOCIATION GÉOPOLITIQUE :
- Selon la charge critique et la précision institutionnelle du texte source, cadrer strictement le terme employé :
  * Pour « Le gouvernement marocain » ➔ « الحكومة المغربية » (el-houkoumeh el-maghribiyyeh).
  * Pour cibler l'appareil d'État / « Le régime marocain » ➔ « النظام المغربي » (en-nizam el-maghribi) ou « نظام المخزن ».
  * Règle : Interdiction des glissements vagues ou non qualifiés. Respecte la distinction stricte entre gouvernement, régime et peuple.
  * Respecte la fraternité sacrée avec les peuples qui soutiennent la Palestine dans la rue.

10. FLUIDITÉ ORALE DES ÉNUMÉRATIONS ET LIAISONS LEVANTINES :
- Dans une liste avec disjonction (« ou » / « أو »), ne place JAMAIS de « و » redondant après une virgule :
  * Écris « إسبانيا، إيرلندا أو إندونيسيا » (JAMAIS « إسبانيا، وإيرلندا أو إندونيسيا »).
- Pour lier un nom défini précédé de « pour cette » / « à cette », utilise la contraction levantine fluide « لهالـ » :
  * « Et la fin de cette diplomatie » ➔ « ونهاية لهالدبلوماسية » (ou « ونهاية لهاي الدبلوماسية »).

11. BANNISSEMENT DES RÉGIONALISMES NON-LEVANTINS (DÉRIVE IRAKIENNE / BÉDOUINE) :
- Interdiction absolue d'utiliser la racine bédouine/irakienne « انطى » ou « ينطي ».
- En Shami palestinien authentique, utilise impérativement pour le don ou le soutien accordé : « انعطى » (donné/accordé) ou « انقدّم » (fourni/offert), et « عطى / يعطي » (JAMAIS « انطى » ni « ينطى »).

12. BLINDAGE DE GENRE GRAMMATICAL & ANTI-TRANSFERT DE LA SOURCE FRANÇAISE :
- Attention absolue au piège des mots féminins en français mais strictement MASCULINS en arabe :
  * « Cette victoire » ➔ « هاد الفوز » (JAMAIS « هاي الفوز » car فوز est masculin !).
  * « Dans cette logique / ce contexte » ➔ « بهاد السياق » ou « بهاد المنطق » (JAMAIS « بهاي السياق » car سياق est masculin !).
  * « Cet accord » ➔ « هاد الاتفاق ».

13. ARBITRAGE DÉSAVOUER UNE FACTION POLITIQUE (ARBITRAGE VALIDÉ 1.B) :
- « Désavouer une faction armée ou politique » ➔ Traduis par « وتتنكر لإلها » (ou « ويتنكر لإلها » / « تنكر لإلها » : rupture morale, reniement franc et désolidarisation ouverte).
- INTERDICTION FORMELLE d'utiliser « يتبرأ منها » ou « تتنصل منها » (contresens complet).

14. PASSIF ORAL NATUREL EN AMMIYA vs LOURDEUR DU PASSIF FUSHA (« يتم ») :
- Au lieu du calque lourd Fusha « يتم تسميته », utilise la forme passée orale Shami : « اتسمّى » ou « تمّت تسميته ».
- Ex: « aucun dirigeant n'est nommé » ➔ « ولا أي مسؤول إسرائيلي اتسمّى بشكل رسمي أو اتحمّل المسؤولية ».

15. INTÉGRITÉ ORTHOGRAPHIQUE ET PHONÉTIQUE DE HAUTE PRÉCISION :
- « الكيان الصهيوني » : Présence OBLIGATOIRE de la lettre « هـ » (JAMAIS « الكيان الصيوني » !).
- « منتخب » (élu) : Écriture exacte avec khâ direct (JAMAIS « منتخاب » avec allongement erroné).

16. ÉRADICATION TOTALE DES RÉSIDUS LATINS / ENCODAGE MIXTE :
- Aucun caractère latin résiduel ne doit subsister dans la sortie arabe :
  * « Brigade Golani » ➔ « لواء غولاني » (INTERDICTION ABSOLUE d'écrire « لواء غولani » !).

17. CORRECTION MORPHOLOGIQUE DU VERBE PRÉTENDRE :
- Rétablir impérativement la consonne ع (ʿayn) avec aspect duratif levantin :
  * « Se voulant / prétendant défendre... » ➔ « عم بتدّعي إنها بتدافع عن الفلسطينيين » (JAMAIS « بتدّي » sans le ʿayn !).

18. COHÉRENCE ANAPHORIQUE DE GENRE INTRA-PROPOSITION :
- Si le sujet de la phrase démarre au masculin (« أما النظام المغربي، فهو... »), maintiens impérativement le masculin jusqu'au point :
  * « وبيدير ضهره » (INTERDICTION FORMELLE du basculement inopiné au féminin « وبتدير ضهرها »).

19. IDIOME PRÉPOSITIONNEL EXACT (« OUVRIR LA PORTE À ») :
- Proscription absolue du calque français « ouvrir la porte devant » :
  * « A ouvert la porte à la normalisation » ➔ « فتح الباب للتطبيع » (JAMAIS « فتح الباب قدام التطبيع »).

20. SYNTAXE DE CONTRASTE & CHUTES ORATOIRES (ARBITRAGES VALIDÉS 2.A & 3.C) :
- Subordonnée de contraste fluide (Zéro « وبينما » orphelin tronqué) :
  * « دول متل إسبانيا، إيرلندا أو إندونيسيا عم بياخدوا مسافة وبراجعوا اتفاقياتهم... أما النظام المغربي، فهو عم بيسرّع تقاربه وبيدير ضهره... ».
- Chute oratoire percutante (Arbitrage 2.A) :
  * « Une question tragique se pose alors pour conclure » ➔ « وبيبقى السؤال اللي بيحرق الضمير: » (BANNISSEMENT ABSOLU de la formule molle « وفي سؤال مأساوي بينطرح »).
- Dénonciation du double jeu politique (Arbitrage 3.C) :
  * « Et la fin de cette diplomatie profondément ambiguë » ➔ « ونهاية لهاد التناقض الدبلوماسي المخزي » (JAMAIS l'adjectif neutre et plat « الغامضة كتير »).
"""

import re

def sanitize_shami_text(text: str) -> str:
    """
    Nettoyeur sémantique et typographique déterministe (Filet de sécurité de 2e ligne).
    Élimine instantanément les coquilles connues et garantit la conformité stricte Shami.
    """
    if not text or not isinstance(text, str):
        return text
    clean = text
    rules = [
        # 1. Encodage mixte latin-arabe & toponymes/brigades
        (r'(?<![\u0600-\u06FF])لواء غولani(?![\u0600-\u06FF])', 'لواء غولاني'),
        (r'(?<![\u0600-\u06FF])غولani(?![\u0600-\u06FF])', 'غولاني'),

        # 2. Coquilles d'entité et typographie
        (r'(?<![\u0600-\u06FF])الكيان الصيوني(?![\u0600-\u06FF])', 'الكيان الصهيوني'),
        (r'(?<![\u0600-\u06FF])الصيوني(?![\u0600-\u06FF])', 'الصهيوني'),
        (r'(?<![\u0600-\u06FF])الصيونية(?![\u0600-\u06FF])', 'الصهيونية'),
        (r'(?<![\u0600-\u06FF])صيوني(?![\u0600-\u06FF])', 'صهيوني'),
        (r'(?<![\u0600-\u06FF])منتخاب(?![\u0600-\u06FF])', 'منتخب'),

        # 3. Morphologie du verbe prétendre (Rétablissement du ʿayn)
        (r'(?<![\u0600-\u06FF])(?:عم\s+)?بتدّي\s+(?:إنها|أنها)\s+(?:بتدافع|دافعت|مدافعة)(?![\u0600-\u06FF])', 'عم بتدّعي إنها بتدافع'),
        (r'(?<![\u0600-\u06FF])(?:عم\s+)?بتدّعي\s+(?:إنها|أنها)\s+دافعت(?![\u0600-\u06FF])', 'عم بتدّعي إنها بتدافع'),
        (r'(?<![\u0600-\u06FF])(?:عم\s+)?بتدّي\s+إنها\s+مدافعة(?![\u0600-\u06FF])', 'عم بتدّعي إنها بتدافع'),
        (r'(?<![\u0600-\u06FF])(?:عم\s+)?بتدّعي\s+إنها\s+مدافعة(?![\u0600-\u06FF])', 'عم بتدّعي إنها بتدافع'),
        (r'(?<![\u0600-\u06FF])(?:عم\s+)?بتدّي\s+(?:أنها|إنها)(?![\u0600-\u06FF])', 'عم بتدّعي إنها'),
        (r'(?<![\u0600-\u06FF])(?:عم\s+)?بتدّي(?![\u0600-\u06FF])', 'عم بتدّعي'),
        (r'(?<![\u0600-\u06FF])عم\s+عم\s+بتدّعي(?![\u0600-\u06FF])', 'عم بتدّعي'),

        # 4. Cohérence anaphorique intra-phrase (Masculin persistant pour le Maroc/régime)
        (r'(?<![\u0600-\u06FF])وبتدير ضهرها(?![\u0600-\u06FF])', 'وبيدير ضهره'),
        (r'(?<![\u0600-\u06FF])بتدير ضهرها(?![\u0600-\u06FF])', 'بيدير ضهره'),

        # 5. Calque prépositionnel (فتح الباب للتطبيع)
        (r'(?<![\u0600-\u06FF])فتح الباب قدام التطبيع(?![\u0600-\u06FF])', 'فتح الباب للتطبيع'),
        (r'(?<![\u0600-\u06FF])فتح الباب قدام(?![\u0600-\u06FF])', 'فتح الباب لـ'),

        # 6. Biais de genre français ➔ arabe
        (r'(?<![\u0600-\u06FF])بهاي السياق(?![\u0600-\u06FF])', 'بهاد السياق'),
        (r'(?<![\u0600-\u06FF])هاي السياق(?![\u0600-\u06FF])', 'هاد السياق'),
        (r'(?<![\u0600-\u06FF])بهاي الفوز(?![\u0600-\u06FF])', 'بهاد الفوز'),
        (r'(?<![\u0600-\u06FF])هاي الفوز(?![\u0600-\u06FF])', 'هاد الفوز'),

        # 7. Dérive dialectale irakienne/bédouine
        (r'(?<![\u0600-\u06FF])اللي انطى(?![\u0600-\u06FF])', 'اللي انقدّم'),
        (r'(?<![\u0600-\u06FF])انطى(?![\u0600-\u06FF])', 'انقدّم'),
        (r'(?<![\u0600-\u06FF])ينطي(?![\u0600-\u06FF])', 'يعطي'),

        # 8. Arbitrage 1.B : Désavouer les factions ➔ وتتنكر لإلها
        (r'(?<![\u0600-\u06FF])ويتبرأ منها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])يتبرأ منها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])وتتبرأ منها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])تتبرأ منها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])وينزع الشرعية عنها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])وتنزع الشرعية عنها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])ويتنكر لها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),
        (r'(?<![\u0600-\u06FF])وتتنكر لها(?![\u0600-\u06FF])', 'وتتنكر لإلها'),

        # 9. Passif lourd Fusha
        (r'(?<![\u0600-\u06FF])يتم تسميته(?![\u0600-\u06FF])', 'اتسمّى'),
        (r'(?<![\u0600-\u06FF])أو تحميله المسؤولية(?![\u0600-\u06FF])', 'أو اتحمّل المسؤولية'),

        # 10. Transittération et jargon
        (r'(?<![\u0600-\u06FF])هاي الرتوريكا(?![\u0600-\u06FF])', 'هاد الخطاب'),
        (r'(?<![\u0600-\u06FF])الرتوريكا(?![\u0600-\u06FF])', 'الخطاب'),
        (r'\s*\(أو الكلام\)', ''),

        # 11. Faux-ami trêve diplomatique
        (r'(?<![\u0600-\u06FF])هاي الهدنة الدبلوماسية(?![\u0600-\u06FF])', 'هاد التحفظ الدبلوماسي'),
        (r'(?<![\u0600-\u06FF])الهدنة الدبلوماسية(?![\u0600-\u06FF])', 'التحفظ الدبلوماسي'),

        # 12. Calque grand écart
        (r'(?<![\u0600-\u06FF])النطة الكبيرة(?![\u0600-\u06FF])', 'اللعب على الحبلين'),
        (r'(?<![\u0600-\u06FF])النطّة الكبيرة(?![\u0600-\u06FF])', 'اللعب على الحبلين'),

        # 13. Noms propres
        (r'(?<![\u0600-\u06FF])دونالد لترومب(?![\u0600-\u06FF])', 'دونالد ترامب'),
        (r'(?<![\u0600-\u06FF])لترومب(?![\u0600-\u06FF])', 'ترامب'),

        # 14. Énumération fluide
        (r'،\s*وإيرلندا(?=[\s،]|$)', '، إيرلندا'),

        # 15. Éradication de l'hallucination "المغامر" & Emphase de contraste ("Le Maroc, lui...")
        (r'(?<![\u0600-\u06FF])المغامر المغربي،?\s*(فهو)?', 'أما النظام المغربي، فهو'),
        (r'(?<![\u0600-\u06FF])المغامر عم بيسرّع(?![\u0600-\u06FF])', 'أما النظام المغربي، فهو عم بيسرّع'),
        (r'(?<![\u0600-\u06FF])المغرب،?\s*المغامر(?![\u0600-\u06FF])', 'أما النظام المغربي، فهو'),
        (r'(?<![\u0600-\u06FF])المغرب المغامر(?![\u0600-\u06FF])', 'أما النظام المغربي، فهو'),
        (r'(?<![\u0600-\u06FF])المغرب،?\s*هو\s*عم\s*بيسرّع(?![\u0600-\u06FF])', 'أما النظام المغربي، فهو عم بيسرّع'),
        (r'(?<![\u0600-\u06FF])المغرب،?\s*لهاد\s*عم\s*بيسرّع(?![\u0600-\u06FF])', 'أما النظام المغربي، فهو عم بيسرّع'),
        (r'(?<![\u0600-\u06FF])النظام المغربي عم بيسرّع تقاربه(?![\u0600-\u06FF])', 'أما النظام المغربي، فهو عم بيسرّع تقاربه'),

        # 16. Opportunisme cynique : bannissement de "وقحة" et "الفجة" ➔ "عديمة المبادئ"
        (r'(?<![\u0600-\u06FF])هاي الانتهازية الوقحة(?![\u0600-\u06FF])', 'هاي الانتهازية عديمة المبادئ'),
        (r'(?<![\u0600-\u06FF])هاي الانتهازية الفجة(?![\u0600-\u06FF])', 'هاي الانتهازية عديمة المبادئ'),
        (r'(?<![\u0600-\u06FF])الانتهازية الوقحة(?![\u0600-\u06FF])', 'الانتهازية عديمة المبادئ'),
        (r'(?<![\u0600-\u06FF])الانتهازية الفجة(?![\u0600-\u06FF])', 'الانتهازية عديمة المبادئ'),
        (r'(?<![\u0600-\u06FF])انتهازية وقحة(?![\u0600-\u06FF])', 'انتهازية عديمة المبادئ'),
        (r'(?<![\u0600-\u06FF])انتهازية فجة(?![\u0600-\u06FF])', 'انتهازية عديمة المبادئ'),
        (r'،?\s*وبكل وقاحة،?\s*', ' '),

        # 17. Neutralité analytique : Bilan humain froid sans emphase religieuse grandiloquente
        (r'(?<![\u0600-\u06FF])كان ثمنها غالي من دماء آلاف الشهداء(?![\u0600-\u06FF])', 'كلفت كتير من أرواح الضحايا'),
        (r'(?<![\u0600-\u06FF])كان ثمنها غالي من دماء الشهداء(?![\u0600-\u06FF])', 'كلفت كتير من أرواح الضحايا'),
        (r'(?<![\u0600-\u06FF])كان ثمنها غالي من دماء الضحايا(?![\u0600-\u06FF])', 'كلفت كتير من أرواح الضحايا'),
        (r'(?<![\u0600-\u06FF])ثمنها غالي من دماء(?![\u0600-\u06FF])', 'كلفت كتير من أرواح الضحايا'),

        # 18. Précision institutionnelle : "Le gouvernement marocain" ➔ الحكومة المغربية
        (r'(?<![\u0600-\u06FF])هل النظام المغربي مستعد يكون إيديه(?![\u0600-\u06FF])', 'هل الحكومة المغربية مستعدة تكون إيديها'),
        (r'(?<![\u0600-\u06FF])هل النظام المغربي مستعد تكون إيديه(?![\u0600-\u06FF])', 'هل الحكومة المغربية مستعدة تكون إيديها'),
        (r'(?<![\u0600-\u06FF])هل النظام المغربي مستعد(?![\u0600-\u06FF])', 'هل الحكومة المغربية مستعدة'),

        # 19. Arbitrage 3.C : Diplomatie profondément ambiguë ➔ ونهاية لهاد التناقض الدبلوماسي المخزي
        (r'(?<![\u0600-\u06FF])(?:وننتهي|ونهاية)\s*(?:لهاي|لهاد|لهالـ?|لهال)?\s*الدبلوماسية\s*(?:الغامضة كتير|المليانة غموض)?(?![\u0600-\u06FF])', 'ونهاية لهاد التناقض الدبلوماسي المخزي'),
        (r'(?<![\u0600-\u06FF])ونهاية\s*لهالدبلوماسية\s*(?:الغامضة كتير|المليانة غموض)?(?![\u0600-\u06FF])', 'ونهاية لهاد التناقض الدبلوماسي المخزي'),
        (r'(?<![\u0600-\u06FF])لهاد التناقض الدبلوماسي المخزي\s*الغامضة كتير(?![\u0600-\u06FF])', 'لهاد التناقض الدبلوماسي المخزي'),

        # 20. Arbitrage 2.A : Chute oratoire ➔ وبيبقى السؤال اللي بيحرق الضمير:
        (r'(?<![\u0600-\u06FF])(?:وفي|في)?\s*سؤال مأساوي بينطرح(?:\s*بالنهاية|\s*للختام)?:?(?![\u0600-\u06FF])', 'وبيبقى السؤال اللي بيحرق الضمير:'),
        (r'(?<![\u0600-\u06FF])وفي\s+وبيبقى السؤال', 'وبيبقى السؤال'),
    ]
    for pattern, replacement in rules:
        clean = re.sub(pattern, replacement, clean)
    return clean

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
