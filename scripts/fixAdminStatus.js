#!/usr/bin/env node

/**
 * Skript zum Korrigieren des Admin-Status
 * 
 * Setzt alle GUID-Benutzer (ohne username/password) auf isAdmin = 0
 * Nur Benutzer mit username/password können Admin sein
 * 
 * Verwendung:
 *   node scripts/fixAdminStatus.js
 */

const { initDatabase, getDatabase } = require('../src/database');
const logger = require('../src/utils/logger');

async function fixAdminStatus() {
  try {
    // Initialisiere Datenbank
    initDatabase();
    const db = getDatabase();
    
    // Finde alle Benutzer, die Admin sind, aber keinen username/password haben
    const stmt = db.prepare(`
      SELECT id, guid, username, email, is_admin 
      FROM users 
      WHERE is_admin = 1 AND (username IS NULL OR username = '') AND (password_hash IS NULL OR password_hash = '')
    `);
    
    const guidAdmins = stmt.all();
    
    if (guidAdmins.length === 0) {
      console.log('✅ Keine GUID-Benutzer mit Admin-Status gefunden. Alles in Ordnung.');
      process.exit(0);
    }
    
    console.log(`⚠️  Gefunden: ${guidAdmins.length} GUID-Benutzer mit Admin-Status (ohne username/password)`);
    console.log('Diese werden auf isAdmin = 0 gesetzt...\n');
    
    // Setze alle auf isAdmin = 0
    const updateStmt = db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?');
    let fixed = 0;
    
    for (const user of guidAdmins) {
      updateStmt.run(user.id);
      console.log(`   - GUID: ${user.guid} (Email: ${user.email || 'N/A'}) → isAdmin = 0`);
      fixed++;
    }
    
    console.log(`\n✅ ${fixed} GUID-Benutzer korrigiert. Sie sind jetzt keine Admins mehr.`);
    console.log('\nHinweis: Nur Benutzer mit username/password können sich anmelden und Admin sein.');
    console.log('GUID-Benutzer greifen nur über die API (mit API-Key) auf den Dienst zu.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler beim Korrigieren des Admin-Status:', error.message);
    logger.error('Error fixing admin status:', error);
    process.exit(1);
  }
}

// Main
fixAdminStatus();


