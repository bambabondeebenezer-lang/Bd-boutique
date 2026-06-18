// ============================================
// API AUTH — login, logout, changer-mdp
// ============================================

const { repondreJSON, repondreErreur } = require('../utils/http');
const { verifierSession } = require('../middleware/auth');

function routesAuth(req, res, db) {
  const url = req.url.split('?')[0];

  // POST /api/auth/login
  if (req.method === 'POST' && url === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { identifiant, motDePasse } = JSON.parse(body);
        if (!identifiant || !motDePasse) {
          return repondreErreur(res, 400, 'Identifiant et mot de passe requis');
        }

        const admin = db.prepare(
          'SELECT * FROM administrateurs WHERE identifiant = ?'
        ).get(identifiant);

        if (!admin) {
          return repondreErreur(res, 401, 'Identifiant ou mot de passe incorrect');
        }

        const crypto = require('node:crypto');

        // Vérifier tentatives brute-force
        const tentatives = db.prepare(
          'SELECT * FROM tentatives_connexion WHERE identifiant = ? AND expire_a > ?'
        ).get(identifiant, Date.now());

        if (tentatives && tentatives.count >= 5) {
          return repondreErreur(res, 429, 'Trop de tentatives. Réessayez dans 15 minutes.');
        }

        // Vérifier mot de passe (PBKDF2)
        const [iterations, sel, hashStocke] = admin.mot_de_passe_hash.split(':');
        const hashFourni = crypto.pbkdf2Sync(
          motDePasse, sel, parseInt(iterations), 64, 'sha512'
        ).toString('hex');

        const valide = crypto.timingSafeEqual(
          Buffer.from(hashFourni), Buffer.from(hashStocke)
        );

        if (!valide) {
          // Incrémenter tentatives
          const existing = db.prepare(
            'SELECT * FROM tentatives_connexion WHERE identifiant = ?'
          ).get(identifiant);
          if (existing) {
            db.prepare(
              'UPDATE tentatives_connexion SET count = count + 1, expire_a = ? WHERE identifiant = ?'
            ).run(Date.now() + 15 * 60 * 1000, identifiant);
          } else {
            db.prepare(
              'INSERT INTO tentatives_connexion (identifiant, count, expire_a) VALUES (?, 1, ?)'
            ).run(identifiant, Date.now() + 15 * 60 * 1000);
          }
          return repondreErreur(res, 401, 'Identifiant ou mot de passe incorrect');
        }

        // Réinitialiser tentatives
        db.prepare('DELETE FROM tentatives_connexion WHERE identifiant = ?').run(identifiant);

        // Créer session
        const token = crypto.randomBytes(32).toString('hex');
        const expiration = Date.now() + 8 * 60 * 60 * 1000; // 8h
        db.prepare(
          'INSERT INTO sessions (token, admin_id, expire_a) VALUES (?, ?, ?)'
        ).run(token, admin.id, expiration);

        // Mettre à jour dernière connexion
        db.prepare(
          'UPDATE administrateurs SET derniere_connexion = ? WHERE id = ?'
        ).run(new Date().toISOString(), admin.id);

        res.setHeader('Set-Cookie',
          `session=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict`
        );
        return repondreJSON(res, 200, { succes: true });

      } catch (e) {
        return repondreErreur(res, 400, 'Données invalides');
      }
    });
    return true;
  }

  // POST /api/auth/logout
  if (req.method === 'POST' && url === '/api/auth/logout') {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/session=([a-f0-9]+)/);
    if (match) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(match[1]);
    }
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
    return repondreJSON(res, 200, { succes: true });
  }

  // GET /api/auth/verifier
  if (req.method === 'GET' && url === '/api/auth/verifier') {
    const connecte = verifierSession(req, db);
    return repondreJSON(res, 200, { connecte });
  }

  // POST /api/auth/changer-mdp
  if (req.method === 'POST' && url === '/api/auth/changer-mdp') {
    if (!verifierSession(req, db)) {
      return repondreErreur(res, 401, 'Non autorisé');
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { ancienMdp, nouveauMdp } = JSON.parse(body);
        if (!ancienMdp || !nouveauMdp || nouveauMdp.length < 8) {
          return repondreErreur(res, 400, 'Nouveau mot de passe trop court (8 caractères min)');
        }

        const crypto = require('node:crypto');
        const admin = db.prepare('SELECT * FROM administrateurs WHERE identifiant = ?').get('admin');
        const [iterations, sel, hashStocke] = admin.mot_de_passe_hash.split(':');
        const hashFourni = crypto.pbkdf2Sync(
          ancienMdp, sel, parseInt(iterations), 64, 'sha512'
        ).toString('hex');

        const valide = crypto.timingSafeEqual(
          Buffer.from(hashFourni), Buffer.from(hashStocke)
        );

        if (!valide) return repondreErreur(res, 401, 'Ancien mot de passe incorrect');

        const newSel = crypto.randomBytes(16).toString('hex');
        const newHash = crypto.pbkdf2Sync(nouveauMdp, newSel, 100000, 64, 'sha512').toString('hex');
        db.prepare(
          'UPDATE administrateurs SET mot_de_passe_hash = ? WHERE identifiant = ?'
        ).run(`100000:${newSel}:${newHash}`, 'admin');

        return repondreJSON(res, 200, { succes: true });
      } catch (e) {
        return repondreErreur(res, 400, 'Données invalides');
      }
    });
    return true;
  }

  return null;
}

module.exports = { routesAuth };
