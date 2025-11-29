const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

class UricAcidValue {
  static create(data) {
    const db = getDatabase();
    // Verwende vorhandene ID falls vorhanden (für Backup/Update), sonst neue UUID
    const id = data.id || uuidv4();
    
    // Insert or replace (für Backup: überschreibt bestehende Einträge)
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO uric_acid_values (
        id, user_id, timestamp, value, normal, much_meat, much_sport,
        much_sugar, much_alcohol, fasten, gout_attack, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
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
    
    return this.findById(id);
  }
  
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM uric_acid_values WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }
  
  static findByUserId(userId, options = {}) {
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
    const rows = stmt.all(...params);
    return rows.map(row => this.mapRow(row));
  }
  
  static getStats(userId, days = 30) {
    const db = getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as count,
        AVG(value) as average,
        MIN(value) as min,
        MAX(value) as max,
        SUM(gout_attack) as gout_attacks
      FROM uric_acid_values
      WHERE user_id = ? AND timestamp >= ?
    `);
    
    const result = stmt.get(userId, startDate.toISOString());
    return {
      count: result.count || 0,
      average: result.average ? parseFloat(result.average.toFixed(2)) : 0,
      min: result.min ? parseFloat(result.min.toFixed(2)) : 0,
      max: result.max ? parseFloat(result.max.toFixed(2)) : 0,
      goutAttacks: result.gout_attacks || 0
    };
  }
  
  static getLastTimestamp(userId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT MAX(timestamp) as lastTimestamp FROM uric_acid_values WHERE user_id = ?');
    const row = stmt.get(userId);
    return row?.lastTimestamp || null;
  }
  
  static mapRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      timestamp: row.timestamp,
      value: parseFloat(row.value),
      normal: row.normal === 1,
      muchMeat: row.much_meat === 1,
      muchSport: row.much_sport === 1,
      muchSugar: row.much_sugar === 1,
      muchAlcohol: row.much_alcohol === 1,
      fasten: row.fasten === 1,
      goutAttack: row.gout_attack === 1,
      notes: row.notes,
      createdAt: row.created_at
    };
  }
}

module.exports = UricAcidValue;


