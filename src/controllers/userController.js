const User = require('../models/User');
const logger = require('../utils/logger');

exports.register = (req, res, next) => {
  try {
    const { guid, gender, birthYear, lastBackupTimestamp } = req.body;
    
    // Validation
    if (!guid) {
      return res.status(400).json({ error: 'GUID is required' });
    }
    
    if (gender && !['MALE', 'FEMALE', 'DIVERSE'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender. Must be MALE, FEMALE, or DIVERSE' });
    }
    
    if (birthYear && (birthYear < 1900 || birthYear > new Date().getFullYear())) {
      return res.status(400).json({ error: 'Invalid birth year' });
    }
    
    const user = User.createOrUpdate({
      guid,
      gender,
      birthYear: birthYear ? parseInt(birthYear) : null,
      lastBackupTimestamp: lastBackupTimestamp || null
    });
    
    logger.info(`User registered/updated: ${guid}`, { 
      gender, 
      birthYear, 
      lastBackupTimestamp,
      savedLastBackupTimestamp: user?.lastBackupTimestamp 
    });
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error registering user:', error);
    next(error);
  }
};

exports.getCurrentUser = (req, res, next) => {
  try {
    // GUID aus dem Request Body oder Query Parameter (wird von der App übergeben)
    const userGuid = req.body.userId || req.query.userId || req.apiKey?.userId;
    
    if (!userGuid) {
      return res.status(400).json({
        success: false,
        error: 'userId (GUID) is required'
      });
    }
    
    const user = User.findByGuid(userGuid);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    logger.debug(`getCurrentUser: Returning user ${userGuid} with lastBackupTimestamp: ${user.lastBackupTimestamp}`);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching current user:', error);
    next(error);
  }
};

exports.getByGuid = (req, res, next) => {
  try {
    const { guid } = req.params;
    
    const user = User.findByGuid(guid);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    next(error);
  }
};

exports.update = (req, res, next) => {
  try {
    const { guid } = req.params;
    const { gender, birthYear, lastBackupTimestamp } = req.body;
    
    // Validation
    if (gender && !['MALE', 'FEMALE', 'DIVERSE'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender. Must be MALE, FEMALE, or DIVERSE' });
    }
    
    if (birthYear && (birthYear < 1900 || birthYear > new Date().getFullYear())) {
      return res.status(400).json({ error: 'Invalid birth year' });
    }
    
    const user = User.update(guid, {
      gender,
      birthYear: birthYear ? parseInt(birthYear) : null,
      lastBackupTimestamp: lastBackupTimestamp || null
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    logger.info(`User updated: ${guid}`, { gender, birthYear, lastBackupTimestamp });
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    next(error);
  }
};

exports.getAll = (req, res, next) => {
  try {
    const users = User.getAll();
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching all users:', error);
    next(error);
  }
};

/**
 * Gibt alle User-GUIDs zurück (nur für Admin-API-Keys)
 * Erfordert einen API-Key mit canReadAllUricAcid oder canReadAllMeals Berechtigung
 */
exports.getAllGuids = (req, res, next) => {
  try {
    // Prüfe ob API-Key Admin-Berechtigung hat
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required'
      });
    }
    
    // Prüfe ob API-Key Admin-Berechtigung hat (canReadAllUricAcid oder canReadAllMeals)
    const hasAdminPermission = req.apiKey.canReadAllUricAcid || req.apiKey.canReadAllMeals;
    
    if (!hasAdminPermission) {
      logger.warn(`API key ${req.apiKey.name} (ID: ${req.apiKey.id}) attempted to access all user GUIDs without admin permission`);
      return res.status(403).json({
        success: false,
        error: 'Admin API key required. This endpoint requires canReadAllUricAcid or canReadAllMeals permission.'
      });
    }
    
    const users = User.getAll();
    const guids = users.map(user => user.guid);
    
    logger.info(`Admin API key ${req.apiKey.name} (ID: ${req.apiKey.id}) retrieved ${guids.length} user GUIDs`);
    
    res.json(guids);
  } catch (error) {
    logger.error('Error fetching all user GUIDs:', error);
    next(error);
  }
};

/**
 * Löscht alle Backup-Daten eines Users
 * Löscht: Harnsäurewerte, Mahlzeiten, FoodItems, Thumbnails
 * Kann entweder über /users/:guid/backup-data (Admin) oder /users/delete-all (User selbst) aufgerufen werden
 */
exports.deleteAllUserData = (req, res, next) => {
  try {
    // GUID kann aus params (Admin-Route) oder aus Header (User-Route) kommen
    const guid = req.params.guid || req.headers['x-user-guid'] || req.headers['X-User-Guid'];
    
    if (!guid) {
      return res.status(400).json({
        success: false,
        error: 'GUID is required'
      });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(guid);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userId = user.id;
    const fs = require('fs');
    const path = require('path');
    
    // Lösche alle Daten des Users
    const UricAcidValue = require('../models/UricAcidValue');
    const Meal = require('../models/Meal');
    const FoodItem = require('../models/FoodItem');
    
    const deletedUricAcid = UricAcidValue.deleteByUserId(userId);
    const deletedMeals = Meal.deleteByUserId(userId);
    const deletedFoodItems = FoodItem.deleteByUserId(userId);
    
    // Lösche Thumbnails-Verzeichnis
    let deletedThumbnails = 0;
    try {
      const thumbnailsDir = path.join(__dirname, '../../data/thumbnails', guid);
      if (fs.existsSync(thumbnailsDir)) {
        // Lösche alle Dateien rekursiv
        const deleteRecursive = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              deleteRecursive(fullPath);
              try {
                fs.rmdirSync(fullPath);
              } catch (e) {
                // Verzeichnis könnte bereits leer sein
              }
            } else {
              fs.unlinkSync(fullPath);
              deletedThumbnails++;
            }
          }
        };
        
        deleteRecursive(thumbnailsDir);
        try {
          fs.rmdirSync(thumbnailsDir);
        } catch (e) {
          // Verzeichnis könnte bereits leer sein
        }
      }
    } catch (thumbError) {
      logger.warn(`Error deleting thumbnails for user ${guid}:`, thumbError);
    }
    
    // Lösche auch den Benutzer-Eintrag selbst
    const db = require('../database').getDatabase();
    const deleteUserStmt = db.prepare('DELETE FROM users WHERE guid = ?');
    deleteUserStmt.run(guid);
    
    logger.info(`Deleted all backup data and user entry for user ${guid}`, {
      deletedUricAcid,
      deletedMeals,
      deletedFoodItems,
      deletedThumbnails,
      userDeleted: true
    });
    
    res.json({
      success: true,
      message: 'User and all backup data deleted successfully',
      data: {
        deletedUricAcid,
        deletedMeals,
        deletedFoodItems,
        deletedThumbnails,
        userDeleted: true
      }
    });
  } catch (error) {
    logger.error('Error deleting user backup data:', error);
    next(error);
  }
};

