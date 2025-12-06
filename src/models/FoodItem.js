const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class FoodItem {
  static async create(data) {
    const db = getDatabase();
    const id = data.id || uuidv4();
    
    // Prüfe ob FoodItem bereits existiert (über user_id und name, da das der UNIQUE constraint ist)
    const existing = await this.findByUserIdAndName(data.userId, data.name);
    
    if (existing && data.updatedAt) {
      // Wenn FoodItem existiert, vergleiche Zeitstempel
      const existingTimestamp = existing.updatedAt ? new Date(existing.updatedAt).getTime() : new Date(existing.createdAt).getTime();
      const newTimestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : new Date().getTime();
      
      if (newTimestamp <= existingTimestamp) {
        // Bestehendes FoodItem ist neuer oder gleich alt, behalte es
        return existing;
      }
      // Sonst: Update durchführen (implizit durch ON CONFLICT)
    }
    
    const stmt = db.prepare(`
      INSERT INTO food_items (
        id, user_id, name, purin_per_100g, uric_acid_per_100g,
        calories_per_100g, protein_percentage, category, image_path, thumbnail_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, name) DO UPDATE SET
        purin_per_100g = excluded.purin_per_100g,
        uric_acid_per_100g = excluded.uric_acid_per_100g,
        calories_per_100g = excluded.calories_per_100g,
        protein_percentage = excluded.protein_percentage,
        category = excluded.category,
        image_path = excluded.image_path,
        thumbnail_path = excluded.thumbnail_path,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    try {
      await stmt.run(
        id,
        data.userId,
        data.name,
        data.purinPer100g,
        data.uricAcidPer100g,
        data.caloriesPer100g,
        data.proteinPercentage,
        data.category,
        data.imagePath || null,
        data.thumbnailPath || null
      );
    } catch (error) {
      // Wenn INSERT fehlschlägt, versuche den Eintrag über user_id und name zu finden
      const existing = await this.findByUserIdAndName(data.userId, data.name);
      if (existing) {
        return existing;
      }
      throw error;
    }
    
    // Nach INSERT/UPDATE: Finde den Eintrag über user_id und name (da ON CONFLICT die ID ändern könnte)
    const foodItem = await this.findByUserIdAndName(data.userId, data.name);
    if (foodItem) {
      return foodItem;
    }
    
    // Fallback: Versuche über ID zu finden
    const foodItemById = await this.findById(id);
    if (foodItemById) {
      return foodItemById;
    }
    
    // Wenn nichts gefunden wurde, werfe einen Fehler
    throw new Error(`Failed to create or find food item: ${data.name} for user ${data.userId}`);
  }
  
  static async findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM food_items WHERE id = ?');
    const row = await stmt.get(id);
    return row ? this.mapRow(row) : null;
  }
  
  static async findByUserId(userId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM food_items WHERE user_id = ? ORDER BY name ASC');
    const rows = await stmt.all(userId);
    return rows.map(row => this.mapRow(row));
  }
  
  static async findByUserIdAndName(userId, name) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM food_items WHERE user_id = ? AND name = ?');
    const row = await stmt.get(userId, name);
    return row ? this.mapRow(row) : null;
  }
  
  static async update(id, data) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE food_items SET
        name = ?,
        purin_per_100g = ?,
        uric_acid_per_100g = ?,
        calories_per_100g = ?,
        protein_percentage = ?,
        category = ?,
        image_path = ?,
        thumbnail_path = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    await stmt.run(
      data.name,
      data.purinPer100g,
      data.uricAcidPer100g,
      data.caloriesPer100g,
      data.proteinPercentage,
      data.category,
      data.imagePath || null,
      data.thumbnailPath || null,
      id
    );
    
    return await this.findById(id);
  }
  
  static async delete(id) {
    const db = getDatabase();
    
    // Hole das FoodItem, um die Bild-Pfade zu erhalten
    const foodItem = await this.findById(id);
    
    // Lösche die Bilder, falls vorhanden
    if (foodItem) {
      try {
        // Finde die user_id, um den korrekten Pfad zu konstruieren
        const User = require('./User');
        const user = await User.findById(foodItem.userId);
        
        if (user && user.guid) {
          const imagePaths = [foodItem.imagePath, foodItem.thumbnailPath].filter(p => p); // Entferne null/undefined
          
          imagePaths.forEach(imagePath => {
            try {
              const imageFullPath = path.join(__dirname, '../../data/thumbnails', user.guid, imagePath);
              
              if (fs.existsSync(imageFullPath)) {
                fs.unlinkSync(imageFullPath);
                logger.info(`Deleted image for food item ${id}: ${imagePath}`);
              }
            } catch (err) {
              logger.error(`Error deleting image ${imagePath} for food item ${id}:`, err);
            }
          });
        }
      } catch (error) {
        logger.error(`Error deleting images for food item ${id}:`, error);
        // Fahre fort mit dem Löschen des FoodItems, auch wenn Bild-Löschung fehlschlägt
      }
    }
    
    // Lösche das FoodItem aus der Datenbank
    const stmt = db.prepare('DELETE FROM food_items WHERE id = ?');
    const result = await stmt.run(id);
    return result.changes > 0;
  }
  
  static async deleteByUserId(userId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM food_items WHERE user_id = ?');
    const result = await stmt.run(userId);
    return result.changes;
  }
  
  static mapRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      purinPer100g: row.purin_per_100g,
      uricAcidPer100g: row.uric_acid_per_100g,
      caloriesPer100g: row.calories_per_100g,
      proteinPercentage: row.protein_percentage,
      category: row.category,
      imagePath: row.image_path,
      thumbnailPath: row.thumbnail_path || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = FoodItem;

