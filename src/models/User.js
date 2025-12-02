const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

class User {
  static create(data) {
    const db = getDatabase();
    
    // Prüfe zuerst, ob User bereits existiert
    if (data.guid) {
      const existingUser = this.findByGuid(data.guid);
      if (existingUser) {
        // User existiert bereits, aktualisiere nur wenn neue Daten vorhanden sind
        if (data.gender !== undefined || data.birthYear !== undefined || data.email !== undefined || data.lastBackupTimestamp !== undefined) {
          // Für lastBackupTimestamp: Wenn undefined, behalte vorhandenen Wert; wenn null, setze auf null; wenn Wert, verwende Wert
          const lastBackupTimestamp = data.lastBackupTimestamp !== undefined 
            ? data.lastBackupTimestamp 
            : existingUser.lastBackupTimestamp;
          
          const updateStmt = db.prepare(`
            UPDATE users SET
              gender = COALESCE(?, gender),
              birth_year = COALESCE(?, birth_year),
              email = COALESCE(?, email),
              last_backup_timestamp = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE guid = ?
          `);
          // Debug: Log den Wert, der gespeichert wird
          if (process.env.NODE_ENV === 'development') {
            const logger = require('../utils/logger');
            logger.debug(`User.create(${data.guid}): Saving lastBackupTimestamp: ${lastBackupTimestamp} (type: ${typeof lastBackupTimestamp})`);
          }
          
          updateStmt.run(
            data.gender || null,
            data.birthYear || null,
            data.email || null,
            lastBackupTimestamp,
            data.guid
          );
          
          const updatedUser = this.findByGuid(data.guid);
          if (process.env.NODE_ENV === 'development') {
            const logger = require('../utils/logger');
            logger.debug(`User.create(${data.guid}): After save, lastBackupTimestamp in DB: ${updatedUser?.lastBackupTimestamp}`);
          }
          
          return updatedUser;
        }
        return existingUser;
      }
    }
    
    const id = uuidv4();
    
    // Admin-Status: Nur Benutzer mit username/password können Admin sein
    // GUID-Benutzer (nur für API-Zugriff) sind NIEMALS Admin
    let isAdmin = 0; // Standard: Kein Admin
    
    if (data.isAdmin !== undefined) {
      // Wenn isAdmin explizit übergeben wurde, verwende diesen Wert
      // ABER: Nur wenn username/password vorhanden sind
      if (data.username && data.passwordHash) {
        isAdmin = data.isAdmin ? 1 : 0;
      } else {
        // GUID-Benutzer können nicht Admin sein
        isAdmin = 0;
      }
    } else if (data.username && data.passwordHash) {
      // Benutzer mit username/password: Im Development-Modus Admin, sonst nur erster User
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        isAdmin = 1; // Im Development: Alle Web-Benutzer sind Admin
      } else {
        // Prüfe ob es der erste Web-Benutzer ist (wird Super-Admin)
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE username IS NOT NULL').get().count;
        isAdmin = userCount === 0 ? 1 : 0;
      }
    }
    // GUID-Benutzer ohne username/password: isAdmin bleibt 0
    
