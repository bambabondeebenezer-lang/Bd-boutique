// ============================================
// API PAIEMENTS — GET /api/paiements
// ============================================

const { repondreJSON, repondreErreur } = require('../utils/http');
const { verifierSession } = require('../middleware/auth');

function routesPaiements(req, res, db) {
  const url = req.url.split('?')[0];

  // GET /api/paiements — liste tous les paiements (admin uniquement)
  if (req.method === 'GET' && url === '/api/paiements') {
    if (!verifierSession(req, db)) {
      return repondreErreur(res, 401, 'Non autorisé');
    }

    try {
      const paiements = db.prepare(`
        SELECT p.*, c.numero_commande, c.client_nom, c.client_prenom, c.total
        FROM paiements p
        JOIN commandes c ON p.commande_id = c.id
        ORDER BY p.date_creation DESC
      `).all();

      return repondreJSON(res, 200, paiements);
    } catch (e) {
      return repondreErreur(res, 500, 'Erreur serveur');
    }
  }

  return null;
}

module.exports = { routesPaiements };
