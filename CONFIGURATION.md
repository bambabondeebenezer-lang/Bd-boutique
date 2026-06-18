# BD Boutique — Étape 6 : Backend réel (guide de configuration)

Ce dossier contient la version "production" de BD Boutique : un vrai serveur
Node.js, une vraie base de données SQLite, et une vraie authentification
sécurisée pour l'administrateur. Contrairement aux étapes 1 à 5, les données
(produits, commandes, paiements) sont maintenant **partagées entre tous les
visiteurs du site**, et non plus stockées séparément dans le navigateur de
chaque personne.

## 1. Lancer le site en local (pour tester)

Aucune installation n'est nécessaire (`npm install` n'est pas requis : tout
le code utilise uniquement les modules natifs de Node.js).

```bash
node server.js
```

Puis ouvrez votre navigateur sur `http://localhost:3000`.
Pour accéder à l'espace administrateur : `http://localhost:3000/?admin=true`

## 2. ⚠️ CHANGER LE MOT DE PASSE ADMINISTRATEUR (à faire immédiatement)

Au premier démarrage, un compte administrateur est créé automatiquement
avec :
- **Identifiant :** `admin`
- **Mot de passe temporaire :** `ChangeMoiMaintenant!2024`

Ce mot de passe temporaire est visible dans ce fichier et dans le code,
donc **il n'est pas sécurisé**. Vous devez le changer avant de mettre le
site en ligne publiquement. Deux façons de le faire :

### Option A — Depuis l'interface (la plus simple, recommandée)
Connectez-vous à l'espace admin (`/?admin=true`) avec le mot de passe
temporaire ci-dessus, puis allez dans le menu **🔒 Sécurité** (dans la
barre latérale). Renseignez l'ancien mot de passe et le nouveau (8
caractères minimum), validez : c'est fait.

### Option B — Avant le premier démarrage, via une variable d'environnement
Si vous préférez choisir le mot de passe initial vous-même plutôt que de
partir du mot de passe temporaire par défaut :

```bash
BD_ADMIN_INIT_PASS="VotreMotDePasseSolide123" node server.js
```

⚠️ Cette variable n'a d'effet que si la base de données n'existe pas
encore (premier démarrage). Si vous avez déjà lancé le serveur une fois,
supprimez d'abord le fichier `db/bdboutique.db` (cela efface aussi tous
les produits/commandes déjà enregistrés — à utiliser seulement pour les
tests, pas une fois que de vraies commandes existent).

## 3. Ce qui a changé par rapport à la version précédente (étapes 1-5)

| Donnée | Avant (localStorage) | Maintenant (étape 6) |
|---|---|---|
| Produits | Stockés dans le navigateur de chacun | Base SQLite partagée par tous |
| Commandes | Visibles seulement par celui qui les a passées | Centralisées, visibles par l'admin |
| Paiements | Dérivés du statut commande, locaux | Dérivés du statut commande, centralisés |
| Connexion admin | Mot de passe en clair dans le code | Mot de passe haché (PBKDF2), protégé contre le brute-force |
| Panier | localStorage | **Inchangé** — reste localStorage (propre à chaque visiteur, pas besoin de backend) |

Le design, l'apparence et les fonctionnalités visibles du site n'ont pas
changé : seule la façon dont les données sont stockées et partagées a été
refaite pour devenir réelle.

## 4. Structure des fichiers

```
bd-boutique-backend/
├── server.js              ← point d'entrée, démarre le serveur
├── package.json
├── db/
│   ├── database.js        ← création des tables SQLite, hachage des mots de passe
│   └── bdboutique.db      ← (généré automatiquement au premier démarrage)
├── middleware/
│   ├── auth.js             ← sessions, anti brute-force
│   └── rateLimit.js        ← anti-spam sur les routes publiques
├── routes/
│   ├── produits.js
│   ├── commandes.js
│   ├── paiements.js
│   ├── auth.js
│   └── parametres.js
├── utils/
│   └── http.js
└── public/
    └── index.html          ← le site (HTML/CSS/JS), inchangé visuellement
```

## 5. Mettre le site en ligne (hébergement)

Ce code est prêt à tourner, mais **ne se met pas en ligne lui-même** : il
faut choisir un hébergeur capable de faire tourner un serveur Node.js en
continu (contrairement à Netlify ou GitHub Pages, qui ne servent que des
fichiers statiques). Quelques options courantes : Railway, Render, Fly.io,
ou un VPS classique (avec un gestionnaire de processus comme `pm2`).

Une fois un hébergeur choisi, la procédure générale est :
1. Envoyer ce dossier complet sur l'hébergeur (souvent via Git).
2. Définir `BD_ADMIN_INIT_PASS` comme variable d'environnement secrète sur
   l'hébergeur (pour ne pas utiliser le mot de passe par défaut en
   production).
3. Démarrer avec `node server.js`.
4. L'hébergeur vous donnera une adresse publique (ex :
   `https://bd-boutique.up.railway.app`) — c'est le lien à partager.

Le paiement continue de se faire manuellement via WhatsApp, comme convenu :
aucune intégration de paiement en ligne n'a été ajoutée à cette étape.

## 6. Limitations connues de cette version

- Le module `node:sqlite` utilisé est marqué "expérimental" par Node.js
  (cela signifie que son comportement pourrait changer dans une future
  version de Node, pas qu'il est instable aujourd'hui — il a été testé et
  fonctionne correctement).
- Pas d'envoi d'e-mails automatiques (confirmation de commande, etc.) —
  cela n'était pas demandé dans la feuille de route.
- Les photos/vidéos de produits restent des URL externes (pas d'upload de
  fichier direct depuis l'admin) — cela correspond à ce que faisait déjà
  la version précédente.
