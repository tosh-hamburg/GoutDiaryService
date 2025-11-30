/**
 * Admin-Route für Dubletten-Bereinigung
 * 
 * Verwendung:
 * 1. Diese Datei nach src/routes/admin.js kopieren oder
 * 2. In bestehende Admin-Route integrieren
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../../database');
const logger = require('../../utils/logger');

/**
 * Bereinigt Dubletten in allen Tabellen
 * POST /api/v1/admin/deduplicate
 * 
 * Request Body:
 * {
 *   "table": "uric_acid_values" | "meals" | "food_items" | "all",
 *   "dryRun": true | false  // Wenn true, werden keine Daten gelöscht, nur Statistiken zurückgegeben
 * }
 */
router.post('/deduplicate', async (req, res, next) => {
  try {
    const { table = 'all', dryRun = false } = req.body;
    const db = getDatabase();
    
    const results = {};
    let totalDeletedImages = 0;
    
    if (table === 'all' || table === 'uric_acid_values') {
      results.uricAcidValues = await deduplicateUricAcidValues(db, dryRun);
    }
    
    if (table === 'all' || table === 'meals') {
      results.meals = await deduplicateMeals(db, dryRun);
      if (results.meals.deletedImages) {
        totalDeletedImages += results.meals.deletedImages;
      }
    }
    
    if (table === 'all' || table === 'food_items') {
      results.foodItems = await deduplicateFoodItems(db, dryRun);
      if (results.foodItems.deletedImages) {
        totalDeletedImages += results.foodItems.deletedImages;
      }
    }
    
    res.json({
      success: true,
      dryRun,
      totalDeletedImages: dryRun ? 0 : totalDeletedImages,
      results
    });
  } catch (error) {
    logger.error('Error during deduplication:', error);
    next(error);
  }
});

/**
 * Bereinigt Dubletten in uric_acid_values
 * Dubletten sind Einträge mit identischem userId, timestamp und value
 */
async function deduplicateUricAcidValues(db, dryRun) {
  // Finde Dubletten: gleicher userId, timestamp und value
  const duplicates = db.prepare(`
    SELECT 
      user_id,
      timestamp,
      value,
      COUNT(*) as count,
      GROUP_CONCAT(id) as ids
    FROM uric_acid_values
    GROUP BY user_id, timestamp, value
    HAVING COUNT(*) > 1
  `).all();
  
  let deletedCount = 0;
  const duplicateGroups = [];
  
  for (const group of duplicates) {
    const ids = group.ids.split(',').map(id => id.trim());
    // Behalte den ersten Eintrag (älteste ID), lösche die restlichen
    const idsToDelete = ids.slice(1);
    
    duplicateGroups.push({
      userId: group.user_id,
      timestamp: group.timestamp,
      value: group.value,
      totalCount: group.count,
      keptId: ids[0],
      deletedIds: idsToDelete
    });
    
    if (!dryRun && idsToDelete.length > 0) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      const deleteStmt = db.prepare(`DELETE FROM uric_acid_values WHERE id IN (${placeholders})`);
      deleteStmt.run(...idsToDelete);
      deletedCount += idsToDelete.length;
    }
  }
  
  return {
    duplicateGroups: duplicateGroups.length,
    totalDuplicates: duplicates.reduce((sum, g) => sum + (g.count - 1), 0),
    deletedCount: dryRun ? 0 : deletedCount,
    groups: duplicateGroups
  };
}

/**
 * Bereinigt Dubletten in meals
 * Dubletten sind Einträge mit identischem userId, timestamp und meal_type
 * Berücksichtigt auch Bilder (photo_path, thumbnail_path)
 */
