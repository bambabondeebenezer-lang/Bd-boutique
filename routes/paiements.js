// ============================================================
// API PAIEMENTS — GET /api/paiements
// ============================================================
// Rappel : le paiement réel est négocié manuellement sur WhatsApp.
// Ces enregistrements servent uniquement de suivi administratif
// (le statut "Payé" est positionné quand l'admin marque la commande
// comme Confirmée ou Livrée).

const { db } = require('../db/database');

function ligneVersPaiement(ligne) {
  const commande = db.prepare('SELECT numero_commande FROM commandes WHERE id = ?').get(ligne.commande_id);
  return {
    id: ligne.id,
    orderId: ligne.commande_id,
    orderNumber: commande ? commande.numero_commande : null,
    amount: ligne.montant,
    status: ligne.statut,
    date: ligne.date_creation,
  };
}

// GET /api/paiements — liste (admin uniquement)
function listerPaiements(req, res, repondreJSON) {
  const lignes = db.prepare('SELECT * FROM paiements ORDER BY date_creation DESC').all();
  repondreJSON(res, 200, lignes.map(ligneVersPaiement));
}

module.exports = { listerPaiements };
