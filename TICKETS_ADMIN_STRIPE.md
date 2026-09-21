# 📋 TICKETS ADMINISTRATIFS & FISCAUX : DÉMARRAGE COMMERCIAL STRIPE
**Plateforme Aya Studio — Cadre Légal Micro-Entreprise (France)**

---

## 📌 Contexte & Principes Légaux
* **Règle du SIREN Unique** : En France, une personne physique ne peut avoir qu'un **seul numéro SIREN**, même si elle exerce plusieurs activités distinctes sous le statut d'auto-entrepreneur.
* **Activité d'origine** : Import-Export (Achat-Revente / Vente de marchandises).
* **Nouvelle activité** : Aya Studio (Édition de logiciel SaaS, monétisation par packs de crédits et prestations de sous-titrage/traduction IA).

Ce document constitue votre feuille de route administrative pour exploiter légalement Stripe en production sans créer de nouvelle société.

---

## 🎫 TICKET ADMIN-1 : Mise à jour INPI (Guichet Unique)
**Objectif** : Ajouter l'activité d'édition de logiciel / services web en tant qu'activité secondaire sur votre SIREN existant.

### 1.1. Accès au Guichet Unique
1. Rendez-vous sur le portail officiel de l'INPI : **[formalites.entreprises.gouv.fr](https://formalites.entreprises.gouv.fr)**.
2. Connectez-vous via **FranceConnect+** (avec l'Identité Numérique La Poste).

### 1.2. Déclaration d'adjonction d'activité
1. Dans votre espace, cliquez sur : **"Déposer une formalité de modification d'entreprise"**.
2. Recherchez votre entreprise avec votre **numéro SIREN (9 chiffres)**.
3. Allez dans la section **"Activités de l'entreprise"** > Cliquez sur **"Ajouter une nouvelle activité"**.
4. Remplissez les champs de la façon suivante :
   * **Nature de l'activité** : *Prestations de services informatiques / Édition de logiciels en ligne*.
   * **Description précise** : *« Développement, exploitation d'une plateforme SaaS de traduction et sous-titrage automatisé par intelligence artificielle, vente de crédits d'utilisation en ligne. »*
   * **Catégorie d'activité visée** : *Édition de logiciels applicatifs (Code APE indicatif : 58.29C ou 62.01Z)*.
   * **Statut de l'activité** : **Activité secondaire** (⚠️ *Ne cochez pas activité principale pour conserver votre activité d'import-export intacte*).
   * **Date d'effet** : Indiquez la date prévue de lancement commercial (ex: *26 septembre 2026*).
5. **Validation et Signature** :
   * Téléversez votre justificatif d'identité si demandé.
   * Signez la formalité par voie électronique.
   * *Coût de la démarche* : Généralement **0 €** (formalité gratuite sur le Guichet Unique pour simple adjonction).

---

## 🎫 TICKET ADMIN-2 : Configuration Stripe Production
**Objectif** : Activer le compte Stripe en "Mode Live" et configurer le libellé bancaire client pour éviter les rejets et contestations (chargebacks).

