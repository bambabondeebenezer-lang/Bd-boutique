// ============================================================
// AUTHENTIFICATION ADMIN — sessions + anti brute-force
// ============================================================

const crypto = require('node:crypto');
const { db, hashPassword } = require('../db/database');

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 heures
const MAX_TENTATIVES = 5;
const BLOCAGE_DUREE_MS = 1000 * 60 * 15; // 15 minutes

// ------------------------------------------------------------
// Vérifie si un identifiant est actuellement bloqué (anti brute-force)
// ------------------------------------------------------------
function estBloque(identifiant) {
  const row = db.prepare('SELECT * FROM tentatives_connexion WHERE identifiant = ?').get(identifiant);
  if (!row || !row.bloque_jusqu_a) return false;
  return new Date(row.bloque_jusqu_a) > new Date();
}

function tempsRestantBlocage(identifiant) {
  const row = db.prepare('SELECT * FROM tentatives_connexion WHERE identifiant = ?').get(identifiant);
  if (!row || !row.bloque_jusqu_a) return 0;
  const restant = new Date(row.bloque_jusqu_a).getTime() - Date.now();
  return Math.max(0, Math.ceil(restant / 1000 / 60)); // en minutes
}

function enregistrerEchec(identifiant) {
  const row = db.prepare('SELECT * FROM tentatives_connexion WHERE identifiant = ?').get(identifiant);
  const nb = (row?.nb_echecs || 0) + 1;
  const bloque = nb >= MAX_TENTATIVES
    ? new Date(Date.now() + BLOCAGE_DUREE_MS).toISOString()
    : null;

  db.prepare(`
    INSERT INTO tentatives_connexion (identifiant, nb_echecs, bloque_jusqu_a)
    VALUES (?, ?, ?)
    ON CONFLICT(identifiant) DO UPDATE SET nb_echecs = ?, bloque_jusqu_a = ?
  `).run(identifiant, nb, bloque, nb, bloque);
}

function reinitialiserEchecs(identifiant) {
  db.prepare('DELETE FROM tentatives_connexion WHERE identifiant = ?').run(identifiant);
}

// ------------------------------------------------------------
// Tentative de connexion
// ------------------------------------------------------------
function tenterConnexion(identifiant, motDePasse) {
  if (estBloque(identifiant)) {
    return { ok: false, code: 'BLOQUE', minutesRestantes: tempsRestantBlocage(identifiant) };
  }

  const admin = db.prepare('SELECT * FROM administrateurs WHERE identifiant = ?').get(identifiant);
  if (!admin) {
    enregistrerEchec(identifiant);
    return { ok: false, code: 'IDENTIFIANTS_INVALIDES' };
  }

  const hashCalcule = hashPassword(motDePasse, admin.sel);
  const valide = crypto.timingSafeEqual(
    Buffer.from(hashCalcule, 'hex'),
    Buffer.from(admin.mot_de_passe_hash, 'hex')
  );

  if (!valide) {
    enregistrerEchec(identifiant);
    return { ok: false, code: 'IDENTIFIANTS_INVALIDES' };
  }

  reinitialiserEchecs(identifiant);
  db.prepare('UPDATE administrateurs SET derniere_connexion = ? WHERE id = ?')
    .run(new Date().toISOString(), admin.id);

  const token = creerSession(admin.id);
  return { ok: true, token };
}

function creerSession(adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  const maintenant = new Date();
  const expiration = new Date(maintenant.getTime() + SESSION_DURATION_MS);
  db.prepare(`
    INSERT INTO sessions (token, admin_id, date_creation, date_expiration)
    VALUES (?, ?, ?, ?)
  `).run(token, adminId, maintenant.toISOString(), expiration.toISOString());
  return token;
}

function verifierSession(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.date_expiration) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return session;
}

function detruireSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function changerMotDePasse(adminId, ancienMdp, nouveauMdp) {
  const admin = db.prepare('SELECT * FROM administrateurs WHERE id = ?').get(adminId);
  if (!admin) return { ok: false, code: 'ADMIN_INTROUVABLE' };

  const hashAncien = hashPassword(ancienMdp, admin.sel);
  const valide = crypto.timingSafeEqual(
    Buffer.from(hashAncien, 'hex'),
    Buffer.from(admin.mot_de_passe_hash, 'hex')
  );
  if (!valide) return { ok: false, code: 'ANCIEN_MDP_INCORRECT' };

  if (!nouveauMdp || nouveauMdp.length < 8) {
    return { ok: false, code: 'NOUVEAU_MDP_TROP_COURT' };
  }

  const nouveauSel = crypto.randomBytes(16).toString('hex');
  const nouveauHash = hashPassword(nouveauMdp, nouveauSel);
  db.prepare('UPDATE administrateurs SET mot_de_passe_hash = ?, sel = ? WHERE id = ?')
    .run(nouveauHash, nouveauSel, adminId);

  return { ok: true };
}

module.exports = {
  tenterConnexion,
  verifierSession,
  detruireSession,
  changerMotDePasse,
};
