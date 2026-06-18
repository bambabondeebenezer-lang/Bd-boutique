// ============================================================
// API AUTH — POST /api/auth/login, /api/auth/logout, /api/auth/changer-mdp
// ============================================================

const { tenterConnexion, detruireSession, changerMotDePasse, verifierSession } = require('../middleware/auth');
const { nettoyerTexte } = require('../utils/http');
const { db } = require('../db/database');

function login(req, res, repondreJSON, corps) {
  const identifiant = nettoyerTexte(corps.user || corps.identifiant);
  const motDePasse = corps.pass || corps.motDePasse || '';

  if (!identifiant || !motDePasse) {
    return repondreJSON(res, 400, { erreur: 'Identifiant et mot de passe requis.' });
  }

  const resultat = tenterConnexion(identifiant, motDePasse);

  if (!resultat.ok) {
    if (resultat.code === 'BLOQUE') {
      return repondreJSON(res, 429, {
        erreur: `Trop de tentatives échouées. Réessayez dans ${resultat.minutesRestantes} minute(s).`,
      });
    }
    return repondreJSON(res, 401, { erreur: 'Identifiant ou mot de passe incorrect.' });
  }

  repondreJSON(res, 200, { ok: true, token: resultat.token });
}

function logout(req, res, repondreJSON, token) {
  if (token) detruireSession(token);
  repondreJSON(res, 200, { ok: true });
}

function changerMdp(req, res, repondreJSON, token, corps) {
  const session = verifierSession(token);
  if (!session) return repondreJSON(res, 401, { erreur: 'Session invalide ou expirée.' });

  const ancienMdp = corps.ancienMotDePasse || '';
  const nouveauMdp = corps.nouveauMotDePasse || '';

  const resultat = changerMotDePasse(session.admin_id, ancienMdp, nouveauMdp);
  if (!resultat.ok) {
    const messages = {
      ANCIEN_MDP_INCORRECT: 'Ancien mot de passe incorrect.',
      NOUVEAU_MDP_TROP_COURT: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      ADMIN_INTROUVABLE: 'Compte administrateur introuvable.',
    };
    return repondreJSON(res, 400, { erreur: messages[resultat.code] || 'Erreur inconnue.' });
  }

  repondreJSON(res, 200, { ok: true, message: 'Mot de passe changé avec succès.' });
}

function verifier(req, res, repondreJSON, token) {
  const session = verifierSession(token);
  repondreJSON(res, 200, { authentifie: !!session });
}

module.exports = { login, logout, changerMdp, verifier };
