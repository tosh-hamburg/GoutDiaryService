const User = require('../models/User');
const logger = require('../utils/logger');

exports.register = (req, res, next) => {
  try {
    const { guid, gender, birthYear } = req.body;
    
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
      birthYear: birthYear ? parseInt(birthYear) : null
    });
    
    logger.info(`User registered/updated: ${guid}`, { gender, birthYear });
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error registering user:', error);
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
    const { gender, birthYear } = req.body;
    
    // Validation
    if (gender && !['MALE', 'FEMALE', 'DIVERSE'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender. Must be MALE, FEMALE, or DIVERSE' });
    }
    
    if (birthYear && (birthYear < 1900 || birthYear > new Date().getFullYear())) {
      return res.status(400).json({ error: 'Invalid birth year' });
    }
    
    const user = User.update(guid, {
      gender,
      birthYear: birthYear ? parseInt(birthYear) : null
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    logger.info(`User updated: ${guid}`, { gender, birthYear });
    
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