async function deduplicateMeals(db, dryRun) {
  // Finde Dubletten: gleicher userId, timestamp und meal_type
  const duplicates = db.prepare(`
    SELECT 
      user_id,
      timestamp,
      meal_type,
      COUNT(*) as count,
      GROUP_CONCAT(id) as ids
    FROM meals
    GROUP BY user_id, timestamp, meal_type
    HAVING COUNT(*) > 1
  `).all();
  
  let deletedCount = 0;
  let deletedImages = 0;
  const duplicateGroups = [];
  const fs = require('fs');
  const path = require('path');
  
  for (const group of duplicates) {
    const ids = group.ids.split(',').map(id => id.trim());
    
    // Lade alle Mahlzeiten dieser Gruppe mit ihren Bildpfaden
    const placeholders = ids.map(() => '?').join(',');
    const meals = db.prepare(`
      SELECT id, photo_path, thumbnail_path
      FROM meals
      WHERE id IN (${placeholders})
      ORDER BY id ASC
    `).all(...ids);
    
    // Behalte den ersten Eintrag (älteste ID), lösche die restlichen
    const keptMeal = meals[0];
    const mealsToDelete = meals.slice(1);
    const idsToDelete = mealsToDelete.map(m => m.id);
    
    // Sammle alle Bildpfade der zu löschenden Mahlzeiten
    const imagesToCheck = [];
    mealsToDelete.forEach(meal => {
      if (meal.photo_path) imagesToCheck.push({ path: meal.photo_path, type: 'photo' });
      if (meal.thumbnail_path) imagesToCheck.push({ path: meal.thumbnail_path, type: 'thumbnail' });
    });
    
    // Prüfe, ob die Bilder auch von anderen Mahlzeiten verwendet werden
    const imagesToDelete = [];
    for (const img of imagesToCheck) {
      if (!img.path) continue;
      
      // Prüfe, ob andere Mahlzeiten (außer denen, die gelöscht werden) dieses Bild verwenden
      const otherMealsWithSameImage = db.prepare(`
        SELECT COUNT(*) as count
        FROM meals
        WHERE (photo_path = ? OR thumbnail_path = ?)
          AND id NOT IN (${placeholders})
      `).get(img.path, img.path, ...idsToDelete);
      
      // Wenn keine anderen Mahlzeiten dieses Bild verwenden, kann es gelöscht werden
      if (otherMealsWithSameImage.count === 0) {
        imagesToDelete.push(img.path);
      }
    }
    
    duplicateGroups.push({
      userId: group.user_id,
      timestamp: group.timestamp,
      mealType: group.meal_type,
      totalCount: group.count,
      keptId: keptMeal.id,
      deletedIds: idsToDelete,
      imagesToDelete: imagesToDelete.length
    });
    
    if (!dryRun && idsToDelete.length > 0) {
      // Lösche zuerst die Komponenten
      const deleteComponentsStmt = db.prepare(`DELETE FROM meal_components WHERE meal_id IN (${placeholders})`);
      deleteComponentsStmt.run(...idsToDelete);
      
      // Lösche Bilder, die nicht mehr verwendet werden
      for (const imagePath of imagesToDelete) {
        try {
          // Prüfe, ob es ein absoluter oder relativer Pfad ist
          const fullPath = path.isAbsolute(imagePath) 
            ? imagePath 
            : path.join(process.cwd(), imagePath);
          
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            deletedImages++;
            logger.info(`Gelöschtes Bild: ${fullPath}`);
          }
        } catch (error) {
          logger.warn(`Fehler beim Löschen des Bildes ${imagePath}:`, error.message);
        }
      }
      
      // Dann die Mahlzeiten
      const deleteMealsStmt = db.prepare(`DELETE FROM meals WHERE id IN (${placeholders})`);
      deleteMealsStmt.run(...idsToDelete);
      deletedCount += idsToDelete.length;
    }
  }
  
  return {
    duplicateGroups: duplicateGroups.length,
    totalDuplicates: duplicates.reduce((sum, g) => sum + (g.count - 1), 0),
    deletedCount: dryRun ? 0 : deletedCount,
    deletedImages: dryRun ? 0 : deletedImages,
    groups: duplicateGroups
  };
}

