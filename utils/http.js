function repondreJSON(res, code, donnees) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(donnees));
}

function repondreErreur(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ erreur: message }));
}

module.exports = { repondreJSON, repondreErreur };