    const stmt = db.prepare(`
      INSERT INTO users (id, guid, gender, birth_year, last_backup_timestamp, email, google_id, username, password_hash, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        id,
        data.guid,
        data.gender || null,
        data.birthYear || null,
        data.lastBackupTimestamp || null,
        data.email || null,
        data.googleId || null,
        data.username || null,
        data.passwordHash || null,
        isAdmin
      );
      
      const createdUser = this.findByGuid(data.guid);
      if (!createdUser) {
        throw new Error(`Failed to retrieve created user with GUID: ${data.guid}`);
      }
      return createdUser;
    } catch (error) {
      // Wenn User bereits existiert (Race Condition), versuche ihn zu finden
      if (data.guid) {
        const existingUser = this.findByGuid(data.guid);
        if (existingUser) {
          return existingUser;
        }
      }
      throw error;
    }
  }
  
  static findByGuid(guid) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE guid = ?');
    const row = stmt.get(guid);
    if (row) {
      const user = this.mapRow(row);
      // Debug: Log lastBackupTimestamp aus der Datenbank
      if (process.env.NODE_ENV === 'development') {
        const logger = require('../utils/logger');
        logger.debug(`User.findByGuid(${guid}): last_backup_timestamp from DB: ${row.last_backup_timestamp}, mapped: ${user.lastBackupTimestamp}`);
      }
      return user;
    }
    return null;
  }
  
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }
  
  static findByGoogleId(googleId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE google_id = ?');
    const row = stmt.get(googleId);
    return row ? this.mapRow(row) : null;
  }
  
  static findByEmail(email) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email);
    return row ? this.mapRow(row) : null;
  }
  
  static findByUsername(username) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username);
    return row ? this.mapRow(row) : null;
  }
  
  static verifyPassword(user, password) {
    const bcrypt = require('bcrypt');
    if (!user || !user.passwordHash) {
      return false;
    }
    return bcrypt.compareSync(password, user.passwordHash);
  }
  
  static update(guid, data) {
    const db = getDatabase();
    const existingUser = this.findByGuid(guid);
    if (!existingUser) {
      return null;
    }
    
    // Verwende vorhandene Werte, wenn nicht explizit übergeben
    const gender = data.gender !== undefined ? data.gender : existingUser.gender;
    const birthYear = data.birthYear !== undefined ? data.birthYear : existingUser.birthYear;
    // lastBackupTimestamp: Wenn undefined, behalte vorhandenen Wert; wenn null, setze auf null; wenn Wert, verwende Wert
    const lastBackupTimestamp = data.lastBackupTimestamp !== undefined 
      ? data.lastBackupTimestamp 
      : existingUser.lastBackupTimestamp;
    
    const stmt = db.prepare(`
      UPDATE users 
      SET gender = ?, birth_year = ?, last_backup_timestamp = ?, updated_at = CURRENT_TIMESTAMP
      WHERE guid = ?
    `);
    
    // Debug: Log den Wert, der gespeichert wird
    if (process.env.NODE_ENV === 'development') {
      const logger = require('../utils/logger');
      logger.debug(`User.update(${guid}): Saving lastBackupTimestamp: ${lastBackupTimestamp} (type: ${typeof lastBackupTimestamp})`);
    }
    
    stmt.run(
      gender || null,
      birthYear || null,
      lastBackupTimestamp,
      guid
    );
    
    // Verifiziere, dass der Wert gespeichert wurde
    const updatedUser = this.findByGuid(guid);
    if (process.env.NODE_ENV === 'development') {
      const logger = require('../utils/logger');
      logger.debug(`User.update(${guid}): After save, lastBackupTimestamp in DB: ${updatedUser?.lastBackupTimestamp}`);
    }
    
    return updatedUser;
  }
  
  static createOrUpdate(data) {
    const existing = this.findByGuid(data.guid);
    if (existing) {
      // Wenn lastBackupTimestamp nicht explizit übergeben wurde, behalte den vorhandenen Wert
      if (data.lastBackupTimestamp === undefined && existing.lastBackupTimestamp) {
        data.lastBackupTimestamp = existing.lastBackupTimestamp;
      }
      return this.update(data.guid, data);
    } else {
      return this.create(data);
    }
  }
  
  static getAll() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all();
    return rows.map(row => this.mapRow(row));
  }
  
  static mapRow(row) {
    // Konvertiere last_backup_timestamp zu ISO-String, falls vorhanden
    let lastBackupTimestamp = null;
    if (row.last_backup_timestamp) {
      // Wenn es bereits ein String ist, verwende ihn direkt
      if (typeof row.last_backup_timestamp === 'string') {
        lastBackupTimestamp = row.last_backup_timestamp;
      } else if (row.last_backup_timestamp instanceof Date) {
        // Wenn es ein Date-Objekt ist, konvertiere zu ISO-String
        lastBackupTimestamp = row.last_backup_timestamp.toISOString();
      } else {
        // Fallback: Versuche es als String zu behandeln
        lastBackupTimestamp = String(row.last_backup_timestamp);
      }
    }
    
    return {
      id: row.id,
      guid: row.guid,
      gender: row.gender,
      birthYear: row.birth_year,
      lastBackupTimestamp: lastBackupTimestamp,
      email: row.email,
      googleId: row.google_id,
      username: row.username,
      passwordHash: row.password_hash,
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = User;

