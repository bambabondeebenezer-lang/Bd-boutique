const db = require('../db/database');

function verifierAuth(req, res, next) {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      return res.writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ erreur: 'Non authentifié' }));
    }

    const maintenant = Date.now();

    const session = db.prepare(
      'SELECT * FROM sessions WHERE token = ? AND expire_le > ?'
    ).get(token, maintenant);

    if (!session) {
      return res.writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ erreur: 'Session expirée ou invalide' }));
    }

    req.adminId = session.admin_id;
    next();
  } catch (e) {
    return res.writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ erreur: 'Erreur serveur' }));
  }
}

module.exports = { verifierAuth };
