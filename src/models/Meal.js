const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

class Meal {
  static create(data) {
    const db = getDatabase();
    // Verwende vorhandene ID falls vorhanden (für Backup/Update), sonst neue UUID
    const id = data.id || uuidv4();
    
    // Insert or replace meal (für Backup: überschreibt bestehende Einträge)
    const mealStmt = db.prepare(`
      INSERT OR REPLACE INTO meals (
        id, user_id, timestamp, meal_type, name,
        total_purin, total_uric_acid, total_calories, total_protein, thumbnail_base64
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    mealStmt.run(
      id,
      data.userId,
      data.timestamp,
      data.mealType,
      data.name || null,
      data.totalPurin,
      data.totalUricAcid,
      data.totalCalories,
      data.totalProtein,
      data.thumbnailBase64 || null
    );
    
    // Lösche alte Komponenten (für Backup: vollständige Synchronisation)
    const deleteComponentsStmt = db.prepare('DELETE FROM meal_components WHERE meal_id = ?');
    deleteComponentsStmt.run(id);
    
    // Insert components if provided
    if (data.components && Array.isArray(data.components) && data.components.length > 0) {
      const componentStmt = db.prepare(`
        INSERT INTO meal_components (
          id, meal_id, food_item_name, estimated_weight,
          purin, uric_acid, calories, protein
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const component of data.components) {
        const componentId = component.id || uuidv4();
        componentStmt.run(
          componentId,
          id,
          component.foodItemName,
          component.estimatedWeight || 0,
          component.purin || 0,
          component.uricAcid || 0,
          component.calories || 0,
          component.protein || 0
        );
      }
    }
    
    return this.findById(id);
  }
  
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meals WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    
    const meal = this.mapRow(row);
    // Load components
    meal.components = this.getComponentsByMealId(id);
    return meal;
  }
  
  static getComponentsByMealId(mealId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meal_components WHERE meal_id = ? ORDER BY created_at');
    const rows = stmt.all(mealId);
    return rows.map(row => ({
      id: row.id,
      mealId: row.meal_id,
      foodItemName: row.food_item_name,
      estimatedWeight: row.estimated_weight,
      purin: row.purin,
      uricAcid: row.uric_acid,
      calories: row.calories,
      protein: parseFloat(row.protein)
    }));
  }
  
  static findByUserId(userId, options = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM meals WHERE user_id = ?';
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
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(row => {
      const meal = this.mapRow(row);
      // Load components for each meal
      meal.components = this.getComponentsByMealId(meal.id);
      return meal;
    });
  }
  
  static getDietStats(userId, days = 30) {
    const db = getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as meal_count,
        AVG(total_purin) as avg_purin,
        AVG(total_calories) as avg_calories,
        AVG(total_protein) as avg_protein
      FROM meals
      WHERE user_id = ? AND timestamp >= ?
    `);
    
    const result = stmt.get(userId, startDate.toISOString());
    return {
      mealCount: result.meal_count || 0,
      avgPurin: result.avg_purin ? Math.round(result.avg_purin) : 0,
      avgCalories: result.avg_calories ? Math.round(result.avg_calories) : 0,
      avgProtein: result.avg_protein ? parseFloat(result.avg_protein.toFixed(2)) : 0
    };
  }
  
  static getLastTimestamp(userId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT MAX(timestamp) as lastTimestamp FROM meals WHERE user_id = ?');
    const row = stmt.get(userId);
    return row?.lastTimestamp || null;
  }
  
  static mapRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      timestamp: row.timestamp,
      mealType: row.meal_type,
      name: row.name,
      totalPurin: row.total_purin,
      totalUricAcid: row.total_uric_acid,
      totalCalories: row.total_calories,
      totalProtein: parseFloat(row.total_protein),
      thumbnailBase64: row.thumbnail_base64 || null,
      createdAt: row.created_at,
      components: [] // Will be populated by findById or findByUserId
    };
  }
}

module.exports = Meal;


