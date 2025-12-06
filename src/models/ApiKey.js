const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const logger = require('../utils/logger');

class ApiKey {
  /**
   * Generiert einen neuen API-Key (zur Anzeige)
   * Format: hst_<random 32 chars>
   */
  static generateKey() {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `hst_${randomBytes}`;
  }

  /**
   * Hasht einen API-Key für die Speicherung
   */
  static hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Erstellt einen neuen API-Key
   */
  static async create(data) {
    const db = getDatabase();
    const id = uuidv4();
    
    // Generiere den API-Key (nur einmal sichtbar!)
    const plainKey = this.generateKey();
    const keyHash = this.hashKey(plainKey);
    
    const stmt = db.prepare(`
      INSERT INTO api_keys (
        id, key_hash, name, description,
        can_read_own_uric_acid, can_write_own_uric_acid,
        can_read_own_meals, can_write_own_meals,
        can_read_all_uric_acid, can_read_all_meals,
        created_by, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Stelle sicher, dass isActive explizit gesetzt wird (Standard: true)
    const isActive = data.isActive !== undefined && data.isActive !== null 
      ? (data.isActive === true || data.isActive === 1 || data.isActive === 'true' || data.isActive === '1')
      : true; // Standard: aktiv
    
    await stmt.run(
      id,
      keyHash,
      data.name,
      data.description || null,
      data.canReadOwnUricAcid ? 1 : 0,
      data.canWriteOwnUricAcid ? 1 : 0,
      data.canReadOwnMeals ? 1 : 0,
      data.canWriteOwnMeals ? 1 : 0,
      data.canReadAllUricAcid ? 1 : 0,
      data.canReadAllMeals ? 1 : 0,
      data.createdBy || null,
      isActive ? 1 : 0 // Konvertiere zu 1/0 für SQLite, wird von Transformation zu true/false für PostgreSQL konvertiert
    );
    
    logger.info(`Created API Key: ${data.name}, isActive=${isActive} (will be stored as ${isActive ? 1 : 0})`);
    
    // Gib den API-Key zurück (nur beim Erstellen sichtbar!)
    const apiKey = await this.findById(id);
    return {
      ...apiKey,
      key: plainKey // Nur beim Erstellen!
    };
  }

  /**
   * Erstellt einen API-Key mit einem vorgegebenen Key-Wert (für manuelles Hinzufügen)
   */
  static async createWithKey(data) {
    const db = getDatabase();
    const id = uuidv4();
    
    // Verwende den vorgegebenen Key
    const plainKey = data.key.trim();
    const keyHash = this.hashKey(plainKey);
    
    // Prüfe, ob dieser Key bereits existiert
    const existing = await this.findByKeyHash(keyHash);
    if (existing) {
      throw new Error('API-Key existiert bereits');
    }
    
    const stmt = db.prepare(`
      INSERT INTO api_keys (
        id, key_hash, name, description,
        can_read_own_uric_acid, can_write_own_uric_acid,
        can_read_own_meals, can_write_own_meals,
        can_read_all_uric_acid, can_read_all_meals,
        created_by, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.run(
      id,
      keyHash,
      data.name,
      data.description || null,
      data.canReadOwnUricAcid ? 1 : 0,
      data.canWriteOwnUricAcid ? 1 : 0,
      data.canReadOwnMeals ? 1 : 0,
      data.canWriteOwnMeals ? 1 : 0,
      data.canReadAllUricAcid ? 1 : 0,
      data.canReadAllMeals ? 1 : 0,
      data.createdBy || null,
      data.isActive !== false ? 1 : 0
    );
    
    // Gib den API-Key zurück
    const apiKey = await this.findById(id);
    return {
      ...apiKey,
      key: plainKey // Nur beim Erstellen sichtbar!
    };
  }

  /**
   * Findet einen API-Key anhand des gehashten Keys
   */
  static async findByKeyHash(keyHash) {
    const db = getDatabase();
    // Verwende eine WHERE-Klausel, die sowohl für SQLite (INTEGER) als auch PostgreSQL (BOOLEAN) funktioniert
    // Die SQL-Transformation konvertiert is_active = 1 zu is_active = TRUE für PostgreSQL
    // Strategie: Suche zuerst mit Filter, dann ohne Filter als Fallback
    let stmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1');
    let row = await stmt.get(keyHash);
    
    // Fallback: Wenn nichts gefunden wurde, versuche ohne is_active Filter
    // (kann passieren, wenn die Transformation nicht funktioniert oder der Wert als Boolean gespeichert ist)
    if (!row) {
      // Versuche ohne is_active Filter - filtere dann in JavaScript
      stmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
      row = await stmt.get(keyHash);
      
      // Wenn Key gefunden wurde, aber is_active nicht TRUE/1 ist, behandle als nicht gefunden
      if (row) {
        const isActive = row.is_active === true || row.is_active === 1 || row.is_active === '1' || row.is_active === 'true';
        if (!isActive) {
          // Key ist inaktiv - behandle als nicht gefunden
          logger.debug(`API Key found but is inactive: is_active=${row.is_active}`);
          row = null;
        }
      }
    }
    
    if (!row) {
      return null;
    }
    
    // Mappe die Zeile
    const mapped = this.mapRow(row);
    
    // Prüfe, ob der Key aktiv ist (in der Datenbank)
    // Wenn is_active undefined/null ist, behandele es als aktiv (Standard)
    const dbIsActive = row.is_active === undefined || row.is_active === null
      ? true // Standard: aktiv, wenn nicht gesetzt
      : (row.is_active === true || row.is_active === 1 || row.is_active === '1' || row.is_active === 'true');
    
    // Wenn der Key in der DB inaktiv ist, gib null zurück (wie bei der WHERE-Klausel)
    if (!dbIsActive) {
      logger.warn(`API Key found but is inactive: is_active=${row.is_active} (type: ${typeof row.is_active})`);
      return null;
    }
    
    // Wenn is_active undefined war, setze es in der DB (Reparatur)
    if (row.is_active === undefined || row.is_active === null) {
      logger.warn(`API Key has undefined is_active, fixing in database...`);
      try {
        const updateStmt = db.prepare('UPDATE api_keys SET is_active = 1 WHERE key_hash = ?');
        await updateStmt.run(keyHash);
        logger.info(`Fixed is_active for API key ${row.id}`);
      } catch (updateError) {
        logger.error(`Failed to fix is_active: ${updateError.message}`);
      }
    }
    
    // Zusätzliche Sicherheitsprüfung: Wenn is_active in der DB true/1 ist, aber mapped.isActive false,
    // dann gibt es ein Mapping-Problem
    if (dbIsActive && !mapped.isActive) {
      logger.error(`API Key mapping error: Database has is_active=${row.is_active} (type: ${typeof row.is_active}), but mapped to isActive=${mapped.isActive}`);
      // Korrigiere den Wert manuell
      mapped.isActive = true;
    }
    
    return mapped;
  }

  /**
   * Findet einen API-Key anhand des Plain-Text-Keys
   */
  static async findByKey(plainKey) {
    const keyHash = this.hashKey(plainKey);
    return await this.findByKeyHash(keyHash);
  }

  /**
   * Findet einen API-Key anhand der ID
   */
  static async findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
    const row = await stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Gibt alle API-Keys zurück
   */
  static async getAll() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC');
    const rows = await stmt.all();
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Aktualisiert die letzte Verwendung eines API-Keys
   */
  static async updateLastUsed(id) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?');
    await stmt.run(id);
  }

  /**
   * Aktualisiert einen API-Key
   */
  static async update(id, data) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE api_keys 
      SET 
        name = ?,
        description = ?,
        can_read_own_uric_acid = ?,
        can_write_own_uric_acid = ?,
        can_read_own_meals = ?,
        can_write_own_meals = ?,
        can_read_all_uric_acid = ?,
        can_read_all_meals = ?,
        is_active = ?
      WHERE id = ?
    `);
    
    await stmt.run(
      data.name,
      data.description || null,
      data.canReadOwnUricAcid ? 1 : 0,
      data.canWriteOwnUricAcid ? 1 : 0,
      data.canReadOwnMeals ? 1 : 0,
      data.canWriteOwnMeals ? 1 : 0,
      data.canReadAllUricAcid ? 1 : 0,
      data.canReadAllMeals ? 1 : 0,
      data.isActive !== false ? 1 : 0,
      id
    );
    
    return await this.findById(id);
  }

  /**
   * Löscht einen API-Key (soft delete)
   */
  static async delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?');
    await stmt.run(id);
    return await this.findById(id);
  }

  /**
   * Prüft ob ein API-Key eine bestimmte Berechtigung hat
   */
  static hasPermission(apiKey, permission) {
    if (!apiKey || !apiKey.isActive) {
      return false;
    }
    
    return apiKey[permission] === true;
  }

  /**
   * Prüft ob ein API-Key Zugriff auf Daten eines bestimmten Users hat
   */
  static canAccessUserData(apiKey, userGuid, requestedGuid) {
    if (!apiKey || !apiKey.isActive) {
      return false;
    }
    
    // Wenn der API-Key Zugriff auf alle Daten hat, ist es erlaubt
    if (apiKey.canReadAllUricAcid || apiKey.canReadAllMeals) {
      return true;
    }
    
    // Ansonsten nur Zugriff auf eigene Daten (GUID muss übereinstimmen)
    return userGuid === requestedGuid;
  }

  static mapRow(row) {
    // Hilfsfunktion zur Konvertierung von Boolean/Integer zu Boolean
    // Unterstützt sowohl SQLite (Integer 0/1) als auch PostgreSQL (Boolean true/false)
    const toBoolean = (value) => {
      // Explizite Prüfungen für verschiedene Formate
      if (value === true || value === 1 || value === '1' || value === 'true') return true;
      if (value === false || value === 0 || value === '0' || value === 'false' || value === null) return false;
      // Für alle anderen Werte: Konvertiere zu Boolean
      return Boolean(value);
    };
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      canReadOwnUricAcid: toBoolean(row.can_read_own_uric_acid),
      canWriteOwnUricAcid: toBoolean(row.can_write_own_uric_acid),
      canReadOwnMeals: toBoolean(row.can_read_own_meals),
      canWriteOwnMeals: toBoolean(row.can_write_own_meals),
      canReadAllUricAcid: toBoolean(row.can_read_all_uric_acid),
      canReadAllMeals: toBoolean(row.can_read_all_meals),
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      isActive: toBoolean(row.is_active)
    };
  }
}

module.exports = ApiKey;

