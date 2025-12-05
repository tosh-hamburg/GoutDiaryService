/**
 * PostgreSQL Datenbankverbindung
 * 
 * Kopiere diese Datei nach config/database.js und passe die Werte an
 * Oder verwende Umgebungsvariablen in .env
 */

const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL-Verbindungskonfiguration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gout_diary',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  schema: 'gout_diary',
  max: 20, // Maximale Anzahl von Clients im Pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test der Verbindung
pool.on('connect', () => {
  console.log('✓ PostgreSQL verbunden');
});

pool.on('error', (err) => {
  console.error('❌ Unerwarteter Fehler bei inaktiver Client-Verbindung', err);
  process.exit(-1);
});

// Hilfsfunktion: Query mit Logging
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Query error', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

// Hilfsfunktion: Get Single Row
async function get(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Hilfsfunktion: Get All Rows
async function all(text, params) {
  const result = await query(text, params);
  return result.rows;
}

// Hilfsfunktion: Run (für Kompatibilität mit SQLite)
async function run(text, params) {
  const result = await query(text, params);
  return { 
    changes: result.rowCount,
    lastID: result.rows[0]?.id || null 
  };
}

// Prepared Statement (für Kompatibilität mit SQLite)
function prepare(sql) {
  return {
    all: (params) => all(sql, params),
    get: (params) => get(sql, params),
    run: (params) => run(sql, params),
  };
}

// Test-Verbindung
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as now, current_database() as database');
    console.log('✓ PostgreSQL-Verbindung erfolgreich:', {
      database: result.rows[0].database,
      time: result.rows[0].now,
    });
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL-Verbindungsfehler:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  get,
  all,
  run,
  prepare,
  testConnection,
};

