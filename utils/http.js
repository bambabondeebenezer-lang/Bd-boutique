// ============================================================
// UTILITAIRES HTTP
// ============================================================

function envoyerJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function lireBodyJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let taille = 0;
    const LIMITE = 5 * 1024 * 1024; // 5 Mo max par requête

    req.on('data', (chunk) => {
      taille += chunk.length;
      if (taille > LIMITE) {
        req.destroy();
        reject(new Error('PAYLOAD_TROP_GRAND'));
        return;
      }
      data += chunk;
    });

    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON_INVALIDE'));
      }
    });

    req.on('error', reject);
  });
}

function recupererToken(req) {
  const entete = req.headers['authorization'] || '';
  if (entete.startsWith('Bearer ')) return entete.slice(7).trim();
  return null;
}

// Échappement simple pour éviter l'injection HTML (défense en profondeur,
// même si le frontend doit aussi échapper à l'affichage)
function nettoyerTexte(valeur) {
  if (typeof valeur !== 'string') return valeur;
  return valeur.trim();
}

// Valide qu'une chaîne est une URL http(s) plausible (pour les médias)
function estUrlValide(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' || url.startsWith('data:image');
  } catch {
    return false;
  }
}

module.exports = {
  envoyerJSON,
  lireBodyJSON,
  recupererToken,
  nettoyerTexte,
  estUrlValide,
};
