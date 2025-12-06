const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class Meal {
  static async create(data) {
    const db = getDatabase();
    // Verwende vorhandene ID falls vorhanden (für Backup/Update), sonst neue UUID
    const id = data.id || uuidv4();
    
    // Prüfe ob Mahlzeit bereits existiert
    const existing = await this.findById(id);
    
    if (existing && data.updatedAt) {
      // Wenn Mahlzeit existiert, vergleiche Zeitstempel
      const existingTimestamp = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
      const newTimestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : new Date().getTime();
      
      if (newTimestamp <= existingTimestamp) {
        // Bestehende Mahlzeit ist neuer oder gleich alt, behalte sie
        return existing;
      }
      // Sonst: Update durchführen (implizit durch INSERT OR REPLACE)
    }
    
    // Insert or replace meal (nur wenn neuer oder nicht vorhanden)
    const mealStmt = db.prepare(`
      INSERT OR REPLACE INTO meals (
        id, user_id, timestamp, meal_type, name,
        total_purin, total_uric_acid, total_calories, total_protein, 
        thumbnail_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await mealStmt.run(
      id,
      data.userId,
      data.timestamp,
      data.mealType,
      data.name || null,
      data.totalPurin,
      data.totalUricAcid,
      data.totalCalories,
      data.totalProtein,
      data.thumbnailPath || null
    );
    
    // Lösche alte Komponenten (für Backup: vollständige Synchronisation)
    const deleteComponentsStmt = db.prepare('DELETE FROM meal_components WHERE meal_id = ?');
    await deleteComponentsStmt.run(id);
    
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
        // Stelle sicher, dass numerische Werte auch wirklich Zahlen sind (nicht Boolean oder String)
        // Konvertiere explizit zu Zahlen, um sicherzustellen, dass keine Boolean-Werte oder Strings übergeben werden
        const estimatedWeight = Number(component.estimatedWeight) || 0;
        const purin = Number(component.purin) || 0;
        const uricAcid = Number(component.uricAcid) || 0;
        const calories = Number(component.calories) || 0;
        const protein = Number(component.protein) || 0;
        
        // Unterstütze sowohl foodItemName als auch name (für Rückwärtskompatibilität)
        const foodItemName = component.foodItemName || component.name || '';
        
        if (!foodItemName) {
          throw new Error('foodItemName is required for meal components');
        }
        
        await componentStmt.run(
          componentId,
          id,
          foodItemName,
          estimatedWeight,
          purin,
          uricAcid,
          calories,
          protein
        );
      }
    }
    
    return await this.findById(id);
  }
  
  static async findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meals WHERE id = ?');
    const row = await stmt.get(id);
    if (!row) return null;
    
    const meal = this.mapRow(row);
    // Load components
    meal.components = await this.getComponentsByMealId(id);
    return meal;
  }
  
  static async getComponentsByMealId(mealId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meal_components WHERE meal_id = ? ORDER BY created_at');
    const rows = await stmt.all(mealId);
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
  
  static async findByUserId(userId, options = {}) {
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
    const rows = await stmt.all(...params);
    const meals = [];
    for (const row of rows) {
      const meal = this.mapRow(row);
      // Load components for each meal
      meal.components = await this.getComponentsByMealId(meal.id);
      meals.push(meal);
    }
    return meals;
  }
  
  static async getDietStats(userId, days = 30) {
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
    
    const result = await stmt.get(userId, startDate.toISOString());
    return {
      mealCount: result.meal_count || 0,
      avgPurin: result.avg_purin ? Math.round(result.avg_purin) : 0,
      avgCalories: result.avg_calories ? Math.round(result.avg_calories) : 0,
      avgProtein: result.avg_protein ? parseFloat(result.avg_protein.toFixed(2)) : 0
    };
  }
  
  static async getLastTimestamp(userId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT MAX(timestamp) as lastTimestamp FROM meals WHERE user_id = ?');
    const row = await stmt.get(userId);
    return row?.lastTimestamp || null;
  }
  
  static async delete(id) {
    const db = getDatabase();
    
    // Hole die Mahlzeit, um den Thumbnail-Pfad zu erhalten
    const meal = await this.findById(id);
    
    // Lösche das Thumbnail, falls vorhanden
    if (meal && meal.thumbnailPath) {
      try {
        // Finde die user_id, um den korrekten Pfad zu konstruieren
        const userStmt = db.prepare('SELECT user_id FROM meals WHERE id = ?');
        const userRow = await userStmt.get(id);
        
        if (userRow) {
          const User = require('./User');
          const user = await User.findById(userRow.user_id);
          
          if (user && user.guid) {
            const thumbnailFullPath = path.join(__dirname, '../../data/thumbnails', user.guid, meal.thumbnailPath);
            
            if (fs.existsSync(thumbnailFullPath)) {
              fs.unlinkSync(thumbnailFullPath);
              logger.info(`Deleted thumbnail for meal ${id}: ${meal.thumbnailPath}`);
            }
          }
        }
      } catch (error) {
        logger.error(`Error deleting thumbnail for meal ${id}:`, error);
        // Fahre fort mit dem Löschen der Mahlzeit, auch wenn Thumbnail-Löschung fehlschlägt
      }
    }
    
    // Lösche zuerst alle Komponenten der Mahlzeit
    const deleteComponentsStmt = db.prepare('DELETE FROM meal_components WHERE meal_id = ?');
    await deleteComponentsStmt.run(id);
    
    // Dann lösche die Mahlzeit selbst
    const deleteMealStmt = db.prepare('DELETE FROM meals WHERE id = ?');
    const result = await deleteMealStmt.run(id);
    return result.changes > 0;
  }
  
  static async deleteByUserId(userId) {
    const db = getDatabase();
    // Lösche zuerst alle Komponenten der Mahlzeiten dieses Users
    const mealIdsStmt = db.prepare('SELECT id FROM meals WHERE user_id = ?');
    const mealIds = await mealIdsStmt.all(userId);
    if (mealIds.length > 0) {
      const mealIdPlaceholders = mealIds.map(() => '?').join(',');
      const deleteComponentsStmt = db.prepare(`DELETE FROM meal_components WHERE meal_id IN (${mealIdPlaceholders})`);
      await deleteComponentsStmt.run(...mealIds.map(m => m.id));
    }
    // Dann lösche die Mahlzeiten selbst
    const deleteMealsStmt = db.prepare('DELETE FROM meals WHERE user_id = ?');
    const result = await deleteMealsStmt.run(userId);
    return result.changes;
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
      thumbnailPath: row.thumbnail_path || null,
      createdAt: row.created_at,
      components: [] // Will be populated by findById or findByUserId
    };
  }
}

module.exports = Meal;


