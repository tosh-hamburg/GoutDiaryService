const UricAcidValue = require('../models/UricAcidValue');
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
      value: parseFloat(req.body.value),
      normal: req.body.normal || false,
      muchMeat: req.body.muchMeat || false,
      muchSport: req.body.muchSport || false,
      muchSugar: req.body.muchSugar || false,
      muchAlcohol: req.body.muchAlcohol || false,
      fasten: req.body.fasten || false,
      goutAttack: req.body.goutAttack || false,
      notes: req.body.notes || null
    };
    
    // Validation
    if (!data.value || data.value < 0 || data.value > 20) {
      return res.status(400).json({ error: 'Invalid value. Must be between 0 and 20 mg/dL' });
    }
    
    const uricAcidValue = UricAcidValue.create(data);
    
    logger.info(`Created uric acid value for user ${userGuid} (id: ${userId})`, { valueId: uricAcidValue.id });
    
    res.status(201).json({
      success: true,
      data: uricAcidValue
    });
  } catch (error) {
    logger.error('Error creating uric acid value:', error);
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
    } else if (apiKey && apiKey.canReadAllUricAcid) {
      // API-Key hat Zugriff auf alle Daten - userId ist optional
      if (!userGuid) {
        // Wenn kein userId angegeben, gib alle Daten zurück
        // TODO: Implementiere getAll() Methode in UricAcidValue Model
        return res.status(400).json({ error: 'userId (GUID) is required for reading all data' });
      }
    } else {
      // API-Key hat nur Zugriff auf eigene Daten - userId ist erforderlich
      if (!userGuid) {
        return res.status(400).json({ error: 'userId (GUID) is required' });
      }
    }
    
    // Finde User anhand der GUID
    const user = User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const { startDate, endDate, limit, offset } = req.query;
    
    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    
    const values = UricAcidValue.findByUserId(userId, options);
    
    res.json({
      success: true,
      count: values.length,
      data: values
    });
  } catch (error) {
    logger.error('Error fetching uric acid values:', error);
    next(error);
  }
};

exports.getStats = (req, res, next) => {
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
    
    const stats = UricAcidValue.getStats(userId, days);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
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
    const lastTimestamp = UricAcidValue.getLastTimestamp(userId);
    
    res.json({
      success: true,
      data: {
        lastTimestamp: lastTimestamp
      }
    });
  } catch (error) {
    logger.error('Error fetching last uric acid timestamp:', error);
    next(error);
  }
};


