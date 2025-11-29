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
  static create(data) {
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
    
    stmt.run(
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
    
    // Gib den API-Key zurück (nur beim Erstellen sichtbar!)
    const apiKey = this.findById(id);
    return {
      ...apiKey,
      key: plainKey // Nur beim Erstellen!
    };
  }

  /**
   * Findet einen API-Key anhand des gehashten Keys
   */
  static findByKeyHash(keyHash) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1');
    const row = stmt.get(keyHash);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Findet einen API-Key anhand des Plain-Text-Keys
   */
  static findByKey(plainKey) {
    const keyHash = this.hashKey(plainKey);
    return this.findByKeyHash(keyHash);
  }

  /**
   * Findet einen API-Key anhand der ID
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Gibt alle API-Keys zurück
   */
  static getAll() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC');
    const rows = stmt.all();
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Aktualisiert die letzte Verwendung eines API-Keys
   */
  static updateLastUsed(id) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Löscht einen API-Key (soft delete)
   */
  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?');
    stmt.run(id);
    return this.findById(id);
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
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      canReadOwnUricAcid: row.can_read_own_uric_acid === 1,
      canWriteOwnUricAcid: row.can_write_own_uric_acid === 1,
      canReadOwnMeals: row.can_read_own_meals === 1,
      canWriteOwnMeals: row.can_write_own_meals === 1,
      canReadAllUricAcid: row.can_read_all_uric_acid === 1,
      canReadAllMeals: row.can_read_all_meals === 1,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      isActive: row.is_active === 1
    };
  }
}

module.exports = ApiKey;

