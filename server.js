// ============================================================
// BD BOUTIQUE — SERVEUR (Node.js natif, zéro dépendance externe)
// ============================================================
// Lancement : node server.js
// Aucun npm install nécessaire (http, sqlite, crypto, fs sont natifs à Node).
// ============================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const { envoyerJSON, lireBodyJSON, recupererToken } = require('./utils/http');
const { verifierSession } = require('./middleware/auth');
const { limiterDebit } = require('./middleware/rateLimit');

const produitsCtrl = require('./routes/produits');
const commandesCtrl = require('./routes/commandes');
const paiementsCtrl = require('./routes/paiements');
const authCtrl = require('./routes/auth');
const parametresCtrl = require('./routes/parametres');

const PORT = process.env.PORT || 3000;
const DOSSIER_PUBLIC = path.join(__dirname, 'public');

const verifierDebitEcriture = limiterDebit({ maxRequetes: 15, fenetreMs: 60_000 }); // anti-spam commandes/login
const verifierDebitLecture = limiterDebit({ maxRequetes: 120, fenetreMs: 60_000 });

// ------------------------------------------------------------
// Middleware d'authentification admin : exige un token de session valide
// ------------------------------------------------------------
function exigerAdmin(req, res) {
  const token = recupererToken(req);
  const session = verifierSession(token);
  if (!session) {
    envoyerJSON(res, 401, { erreur: 'Authentification administrateur requise.' });
    return null;
  }
  return session;
}

// ------------------------------------------------------------
// Sert les fichiers statiques (le front-end HTML/CSS/JS)
// ------------------------------------------------------------
const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function servirFichierStatique(req, res, cheminUrl) {
  let cheminRelatif = cheminUrl === '/' ? '/index.html' : cheminUrl;
  const cheminAbsolu = path.normalize(path.join(DOSSIER_PUBLIC, cheminRelatif));

  // Empêche la traversée de répertoire (../../etc/passwd etc.)
  if (!cheminAbsolu.startsWith(DOSSIER_PUBLIC)) {
    res.writeHead(403);
    return res.end('Accès interdit');
  }

  fs.readFile(cheminAbsolu, (err, contenu) => {
    if (err) {
      // Fallback SPA : toute route inconnue renvoie index.html
      const indexPath = path.join(DOSSIER_PUBLIC, 'index.html');
      fs.readFile(indexPath, (err2, contenuIndex) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Page introuvable');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(contenuIndex);
      });
      return;
    }
    const ext = path.extname(cheminAbsolu);
    res.writeHead(200, { 'Content-Type': TYPES_MIME[ext] || 'application/octet-stream' });
    res.end(contenu);
  });
}

