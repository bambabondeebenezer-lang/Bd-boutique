// ============================================================
// BD BOUTIQUE — BASE DE DONNÉES SQLITE (module natif Node.js)
// ============================================================
// Utilise node:sqlite (disponible nativement depuis Node 22.5+, expérimental).
// Aucune dépendance externe (pas de better-sqlite3, pas de npm install).
// ============================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, 'bdboutique.db');

const db = new DatabaseSync(DB_PATH);

// Active les clés étrangères (désactivées par défaut en SQLite)
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// ============================================================
// CRÉATION DES TABLES
// ============================================================
function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS produits (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prix REAL NOT NULL,
      categorie TEXT,
      description TEXT,
      photos TEXT NOT NULL DEFAULT '[]',
      videos TEXT NOT NULL DEFAULT '[]',
      actif INTEGER NOT NULL DEFAULT 1,
      date_creation TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS commandes (
      id TEXT PRIMARY KEY,
      numero_commande TEXT UNIQUE NOT NULL,
      client_nom TEXT NOT NULL,
      client_prenom TEXT NOT NULL,
      client_telephone TEXT NOT NULL,
      client_adresse TEXT NOT NULL,
      client_note TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      total REAL NOT NULL,
      statut TEXT NOT NULL DEFAULT 'En attente',
      date_creation TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS paiements (
      id TEXT PRIMARY KEY,
      commande_id TEXT NOT NULL,
      montant REAL NOT NULL,
      statut TEXT NOT NULL DEFAULT 'En attente',
      date_creation TEXT NOT NULL,
      FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS administrateurs (
      id TEXT PRIMARY KEY,
      identifiant TEXT UNIQUE NOT NULL,
      mot_de_passe_hash TEXT NOT NULL,
      sel TEXT NOT NULL,
      derniere_connexion TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      date_creation TEXT NOT NULL,
      date_expiration TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES administrateurs(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tentatives_connexion (
      identifiant TEXT PRIMARY KEY,
      nb_echecs INTEGER NOT NULL DEFAULT 0,
      bloque_jusqu_a TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT
    );
  `);

  seedAdminIfNeeded();
  seedSettingsIfNeeded();
}

// ============================================================
// HACHAGE DE MOT DE PASSE (PBKDF2 — module natif crypto, équivalent bcrypt)
// ============================================================
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function createAdmin(identifiant, motDePasse) {
  const id = 'adm_' + crypto.randomUUID();
  const sel = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(motDePasse, sel);
  const stmt = db.prepare(`
    INSERT INTO administrateurs (id, identifiant, mot_de_passe_hash, sel, derniere_connexion)
    VALUES (?, ?, ?, ?, NULL)
  `);
  stmt.run(id, identifiant, hash, sel);
  return id;
}

function seedAdminIfNeeded() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM administrateurs').get();
  if (existing.c === 0) {
    // Mot de passe par défaut temporaire — DOIT être changé immédiatement.
    // Voir CONFIGURATION.md pour la procédure de changement de mot de passe.
    const defaultPass = process.env.BD_ADMIN_INIT_PASS || 'ChangeMoiMaintenant!2024';
    createAdmin('admin', defaultPass);
    console.log('⚠️  Compte admin créé avec mot de passe temporaire. Voir CONFIGURATION.md pour le changer immédiatement.');
  }
}

function seedSettingsIfNeeded() {
  const defaults = {
    whatsapp: '2250160556510',
    wave: '0769087461',
    storeName: 'BD Boutique',
    slogan: "Découvrez notre sélection de produits de qualité. Commandez facilement, payez via Wave et recevez votre livraison partout en Côte d'Ivoire.",
    contactPhoneDisplay: '+225 01 60 55 65 10',
    contactEmail: '',
    contactAddress: "Côte d'Ivoire",
  };
  const insert = db.prepare(`INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(defaults)) {
    insert.run(k, v);
  }
}

migrate();

module.exports = { db, hashPassword };
