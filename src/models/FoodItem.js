const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

class FoodItem {
  static create(data) {
    const db = getDatabase();
    const id = data.id || uuidv4();
    
    // Prüfe ob FoodItem bereits existiert (über user_id und name, da das der UNIQUE constraint ist)
    const existing = this.findByUserIdAndName(data.userId, data.name);
    
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
      stmt.run(
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
      const existing = this.findByUserIdAndName(data.userId, data.name);
      if (existing) {
        return existing;
      }
      throw error;
    }
    
    // Nach INSERT/UPDATE: Finde den Eintrag über user_id und name (da ON CONFLICT die ID ändern könnte)
    const foodItem = this.findByUserIdAndName(data.userId, data.name);
    if (foodItem) {
      return foodItem;
    }
    
    // Fallback: Versuche über ID zu finden
    const foodItemById = this.findById(id);
    if (foodItemById) {
      return foodItemById;
    }
    
    // Wenn nichts gefunden wurde, werfe einen Fehler
    throw new Error(`Failed to create or find food item: ${data.name} for user ${data.userId}`);
  }
  
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM food_items WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }
  
  static findByUserId(userId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM food_items WHERE user_id = ? ORDER BY name ASC');
    const rows = stmt.all(userId);
    return rows.map(row => this.mapRow(row));
  }
  
  static findByUserIdAndName(userId, name) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM food_items WHERE user_id = ? AND name = ?');
    const row = stmt.get(userId, name);
    return row ? this.mapRow(row) : null;
  }
  
  static update(id, data) {
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
    
    stmt.run(
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
    
    return this.findById(id);
  }
  
  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM food_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
  
  static deleteByUserId(userId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM food_items WHERE user_id = ?');
    const result = stmt.run(userId);
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

