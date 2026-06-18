// ============================================================
// API COMMANDES — GET/POST /api/commandes + PUT /api/commandes/:id
// ============================================================

const crypto = require('node:crypto');
const { db } = require('../db/database');
const { nettoyerTexte } = require('../utils/http');

const STATUTS_VALIDES = ['En attente', 'Confirmée', 'Livrée', 'Annulée'];

function ligneVersCommande(ligne) {
  return {
    id: ligne.id,
    orderNumber: ligne.numero_commande,
    date: ligne.date_creation,
    customer: {
      nom: ligne.client_nom,
      prenom: ligne.client_prenom,
      telephone: ligne.client_telephone,
      adresse: ligne.client_adresse,
      note: ligne.client_note || '',
    },
    items: JSON.parse(ligne.items || '[]'),
    total: ligne.total,
    status: ligne.statut,
  };
}

function genererNumeroCommande() {
  const annee = new Date().getFullYear();
  const compte = db.prepare(`
    SELECT COUNT(*) as c FROM commandes WHERE numero_commande LIKE ?
  `).get(`%-${annee}-%`);
  const seq = String(compte.c + 1).padStart(3, '0');
  return `BD-${annee}-${seq}`;
}

// GET /api/commandes — liste (admin uniquement)
function listerCommandes(req, res, repondreJSON) {
  const lignes = db.prepare('SELECT * FROM commandes ORDER BY date_creation DESC').all();
  repondreJSON(res, 200, lignes.map(ligneVersCommande));
}

function obtenirCommande(req, res, repondreJSON, id) {
  const ligne = db.prepare('SELECT * FROM commandes WHERE id = ? OR numero_commande = ?').get(id, id);
  if (!ligne) return repondreJSON(res, 404, { erreur: 'Commande introuvable' });
  repondreJSON(res, 200, ligneVersCommande(ligne));
}

// POST /api/commandes — création (public, depuis le checkout du site)
function creerCommande(req, res, repondreJSON, corps) {
  const customer = corps.customer || {};
  const nom = nettoyerTexte(customer.nom);
  const prenom = nettoyerTexte(customer.prenom);
  const telephone = nettoyerTexte(customer.telephone);
  const adresse = nettoyerTexte(customer.adresse);
  const note = nettoyerTexte(customer.note) || '';

  const erreurs = [];
  if (!nom) erreurs.push('Le nom est requis.');
  if (!prenom) erreurs.push('Le prénom est requis.');
  if (!adresse) erreurs.push('L\'adresse est requise.');
  const telDigits = (telephone || '').replace(/\D/g, '');
  if (!telephone || telDigits.length < 8) erreurs.push('Un numéro de téléphone valide est requis.');

  const items = Array.isArray(corps.items) ? corps.items : [];
  if (items.length === 0) erreurs.push('La commande doit contenir au moins un article.');

  // Recalcule le total côté serveur à partir des prix réels en base
  // (ne JAMAIS faire confiance au total envoyé par le client)
  let total = 0;
  const itemsValides = [];
  for (const item of items) {
    const produit = db.prepare('SELECT * FROM produits WHERE id = ?').get(item.productId);
    if (!produit) {
      erreurs.push(`Produit introuvable : ${item.productId}`);
      continue;
    }
    const qty = Math.max(1, parseInt(item.qty) || 1);
    const sousTotal = produit.prix * qty;
    total += sousTotal;
    itemsValides.push({
      productId: produit.id,
      name: produit.nom,
      price: produit.prix,
      qty,
    });
  }

  if (erreurs.length) return repondreJSON(res, 400, { erreur: erreurs.join(' ') });

  const id = 'c_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const numeroCommande = genererNumeroCommande();
  const dateCreation = new Date().toISOString();

  db.prepare(`
    INSERT INTO commandes
      (id, numero_commande, client_nom, client_prenom, client_telephone, client_adresse, client_note, items, total, statut, date_creation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'En attente', ?)
  `).run(id, numeroCommande, nom, prenom, telephone, adresse, note, JSON.stringify(itemsValides), total, dateCreation);

  // Crée automatiquement l'enregistrement de paiement associé (statut "En attente")
  const paiementId = 'pay_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  db.prepare(`
    INSERT INTO paiements (id, commande_id, montant, statut, date_creation)
    VALUES (?, ?, ?, 'En attente', ?)
  `).run(paiementId, id, total, dateCreation);

  const ligne = db.prepare('SELECT * FROM commandes WHERE id = ?').get(id);
  repondreJSON(res, 201, ligneVersCommande(ligne));
}

// PUT /api/commandes/:id — changement de statut (admin uniquement)
function modifierStatutCommande(req, res, repondreJSON, id, corps) {
  const existant = db.prepare('SELECT * FROM commandes WHERE id = ? OR numero_commande = ?').get(id, id);
  if (!existant) return repondreJSON(res, 404, { erreur: 'Commande introuvable' });

  const nouveauStatut = corps.status;
  if (!STATUTS_VALIDES.includes(nouveauStatut)) {
    return repondreJSON(res, 400, { erreur: `Statut invalide. Valeurs autorisées : ${STATUTS_VALIDES.join(', ')}` });
  }

  db.prepare('UPDATE commandes SET statut = ? WHERE id = ?').run(nouveauStatut, existant.id);

  // Le statut de paiement suit le statut de commande, comme dans la version actuelle :
  // "Payé" si Livrée ou Confirmée, sinon "En attente"
  const statutPaiement = (nouveauStatut === 'Livrée' || nouveauStatut === 'Confirmée') ? 'Payé' : 'En attente';
  db.prepare('UPDATE paiements SET statut = ? WHERE commande_id = ?').run(statutPaiement, existant.id);

  const ligne = db.prepare('SELECT * FROM commandes WHERE id = ?').get(existant.id);
  repondreJSON(res, 200, ligneVersCommande(ligne));
}

module.exports = {
  listerCommandes,
  obtenirCommande,
  creerCommande,
  modifierStatutCommande,
  STATUTS_VALIDES,
};
