const Meal = require('../models/Meal');
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
      user = User.create({ guid: userGuid });
      logger.info(`Created new user for GUID: ${userGuid}`);
    }
    
    // Verwende die User-ID (nicht GUID) für Foreign Key
    const userId = user.id;
    
    const data = {
      id: req.body.id || undefined, // ID für Backup/Update (optional)
      userId,
      timestamp: req.body.timestamp || new Date().toISOString(),
      mealType: req.body.mealType,
      name: req.body.name || null,
      totalPurin: parseInt(req.body.totalPurin) || 0,
      totalUricAcid: parseInt(req.body.totalUricAcid) || 0,
      totalCalories: parseInt(req.body.totalCalories) || 0,
      totalProtein: parseFloat(req.body.totalProtein) || 0,
      components: req.body.components || [], // Array of meal components
      thumbnailBase64: req.body.thumbnailBase64 || null // Base64-kodiertes Thumbnail (optional)
    };
    
    // Validation
    if (!['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].includes(data.mealType)) {
      return res.status(400).json({ 
        error: 'Invalid mealType. Must be BREAKFAST, LUNCH, DINNER, or SNACK' 
      });
    }
    
    const meal = Meal.create(data);
    
    logger.info(`Created meal for user ${userGuid} (id: ${userId})`, { mealId: meal.id });
    
    res.status(201).json({
      success: true,
      data: meal
    });
  } catch (error) {
    logger.error('Error creating meal:', error);
    next(error);
  }
};

exports.getAll = (req, res, next) => {
  try {
    const userGuid = req.query.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const { startDate, endDate, limit } = req.query;
    
    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);
    
    const meals = Meal.findByUserId(userId, options);
    
    res.json({
      success: true,
      count: meals.length,
      data: meals
    });
  } catch (error) {
    logger.error('Error fetching meals:', error);
    next(error);
  }
};

exports.getDietStats = (req, res, next) => {
  try {
    const userGuid = req.query.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const days = parseInt(req.query.days) || 30;
    
    const stats = Meal.getDietStats(userId, days);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching diet stats:', error);
    next(error);
  }
};

exports.getLastTimestamp = (req, res, next) => {
  try {
    const userGuid = req.query.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const lastTimestamp = Meal.getLastTimestamp(userId);
    
    res.json({
      success: true,
      data: {
        lastTimestamp: lastTimestamp
      }
    });
  } catch (error) {
    logger.error('Error fetching last meal timestamp:', error);
    next(error);
  }
};


