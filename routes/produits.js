// ============================================================
// API PRODUITS — GET/POST/PUT/DELETE /api/produits
// ============================================================

const crypto = require('node:crypto');
const { db } = require('../db/database');
const { nettoyerTexte, estUrlValide } = require('../utils/http');

function ligneVersProduit(ligne) {
  return {
    id: ligne.id,
    name: ligne.nom,
    price: ligne.prix,
    category: ligne.categorie,
    description: ligne.description,
    photos: JSON.parse(ligne.photos || '[]'),
    videos: JSON.parse(ligne.videos || '[]'),
    actif: !!ligne.actif,
    createdAt: ligne.date_creation,
  };
}

// GET /api/produits — liste publique (tous les produits, actifs ou non,
// le frontend filtre déjà ; on garde le même contrat de données qu'avant)
function listerProduits(req, res, repondreJSON) {
  const lignes = db.prepare('SELECT * FROM produits ORDER BY date_creation DESC').all();
  repondreJSON(res, 200, lignes.map(ligneVersProduit));
}

function obtenirProduit(req, res, repondreJSON, id) {
  const ligne = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
  if (!ligne) return repondreJSON(res, 404, { erreur: 'Produit introuvable' });
  repondreJSON(res, 200, ligneVersProduit(ligne));
}

function validerProduit(corps) {
  const erreurs = [];
  const nom = nettoyerTexte(corps.name);
  const prix = parseFloat(corps.price);

  if (!nom) erreurs.push('Le nom du produit est requis.');
  if (isNaN(prix) || prix < 0) erreurs.push('Le prix doit être un nombre positif.');

  const photos = Array.isArray(corps.photos) ? corps.photos.filter(estUrlValide) : [];
  const videos = Array.isArray(corps.videos) ? corps.videos.filter(estUrlValide) : [];

  return { erreurs, nom, prix, photos, videos };
}

// POST /api/produits — création (admin uniquement)
function creerProduit(req, res, repondreJSON, corps) {
  const { erreurs, nom, prix, photos, videos } = validerProduit(corps);
  if (erreurs.length) return repondreJSON(res, 400, { erreur: erreurs.join(' ') });

  const id = 'p_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const dateCreation = new Date().toISOString();

  db.prepare(`
    INSERT INTO produits (id, nom, prix, categorie, description, photos, videos, actif, date_creation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, nom, prix,
    nettoyerTexte(corps.category) || '',
    nettoyerTexte(corps.description) || '',
    JSON.stringify(photos),
    JSON.stringify(videos),
    corps.actif === false ? 0 : 1,
    dateCreation
  );

  const ligne = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
  repondreJSON(res, 201, ligneVersProduit(ligne));
}

// PUT /api/produits/:id — modification (admin uniquement)
function modifierProduit(req, res, repondreJSON, id, corps) {
  const existant = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
  if (!existant) return repondreJSON(res, 404, { erreur: 'Produit introuvable' });

  // Mise à jour partielle : on garde les valeurs existantes si non fournies
  const nom = corps.name !== undefined ? nettoyerTexte(corps.name) : existant.nom;
  const prix = corps.price !== undefined ? parseFloat(corps.price) : existant.prix;

  if (!nom) return repondreJSON(res, 400, { erreur: 'Le nom du produit est requis.' });
  if (isNaN(prix) || prix < 0) return repondreJSON(res, 400, { erreur: 'Le prix doit être un nombre positif.' });

  const photos = corps.photos !== undefined
    ? (Array.isArray(corps.photos) ? corps.photos.filter(estUrlValide) : [])
    : JSON.parse(existant.photos || '[]');
  const videos = corps.videos !== undefined
    ? (Array.isArray(corps.videos) ? corps.videos.filter(estUrlValide) : [])
    : JSON.parse(existant.videos || '[]');

  const categorie = corps.category !== undefined ? nettoyerTexte(corps.category) : existant.categorie;
  const description = corps.description !== undefined ? nettoyerTexte(corps.description) : existant.description;
  const actif = corps.actif !== undefined ? (corps.actif ? 1 : 0) : existant.actif;

  db.prepare(`
    UPDATE produits SET nom=?, prix=?, categorie=?, description=?, photos=?, videos=?, actif=?
    WHERE id=?
  `).run(nom, prix, categorie, description, JSON.stringify(photos), JSON.stringify(videos), actif, id);

  const ligne = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
  repondreJSON(res, 200, ligneVersProduit(ligne));
}

// DELETE /api/produits/:id — suppression (admin uniquement)
function supprimerProduit(req, res, repondreJSON, id) {
  const existant = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
  if (!existant) return repondreJSON(res, 404, { erreur: 'Produit introuvable' });

  db.prepare('DELETE FROM produits WHERE id = ?').run(id);
  repondreJSON(res, 200, { ok: true });
}

module.exports = {
  listerProduits,
  obtenirProduit,
  creerProduit,
  modifierProduit,
  supprimerProduit,
};
