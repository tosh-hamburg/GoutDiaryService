#!/usr/bin/env node

/**
 * Skript zum Setzen eines Benutzers als Super-Admin
 * 
 * Verwendung:
 *   node scripts/makeUserAdmin.js <email>
 *   node scripts/makeUserAdmin.js <guid>
 *   node scripts/makeUserAdmin.js --all-first  (macht den ersten User zum Admin)
 */

const { getDatabase } = require('../src/database');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');

async function makeUserAdmin(identifier) {
  try {
    const db = getDatabase();
    
    let user;
    
    // Prüfe ob es eine Email oder GUID ist
    if (identifier.includes('@')) {
      // Email
      user = User.findByEmail(identifier);
      if (!user) {
        console.error(`❌ Benutzer mit Email "${identifier}" nicht gefunden.`);
        process.exit(1);
      }
    } else {
      // GUID
      user = User.findByGuid(identifier);
      if (!user) {
        console.error(`❌ Benutzer mit GUID "${identifier}" nicht gefunden.`);
        process.exit(1);
      }
    }
    
    // Setze Admin-Status
    const updateStmt = db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
    updateStmt.run(user.id);
    
    // Lade aktualisierten User
    const updatedUser = User.findById(user.id);
    
    console.log('✅ Benutzer erfolgreich zum Super-Admin gemacht:');
    console.log(`   Email: ${updatedUser.email || 'N/A'}`);
    console.log(`   GUID: ${updatedUser.guid}`);
    console.log(`   Admin: ${updatedUser.isAdmin ? 'Ja' : 'Nein'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    logger.error('Error making user admin:', error);
    process.exit(1);
  }
}

async function makeFirstUserAdmin() {
  try {
    const db = getDatabase();
    
    // Finde den ersten User (ältester nach created_at)
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at ASC LIMIT 1');
    const row = stmt.get();
    
    if (!row) {
      console.error('❌ Keine Benutzer in der Datenbank gefunden.');
      process.exit(1);
    }
    
    const user = User.mapRow(row);
    
    // Setze Admin-Status
    const updateStmt = db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
    updateStmt.run(user.id);
    
    // Lade aktualisierten User
    const updatedUser = User.findById(user.id);
    
    console.log('✅ Ersten Benutzer erfolgreich zum Super-Admin gemacht:');
    console.log(`   Email: ${updatedUser.email || 'N/A'}`);
    console.log(`   GUID: ${updatedUser.guid}`);
    console.log(`   Registriert: ${updatedUser.createdAt}`);
    console.log(`   Admin: ${updatedUser.isAdmin ? 'Ja' : 'Nein'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    logger.error('Error making first user admin:', error);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Verwendung:');
  console.log('  node scripts/makeUserAdmin.js <email>');
  console.log('  node scripts/makeUserAdmin.js <guid>');
  console.log('  node scripts/makeUserAdmin.js --all-first');
  process.exit(1);
}

if (args[0] === '--all-first') {
  makeFirstUserAdmin();
} else {
  makeUserAdmin(args[0]);
}

















