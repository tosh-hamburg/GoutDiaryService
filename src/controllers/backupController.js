const UricAcidValue = require('../models/UricAcidValue');
const Meal = require('../models/Meal');
const FoodItem = require('../models/FoodItem');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Gibt Metadaten über die verfügbaren Backups für einen User zurück
 * (Datum des letzten Backups, Anzahl der Datensätze, etc.)
 */
exports.getBackupMetadata = async (req, res, next) => {
  try {
    const userGuid = req.query.userId;
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    const user = await User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    
    // Hole letzte Timestamps
    const lastUricAcidTimestamp = await UricAcidValue.getLastTimestamp(userId);
    const lastMealTimestamp = await Meal.getLastTimestamp(userId);
    
    // Zähle Datensätze
    const uricAcidValues = await UricAcidValue.findByUserId(userId);
    const meals = await Meal.findByUserId(userId);
    const foodItems = await FoodItem.findByUserId(userId);
    const uricAcidCount = uricAcidValues.length;
    const mealCount = meals.length;
    const foodItemCount = foodItems.length;
    
    res.json({
      success: true,
      data: {
        lastUricAcidTimestamp: lastUricAcidTimestamp,
        lastMealTimestamp: lastMealTimestamp,
        uricAcidCount,
        mealCount,
        foodItemCount,
        lastBackupDate: lastUricAcidTimestamp || lastMealTimestamp || null
      }
    });
  } catch (error) {
    logger.error('Error getting backup metadata:', error);
    next(error);
  }
};

/**
 * Gibt eine Liste der verfügbaren Backups zurück (basierend auf Timestamps)
 */
exports.listBackups = async (req, res, next) => {
  try {
    const userGuid = req.query.userId;
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    const user = await User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    
    // Hole letzte Timestamps als Backup-Zeitpunkte
    const lastUricAcidTimestamp = await UricAcidValue.getLastTimestamp(userId);
    const lastMealTimestamp = await Meal.getLastTimestamp(userId);
    
    const backups = [];
    
    if (lastUricAcidTimestamp || lastMealTimestamp) {
      // Erstelle ein Backup-Eintrag basierend auf dem neuesten Timestamp
      const backupDate = lastUricAcidTimestamp && lastMealTimestamp
        ? (new Date(lastUricAcidTimestamp) > new Date(lastMealTimestamp) ? lastUricAcidTimestamp : lastMealTimestamp)
        : (lastUricAcidTimestamp || lastMealTimestamp);
      
      const uricAcidValues = await UricAcidValue.findByUserId(userId);
      const meals = await Meal.findByUserId(userId);
      const foodItems = await FoodItem.findByUserId(userId);
      const uricAcidCount = uricAcidValues.length;
      const mealCount = meals.length;
      const foodItemCount = foodItems.length;
      
      backups.push({
        id: 'service_backup_latest',
        type: 'service',
        timestamp: backupDate,
        uricAcidCount,
        mealCount,
        foodItemCount,
        description: 'Letztes Service-Backup'
      });
    }
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    logger.error('Error listing backups:', error);
    next(error);
  }
};

















