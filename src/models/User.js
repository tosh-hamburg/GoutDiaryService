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
        if (data.gender !== undefined || data.birthYear !== undefined || data.email !== undefined) {
          const updateStmt = db.prepare(`
            UPDATE users SET
              gender = COALESCE(?, gender),
              birth_year = COALESCE(?, birth_year),
              email = COALESCE(?, email),
              updated_at = CURRENT_TIMESTAMP
            WHERE guid = ?
          `);
          updateStmt.run(
            data.gender || null,
            data.birthYear || null,
            data.email || null,
            data.guid
          );
          return this.findByGuid(data.guid);
        }
        return existingUser;
      }
    }
    
    const id = uuidv4();
    
    // Im Development-Modus: Alle User sind Super-Admins
    const isDevelopment = process.env.NODE_ENV === 'development';
    let isAdmin;
    
    if (isDevelopment) {
      isAdmin = 1; // Alle sind Admins im Development
    } else if (data.isAdmin !== undefined) {
      // Wenn isAdmin explizit übergeben wurde, verwende diesen Wert
      isAdmin = data.isAdmin ? 1 : 0;
    } else {
      // Prüfe ob es der erste User ist (wird Super-Admin)
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      isAdmin = userCount === 0 ? 1 : 0;
    }
    
    const stmt = db.prepare(`
      INSERT INTO users (id, guid, gender, birth_year, email, google_id, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        id,
        data.guid,
        data.gender || null,
        data.birthYear || null,
        data.email || null,
        data.googleId || null,
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
    return row ? this.mapRow(row) : null;
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
    const stmt = db.prepare(`
      UPDATE users 
      SET gender = ?, birth_year = ?, updated_at = CURRENT_TIMESTAMP
      WHERE guid = ?
    `);
    
    stmt.run(
      data.gender || null,
      data.birthYear || null,
      guid
    );
    
    return this.findByGuid(guid);
  }
  
  static createOrUpdate(data) {
    const existing = this.findByGuid(data.guid);
    if (existing) {
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
    return {
      id: row.id,
      guid: row.guid,
      gender: row.gender,
      birthYear: row.birth_year,
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