### 2.1. Déclaration de l'entité juridique dans Stripe
1. Connectez-vous sur le dashboard **[Stripe](https://dashboard.stripe.com)**.
2. Allez dans **Paramètres** (roue crantée) > **Informations sur l'entreprise** (*Business details*) :
   * **Structure juridique** : Sélectionnez *Entreprise individuelle* (*Sole Proprietorship* / *Auto-entrepreneur*).
   * **Numéro d'immatriculation** : Saisissez votre numéro **SIREN (9 chiffres)** ou **SIRET (14 chiffres)**.
   * **Raison sociale légale** : Votre **Nom et Prénom** (ex: *Jean DUPONT* — requis par les contrôles bancaires d'identité KYC).
   * **Nom commercial public** : **Aya Studio**.
   * **Site Web** : `https://votre-domaine.com`.

---

### 2.2. Modification CRUCIALE du Libellé Bancaire (Statement Descriptor)
> [!CAUTION]
> **Risque de Chargeback (Litige Bancaire)** : Si un utilisateur achète un pack de crédits sur Aya Studio et voit apparaître sur son relevé bancaire le nom de votre société d'import-export, il pensera à une fraude bancaire et fera immédiatement opposition auprès de sa banque. Chaque contestation entraîne une **pénalité forfaitaire de 15 € facturée par Stripe** !

Dans **Paramètres** > **Paramètres publics** (*Public details*) :

1. **Libellé de relevé bancaire (Statement Descriptor)** :
   * Indiquez : `AYA STUDIO` *(entre 5 et 22 caractères, majuscules recommandées)*.
2. **Libellé abrégé (Shortened Descriptor)** :
   * Indiquez : `AYA` *(pour les banques ayant un affichage restreint)*.
3. **Numéro de téléphone et E-mail de support client** :
   * Renseignez une adresse e-mail dédiée : `contact@votre-domaine.com` ou `support@votre-domaine.com`.
   * L'URL de support : `https://votre-domaine.com`.

---

## 🎫 TICKET ADMIN-3 : Déclaration URSSAF & Comptabilité Séparée
**Objectif** : Appliquer les taux de cotisations corrects lors des déclarations mensuelles/trimestrielles sur le site de l'URSSAF.

### 3.1. Règles de ventilation du Chiffre d'Affaires (Activité Mixte)
En tant qu'auto-entrepreneur exerçant une activité mixte, vous devez ventiler vos recettes dans deux catégories distinctes lors de votre déclaration sur **[autoentrepreneur.urssaf.fr](https://www.autoentrepreneur.urssaf.fr)** :

| Activité | Type d'encaissement | Catégorie Déclaration URSSAF | Taux Cotisations Sociales | Plafond Annuel de CA |
| :--- | :--- | :--- | :---: | :---: |
| **Activité 1 : Import-Export** | Vente de marchandises physiques | **Vente de marchandises (BIC)** | **~12,3 %** | **188 700 €** |
| **Activité 2 : Aya Studio** | Vente de packs de crédits / Abonnements SaaS | **Prestations de services commerciales ou intellectuelles** | **~21,2 %** | **77 700 €** *(au sein du plafond global de 188 700 €)* |

---

### 3.2. Règles Pratiques de Gestion Comptable
1. **Livre des Recettes Séparé** :
   * Tenez un tableau Excel/registre séparé ou deux colonnes claires pour identifier la provenance de chaque euro :
     * *Colonne A* : Réf Facture Import-Export / Virement reçu.
     * *Colonne B* : Réf Transaction Stripe Aya Studio (ID `ch_...` ou `cs_...`).
2. **Mention obligatoire sur les factures Stripe** (Franchise en base de TVA) :
   * Tant que votre chiffre d'affaires reste sous les seuils de TVA (36 800 € pour les services), configurez Stripe Invoicing pour mentionner :
     > *« TVA non applicable, article 293 B du CGI »*.
3. **Date de Déclaration** :
   * Déclarez le CA encaissé réel (somme nette avant commission Stripe ou somme brute selon l'option choisie, la règle fiscale stricte retenant le CA brut payé par le client).

---

## 🏁 CHECK-LIST DE PASSAGE EN "MODE LIVE" STRIPE

- [ ] **INPI** : Déclaration d'adjonction d'activité secondaire enregistrée sur le Guichet Unique.
- [ ] **Stripe Identity** : Pièce d'identité et justificatif de domicile validés sur le Dashboard Stripe.
- [ ] **Stripe SIRET** : Numéro SIREN/SIRET renseigné dans les informations d'entreprise.
- [ ] **Libellé Bancaire** : Champ *Statement Descriptor* réglé sur `AYA STUDIO`.
- [ ] **IBAN de reversement** : Compte bancaire dédié à l'activité auto-entrepreneur associé pour les virements de Stripe.
- [ ] **Facturation & Mentions** : Mentions légales et CGV publiées sur le site avec renvoi aux conditions de vente des crédits.

---
*Document généré le 22/09/2026 — Conservé à la racine de votre espace de travail : [`TICKETS_ADMIN_STRIPE.md`](file:///c:/Users/artas/Desktop/aya/TICKETS_ADMIN_STRIPE.md).*
