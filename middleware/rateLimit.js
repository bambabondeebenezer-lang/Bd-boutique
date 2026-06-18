const limites = new Map();

function rateLimit({ fenetre = 60000, max = 10 } = {}) {
  return function (req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'inconnu';
    const maintenant = Date.now();
    const cle = `${ip}:${req.url}`;

    if (!limites.has(cle)) {
      limites.set(cle, { compte: 1, debut: maintenant });
      return next();
    }

    const entree = limites.get(cle);

    if (maintenant - entree.debut > fenetre) {
      limites.set(cle, { compte: 1, debut: maintenant });
      return next();
    }

    if (entree.compte >= max) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        erreur: 'Trop de tentatives. Réessayez dans quelques minutes.'
      }));
    }

    entree.compte++;
    return next();
  };
}

module.exports = { rateLimit };
