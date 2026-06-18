// ============================================================
// LIMITEUR DE DÉBIT (anti-spam) — en mémoire, par IP
// ============================================================
// Simple fenêtre glissante. Suffisant pour une petite boutique ;
// si le trafic grandit beaucoup, migrer vers une solution dédiée (ex. Redis).

const fenetres = new Map(); // ip -> [timestamps]

function limiterDebit({ maxRequetes = 20, fenetreMs = 60_000 } = {}) {
  return function (ip) {
    const maintenant = Date.now();
    const historique = (fenetres.get(ip) || []).filter(t => maintenant - t < fenetreMs);
    historique.push(maintenant);
    fenetres.set(ip, historique);
    return historique.length <= maxRequetes;
  };
}

// Nettoyage périodique pour éviter la fuite mémoire sur le long terme
setInterval(() => {
  const maintenant = Date.now();
  for (const [ip, historique] of fenetres.entries()) {
    const filtre = historique.filter(t => maintenant - t < 5 * 60_000);
    if (filtre.length === 0) fenetres.delete(ip);
    else fenetres.set(ip, filtre);
  }
}, 5 * 60_000).unref();

module.exports = { limiterDebit };
