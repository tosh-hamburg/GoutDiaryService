const FoodItem = require('../models/FoodItem');
const User = require('../models/User');
const logger = require('../utils/logger');

exports.create = (req, res, next) => {
  try {
    const userGuid = req.body.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde oder erstelle User anhand der GUID
    let user = User.findByGuid(userGuid);
    if (!user) {
      // User existiert nicht, erstelle ihn
      try {
        user = User.create({ guid: userGuid });
        logger.info(`Created new user for GUID: ${userGuid}`);
      } catch (createError) {
        // User könnte bereits existieren (Race Condition), versuche nochmal zu finden
        logger.warn(`Error creating user, trying to find again: ${createError.message}`);
        user = User.findByGuid(userGuid);
        if (!user) {
          logger.error(`Failed to create or find user for GUID: ${userGuid}`);
          return res.status(500).json({ error: 'Failed to create or find user' });
        }
      }
    }
    
    // Prüfe ob user korrekt gesetzt wurde
    if (!user || !user.id) {
      logger.error(`User object is invalid for GUID: ${userGuid}`);
      return res.status(500).json({ error: 'User object is invalid' });
    }
    
    // Verwende die User-ID (nicht GUID) für Foreign Key
    const userId = user.id;
    
    const data = {
      id: req.body.id || undefined, // Wenn ID mitgesendet wird, verwende sie
      userId,
      name: req.body.name,
      purinPer100g: parseInt(req.body.purinPer100g) || 0,
      uricAcidPer100g: parseInt(req.body.uricAcidPer100g) || 0,
      caloriesPer100g: parseInt(req.body.caloriesPer100g) || 0,
      proteinPercentage: parseFloat(req.body.proteinPercentage) || 0,
      category: req.body.category,
      imagePath: req.body.imagePath || null, // Fallback für alte Clients
      thumbnailBase64: req.body.thumbnailBase64 || null // Base64-kodiertes Thumbnail (optional, hat Priorität)
    };
    
    // Validation
    if (!data.name || data.name.trim() === '') {
      return res.status(400).json({ error: 'name is required' });
    }
    
    if (!data.category) {
      return res.status(400).json({ error: 'category is required' });
    }
    
    const foodItem = FoodItem.create(data);
    
    if (!foodItem || !foodItem.id) {
      logger.error(`Failed to create food item: ${data.name} for user ${userGuid}`);
      return res.status(500).json({ error: 'Failed to create food item' });
    }
    
    logger.info(`Created/updated food item for user ${userGuid} (id: ${userId})`, { foodItemId: foodItem.id, name: foodItem.name });
    
    res.status(201).json({
      success: true,
      data: foodItem
    });
  } catch (error) {
    logger.error('Error creating food item:', error);
    next(error);
  }
};

exports.getAll = (req, res, next) => {
  try {
    const userGuid = req.query.userId; // userId ist eigentlich die GUID
    const apiKey = req.apiKey;
    const isSessionAuth = req.isSessionAuth;
    const isAdmin = req.user && req.user.isAdmin;
    
    // Prüfe Berechtigungen
    if (isSessionAuth && isAdmin) {
      // Session-Auth als Admin: userId ist erforderlich (Web-UI zeigt Daten für einen bestimmten User)
      if (!userGuid) {
        return res.status(400).json({ error: 'userId (GUID) is required' });
      }
    } else if (apiKey) {
      // API-Key-Authentifizierung: userId ist erforderlich
      if (!userGuid) {
        return res.status(400).json({ error: 'userId (GUID) is required' });
      }
      
      // Prüfe ob API-Key Zugriff auf diese User-Daten hat
      if (apiKey.userId && apiKey.userId !== userGuid) {
        // API-Key ist an einen bestimmten User gebunden
        if (apiKey.userId !== userGuid) {
          return res.status(403).json({ error: 'Access denied: API key is bound to a different user' });
        }
      }
    } else {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const foodItems = FoodItem.findByUserId(userId);
    
    res.json({
      success: true,
      count: foodItems.length,
      data: foodItems
    });
  } catch (error) {
    logger.error('Error fetching food items:', error);
    next(error);
  }
};

exports.update = (req, res, next) => {
  try {
    const foodItemId = req.params.id;
    const userGuid = req.body.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prüfe ob FoodItem existiert und dem User gehört
    const existingFoodItem = FoodItem.findById(foodItemId);
    if (!existingFoodItem) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    
    if (existingFoodItem.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied: Food item belongs to a different user' });
    }
    
    const data = {
      name: req.body.name,
      purinPer100g: parseInt(req.body.purinPer100g) || 0,
      uricAcidPer100g: parseInt(req.body.uricAcidPer100g) || 0,
      caloriesPer100g: parseInt(req.body.caloriesPer100g) || 0,
      proteinPercentage: parseFloat(req.body.proteinPercentage) || 0,
      category: req.body.category,
      imagePath: req.body.imagePath || null, // Fallback für alte Clients
      thumbnailBase64: req.body.thumbnailBase64 || null // Base64-kodiertes Thumbnail (optional, hat Priorität)
    };
    
    // Validation
    if (!data.name || data.name.trim() === '') {
      return res.status(400).json({ error: 'name is required' });
    }
    
    if (!data.category) {
      return res.status(400).json({ error: 'category is required' });
    }
    
    const foodItem = FoodItem.update(foodItemId, data);
    
    logger.info(`Updated food item ${foodItemId} for user ${userGuid}`);
    
    res.json({
      success: true,
      data: foodItem
    });
  } catch (error) {
    logger.error('Error updating food item:', error);
    next(error);
  }
};

exports.delete = (req, res, next) => {
  try {
    const foodItemId = req.params.id;
    const userGuid = req.query.userId || req.body.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prüfe ob FoodItem existiert und dem User gehört
    const existingFoodItem = FoodItem.findById(foodItemId);
    if (!existingFoodItem) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    
    if (existingFoodItem.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied: Food item belongs to a different user' });
    }
    
    const deleted = FoodItem.delete(foodItemId);
    
    if (deleted) {
      logger.info(`Deleted food item ${foodItemId} for user ${userGuid}`);
      res.json({
        success: true,
        message: 'Food item deleted successfully'
      });
    } else {
      res.status(404).json({ error: 'Food item not found' });
    }
  } catch (error) {
    logger.error('Error deleting food item:', error);
    next(error);
  }
};

