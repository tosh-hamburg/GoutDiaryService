const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

class UricAcidValue {
  static async create(data) {
    const db = getDatabase();
    // Verwende vorhandene ID falls vorhanden (für Backup/Update), sonst neue UUID
    const id = data.id || uuidv4();
    
    // Prüfe ob Datensatz bereits existiert
    const existing = await this.findById(id);
    
    if (existing && data.updatedAt) {
      // Wenn Datensatz existiert, vergleiche Zeitstempel
      const existingTimestamp = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
      const newTimestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : new Date().getTime();
      
      if (newTimestamp <= existingTimestamp) {
        // Bestehender Datensatz ist neuer oder gleich alt, behalte ihn
        return existing;
      }
      // Sonst: Update durchführen (implizit durch INSERT OR REPLACE)
    }
    
    // Insert or replace (nur wenn neuer oder nicht vorhanden)
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO uric_acid_values (
        id, user_id, timestamp, value, normal, much_meat, much_sport,
        much_sugar, much_alcohol, fasten, gout_attack, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.run(
      id,
      data.userId,
      data.timestamp,
      data.value,
      data.normal ? 1 : 0,
      data.muchMeat ? 1 : 0,
      data.muchSport ? 1 : 0,
      data.muchSugar ? 1 : 0,
      data.muchAlcohol ? 1 : 0,
      data.fasten ? 1 : 0,
      data.goutAttack ? 1 : 0,
      data.notes || null
    );
    
    return await this.findById(id);
  }
  
  static async findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM uric_acid_values WHERE id = ?');
    const row = await stmt.get(id);
    return row ? this.mapRow(row) : null;
  }
  
  static async findByUserId(userId, options = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM uric_acid_values WHERE user_id = ?';
    const params = [userId];

    if (options.startDate) {
      query += ' AND timestamp >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ' AND timestamp <= ?';
      params.push(options.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = db.prepare(query);
    const rows = await stmt.all(...params);
    return rows.map(row => this.mapRow(row));
  }
  
  static async getStats(userId, days = 30) {
    const db = getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Die SQL-Transformation konvertiert gout_attack = 1 zu gout_attack = TRUE für PostgreSQL
    // und CASE WHEN gout_attack zu CASE WHEN gout_attack = TRUE
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as count,
        AVG(value) as average,
        MIN(value) as min,
        MAX(value) as max,
        COUNT(CASE WHEN gout_attack = 1 THEN 1 END) as gout_attacks
      FROM uric_acid_values
      WHERE user_id = ? AND timestamp >= ?
    `);
    
    const result = await stmt.get(userId, startDate.toISOString());
    return {
      count: result.count || 0,
      average: result.average ? parseFloat(result.average.toFixed(2)) : 0,
      min: result.min ? parseFloat(result.min.toFixed(2)) : 0,
      max: result.max ? parseFloat(result.max.toFixed(2)) : 0,
      goutAttacks: result.gout_attacks || 0
    };
  }
  
  static async getLastTimestamp(userId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT MAX(timestamp) as lastTimestamp FROM uric_acid_values WHERE user_id = ?');
    const row = await stmt.get(userId);
    return row?.lastTimestamp || null;
  }
  
  static async delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM uric_acid_values WHERE id = ?');
    const result = await stmt.run(id);
    return result.changes > 0;
  }
  
  static async deleteByUserId(userId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM uric_acid_values WHERE user_id = ?');
    const result = await stmt.run(userId);
    return result.changes;
  }
  
  static mapRow(row) {
    // Helper function to convert database boolean to JavaScript boolean
    // Handles both SQLite (0/1) and PostgreSQL (true/false) representations
    const toBoolean = (value) => {
      if (value === true || value === 1 || value === '1' || value === 'true') return true;
      if (value === false || value === 0 || value === '0' || value === 'false') return false;
      return Boolean(value);
    };
    
    return {
      id: row.id,
      userId: row.user_id,
      timestamp: row.timestamp,
      value: parseFloat(row.value),
      normal: toBoolean(row.normal),
      muchMeat: toBoolean(row.much_meat),
      muchSport: toBoolean(row.much_sport),
      muchSugar: toBoolean(row.much_sugar),
      muchAlcohol: toBoolean(row.much_alcohol),
      fasten: toBoolean(row.fasten),
      goutAttack: toBoolean(row.gout_attack),
      notes: row.notes,
      createdAt: row.created_at
    };
  }
}

module.exports = UricAcidValue;


