// ============================================================
// API PARAMÈTRES — GET /api/parametres, PUT /api/parametres (admin)
// ============================================================

const { db } = require('../db/database');
const { nettoyerTexte } = require('../utils/http');

function listerParametres(req, res, repondreJSON) {
  const lignes = db.prepare('SELECT * FROM parametres').all();
  const obj = {};
  for (const l of lignes) obj[l.cle] = l.valeur;
  repondreJSON(res, 200, obj);
}

function modifierParametres(req, res, repondreJSON, corps) {
  const cleAutorisees = [
    'whatsapp', 'wave', 'storeName', 'slogan',
    'contactPhoneDisplay', 'contactEmail', 'contactAddress',
  ];
  const upsert = db.prepare(`
    INSERT INTO parametres (cle, valeur) VALUES (?, ?)
    ON CONFLICT(cle) DO UPDATE SET valeur = ?
  `);

  for (const cle of cleAutorisees) {
    if (corps[cle] !== undefined) {
      const valeur = nettoyerTexte(corps[cle]);
      upsert.run(cle, valeur, valeur);
    }
  }

  const lignes = db.prepare('SELECT * FROM parametres').all();
  const obj = {};
  for (const l of lignes) obj[l.cle] = l.valeur;
  repondreJSON(res, 200, obj);
}

module.exports = { listerParametres, modifierParametres };
