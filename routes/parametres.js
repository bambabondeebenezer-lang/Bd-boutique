const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { repondreJSON, repondreErreur } = require('../utils/http');
const { verifierAuth } = require('../middleware/auth');

// GET /api/parametres
// Renvoie les paramètres publics de la boutique (visible par tous les visiteurs)
router.get('/', (req, res) => {
  try {
    const lignes = db.prepare('SELECT cle, valeur FROM parametres').all();

    const parametres = {};
    for (const ligne of lignes) {
      parametres[ligne.cle] = ligne.valeur;
    }

    return repondreJSON(res, 200, parametres);
  } catch (e) {
    return repondreErreur(res, 500, 'Erreur lors de la lecture des paramètres');
  }
});

// PUT /api/parametres
// Met à jour un ou plusieurs paramètres (réservé à l'administrateur connecté)
router.put('/', verifierAuth, (req, res) => {
  try {
    const nouveauxParametres = req.body;

    if (!nouveauxParametres || typeof nouveauxParametres !== 'object') {
      return repondreErreur(res, 400, 'Données invalides');
    }

    const cles = Object.keys(nouveauxParametres);

    if (cles.length === 0) {
      return repondreErreur(res, 400, 'Aucun paramètre fourni');
    }

    const requete = db.prepare(
      'INSERT INTO parametres (cle, valeur) VALUES (?, ?) ' +
      'ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur'
    );

    for (const cle of cles) {
      const valeur = nouveauxParametres[cle];
      requete.run(cle, String(valeur));
    }

    return repondreJSON(res, 200, { succes: true });
  } catch (e) {
    return repondreErreur(res, 400, 'Données invalides');
  }
});

module.exports = router;
