const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const cheminDB = path.join(__dirname, 'bdboutique.db');
const dbExistaitDeja = require('fs').existsSync(cheminDB);

const db = new DatabaseSync(cheminDB);

db.exec(`
  CREATE TABLE IF NOT EXISTS administrateurs (
    id TEXT PRIMARY KEY,
    mot_de_passe_hash TEXT NOT NULL,
    tentatives_echouees INTEGER DEFAULT 0,
    bloque_jusqu_a INTEGER DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    cree_le INTEGER NOT NULL,
    expire_le INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS produits (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    prix REAL NOT NULL,
    description TEXT,
    image TEXT,
    categorie TEXT,
    stock INTEGER DEFAULT 0,
    cree_le INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS commandes (
    id TEXT PRIMARY KEY,
    client_nom TEXT,
    client_telephone TEXT,
    client_adresse TEXT,
    articles TEXT NOT NULL,
    total REAL NOT NULL,
    statut TEXT DEFAULT 'en_attente',
    cree_le INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS paiements (
    id TEXT PRIMARY KEY,
    commande_id TEXT NOT NULL,
    methode TEXT DEFAULT 'wave',
    statut TEXT DEFAULT 'en_attente',
    montant REAL NOT NULL,
    cree_le INTEGER NOT NULL,
    FOREIGN KEY (commande_id) REFERENCES commandes(id)
  );
`);

if (!dbExistaitDeja) {
  const motDePasseInitial = process.env.BD_ADMIN_INIT_PASS || 'ChangeMoiMaintenant!2024';
  const sel = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(motDePasseInitial, sel, iterations, 64, 'sha512').toString('hex');

  db.prepare(
    'INSERT INTO administrateurs (id, mot_de_passe_hash) VALUES (?, ?)'
  ).run('admin', `${iterations}:${sel}:${hash}`);

  console.log('✅ Base de données créée. Compte admin initialisé.');
}

module.exports = db;
