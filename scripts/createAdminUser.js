#!/usr/bin/env node

/**
 * Skript zum Erstellen eines Admin-Benutzers für Development
 * 
 * Verwendung:
 *   node scripts/createAdminUser.js
 * 
 * Erstellt einen Admin-Benutzer mit:
 *   Username: admin
 *   Passwort: N6M6M:S3x$3-33R1LSsS
 *   Email: admin@dev.gout-diary.com
 */

const { initDatabase, getDatabase } = require('../src/database');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../src/utils/logger');

async function createAdminUser() {
  try {
    // Initialisiere Datenbank
    initDatabase();
    const db = getDatabase();
    
    // Prüfe ob Admin-Benutzer bereits existiert
    const existingAdmin = User.findByUsername('admin');
    if (existingAdmin) {
      console.log('ℹ️  Admin-Benutzer existiert bereits:');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email || 'N/A'}`);
      console.log(`   GUID: ${existingAdmin.guid}`);
      console.log(`   Admin: ${existingAdmin.isAdmin ? 'Ja' : 'Nein'}`);
      
      // Stelle sicher, dass er Admin ist
      if (!existingAdmin.isAdmin) {
        const updateStmt = db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
        updateStmt.run(existingAdmin.id);
        console.log('✅ Admin-Status wurde gesetzt.');
      }
      
      process.exit(0);
    }
    
    // Erstelle Admin-Konto
    const passwordHash = bcrypt.hashSync('N6M6M:S3x$3-33R1LSsS', 10);
    const guid = uuidv4();
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, guid, username, password_hash, is_admin, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, guid, 'admin', passwordHash, 1, 'admin@dev.gout-diary.com');
    
    console.log('✅ Admin-Benutzer erfolgreich erstellt:');
    console.log(`   Username: admin`);
    console.log(`   Passwort: N6M6M:S3x$3-33R1LSsS`);
    console.log(`   Email: admin@dev.gout-diary.com`);
    console.log(`   GUID: ${guid}`);
    console.log(`   Admin: Ja`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Admin-Benutzers:', error.message);
    logger.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Main
createAdminUser();