// ------------------------------------------------------------
// Routeur API
// ------------------------------------------------------------
async function routerAPI(req, res, chemin, ip) {
  const segments = chemin.split('/').filter(Boolean); // ['api', 'produits', ':id']
  const methode = req.method;

  // ---------- AUTH ----------
  if (segments[1] === 'auth') {
    if (segments[2] === 'login' && methode === 'POST') {
      if (!verifierDebitEcriture(ip)) return envoyerJSON(res, 429, { erreur: 'Trop de requêtes, réessayez plus tard.' });
      const corps = await lireBodyJSON(req);
      return authCtrl.login(req, res, envoyerJSON, corps);
    }
    if (segments[2] === 'logout' && methode === 'POST') {
      return authCtrl.logout(req, res, envoyerJSON, recupererToken(req));
    }
    if (segments[2] === 'changer-mdp' && methode === 'POST') {
      const corps = await lireBodyJSON(req);
      return authCtrl.changerMdp(req, res, envoyerJSON, recupererToken(req), corps);
    }
    if (segments[2] === 'verifier' && methode === 'GET') {
      return authCtrl.verifier(req, res, envoyerJSON, recupererToken(req));
    }
    return envoyerJSON(res, 404, { erreur: 'Route inconnue.' });
  }

  // ---------- PRODUITS ----------
  if (segments[1] === 'produits') {
    const id = segments[2];

    if (methode === 'GET' && !id) {
      if (!verifierDebitLecture(ip)) return envoyerJSON(res, 429, { erreur: 'Trop de requêtes.' });
      return produitsCtrl.listerProduits(req, res, envoyerJSON);
    }
    if (methode === 'GET' && id) {
      return produitsCtrl.obtenirProduit(req, res, envoyerJSON, id);
    }
    if (methode === 'POST' && !id) {
      if (!exigerAdmin(req, res)) return;
      const corps = await lireBodyJSON(req);
      return produitsCtrl.creerProduit(req, res, envoyerJSON, corps);
    }
    if (methode === 'PUT' && id) {
      if (!exigerAdmin(req, res)) return;
      const corps = await lireBodyJSON(req);
      return produitsCtrl.modifierProduit(req, res, envoyerJSON, id, corps);
    }
    if (methode === 'DELETE' && id) {
      if (!exigerAdmin(req, res)) return;
      return produitsCtrl.supprimerProduit(req, res, envoyerJSON, id);
    }
    return envoyerJSON(res, 404, { erreur: 'Route inconnue.' });
  }

  // ---------- COMMANDES ----------
  if (segments[1] === 'commandes') {
    const id = segments[2];

    if (methode === 'GET' && !id) {
      if (!exigerAdmin(req, res)) return;
      return commandesCtrl.listerCommandes(req, res, envoyerJSON);
    }
    if (methode === 'GET' && id) {
      if (!exigerAdmin(req, res)) return;
      return commandesCtrl.obtenirCommande(req, res, envoyerJSON, id);
    }
    if (methode === 'POST' && !id) {
      if (!verifierDebitEcriture(ip)) return envoyerJSON(res, 429, { erreur: 'Trop de commandes envoyées, réessayez dans une minute.' });
      const corps = await lireBodyJSON(req);
      return commandesCtrl.creerCommande(req, res, envoyerJSON, corps);
    }
    if (methode === 'PUT' && id) {
      if (!exigerAdmin(req, res)) return;
      const corps = await lireBodyJSON(req);
      return commandesCtrl.modifierStatutCommande(req, res, envoyerJSON, id, corps);
    }
    return envoyerJSON(res, 404, { erreur: 'Route inconnue.' });
  }

  // ---------- PAIEMENTS ----------
  if (segments[1] === 'paiements') {
    if (methode === 'GET') {
      if (!exigerAdmin(req, res)) return;
      return paiementsCtrl.listerPaiements(req, res, envoyerJSON);
    }
    return envoyerJSON(res, 404, { erreur: 'Route inconnue.' });
  }

  // ---------- PARAMÈTRES ----------
  if (segments[1] === 'parametres') {
    if (methode === 'GET') {
      return parametresCtrl.listerParametres(req, res, envoyerJSON);
    }
    if (methode === 'PUT') {
      if (!exigerAdmin(req, res)) return;
      const corps = await lireBodyJSON(req);
      return parametresCtrl.modifierParametres(req, res, envoyerJSON, corps);
    }
    return envoyerJSON(res, 404, { erreur: 'Route inconnue.' });
  }

  return envoyerJSON(res, 404, { erreur: 'Route API inconnue.' });
}

// ------------------------------------------------------------
// SERVEUR HTTP
// ------------------------------------------------------------
const serveur = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);
  const ip = req.socket.remoteAddress || 'inconnu';

  // En-têtes de sécurité de base
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CORS — autorise les appels depuis le même site (et permissif en dev,
  // à restreindre à votre domaine une fois en production, voir CONFIGURATION.md)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (pathname.startsWith('/api/')) {
      await routerAPI(req, res, pathname, ip);
    } else {
      servirFichierStatique(req, res, pathname);
    }
  } catch (err) {
    if (err.message === 'PAYLOAD_TROP_GRAND') {
      return envoyerJSON(res, 413, { erreur: 'Requête trop volumineuse.' });
    }
    if (err.message === 'JSON_INVALIDE') {
      return envoyerJSON(res, 400, { erreur: 'Corps de requête JSON invalide.' });
    }
    console.error('Erreur serveur :', err);
    envoyerJSON(res, 500, { erreur: 'Erreur interne du serveur.' });
  }
});

serveur.listen(PORT, () => {
  console.log(`\n🚀 BD Boutique — serveur démarré sur http://localhost:${PORT}`);
  console.log(`   API disponible sur http://localhost:${PORT}/api/...`);
  console.log(`   Site disponible sur http://localhost:${PORT}/\n`);
});