/**
 * Bereinigt Dubletten in food_items
 * Dubletten sind Einträge mit identischem userId und name
 * Berücksichtigt auch Bilder (image_path)
 */
async function deduplicateFoodItems(db, dryRun) {
  // Finde Dubletten: gleicher userId und name
  const duplicates = db.prepare(`
    SELECT 
      user_id,
      name,
      COUNT(*) as count,
      GROUP_CONCAT(id) as ids
    FROM food_items
    GROUP BY user_id, name
    HAVING COUNT(*) > 1
  `).all();
  
  let deletedCount = 0;
  let deletedImages = 0;
  const duplicateGroups = [];
  const fs = require('fs');
  const path = require('path');
  
  for (const group of duplicates) {
    const ids = group.ids.split(',').map(id => id.trim());
    
    // Sortiere nach updated_at (neueste zuerst), behalte den neuesten
    const placeholders = ids.map(() => '?').join(',');
    const itemsWithDates = db.prepare(`
      SELECT id, updated_at, image_path
      FROM food_items
      WHERE id IN (${placeholders})
      ORDER BY updated_at DESC
    `).all(...ids);
    
    if (itemsWithDates.length > 1) {
      const keptItem = itemsWithDates[0];
      const itemsToDelete = itemsWithDates.slice(1);
      const idsToDelete = itemsToDelete.map(item => item.id);
      
      // Sammle alle Bildpfade der zu löschenden Items
      const imagesToCheck = [];
      itemsToDelete.forEach(item => {
        if (item.image_path) imagesToCheck.push(item.image_path);
      });
      
      // Prüfe, ob die Bilder auch von anderen FoodItems verwendet werden
      const imagesToDelete = [];
      for (const imagePath of imagesToCheck) {
        if (!imagePath) continue;
        
        // Prüfe, ob andere FoodItems (außer denen, die gelöscht werden) dieses Bild verwenden
        const deletePlaceholders = idsToDelete.map(() => '?').join(',');
        const otherItemsWithSameImage = db.prepare(`
          SELECT COUNT(*) as count
          FROM food_items
          WHERE image_path = ?
            AND id NOT IN (${deletePlaceholders})
        `).get(imagePath, ...idsToDelete);
        
        // Wenn keine anderen Items dieses Bild verwenden, kann es gelöscht werden
        if (otherItemsWithSameImage.count === 0) {
          imagesToDelete.push(imagePath);
        }
      }
      
      duplicateGroups.push({
        userId: group.user_id,
        name: group.name,
        totalCount: group.count,
        keptId: keptItem.id,
        deletedIds: idsToDelete,
        imagesToDelete: imagesToDelete.length
      });
      
      if (!dryRun && idsToDelete.length > 0) {
        // Lösche Bilder, die nicht mehr verwendet werden
        for (const imagePath of imagesToDelete) {
          try {
            // Prüfe, ob es ein absoluter oder relativer Pfad ist
            const fullPath = path.isAbsolute(imagePath) 
              ? imagePath 
              : path.join(process.cwd(), imagePath);
            
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              deletedImages++;
              logger.info(`Gelöschtes Bild: ${fullPath}`);
            }
          } catch (error) {
            logger.warn(`Fehler beim Löschen des Bildes ${imagePath}:`, error.message);
          }
        }
        
        // Dann die FoodItems
        const deletePlaceholders = idsToDelete.map(() => '?').join(',');
        const deleteStmt = db.prepare(`DELETE FROM food_items WHERE id IN (${deletePlaceholders})`);
        deleteStmt.run(...idsToDelete);
        deletedCount += idsToDelete.length;
      }
    }
  }
  
  return {
    duplicateGroups: duplicateGroups.length,
    totalDuplicates: duplicates.reduce((sum, g) => sum + (g.count - 1), 0),
    deletedCount: dryRun ? 0 : deletedCount,
    deletedImages: dryRun ? 0 : deletedImages,
    groups: duplicateGroups
  };
}

module.exports = router;

