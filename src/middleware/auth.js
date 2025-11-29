const logger = require('../utils/logger');

// Development-Modus: Keine Auth erforderlich, alle sind Super-Admins
const isDevelopment = process.env.NODE_ENV === 'development';

exports.requireAuth = (req, res, next) => {
  if (isDevelopment) {
    // Im Development: Prüfe ob User authentifiziert ist
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    return next();
  }
  
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({
    success: false,
    error: 'Authentication required'
  });
};

exports.requireAdmin = (req, res, next) => {
  if (isDevelopment) {
    // Im Development: Prüfe ob User authentifiziert und Admin ist
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    return next();
  }
  
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user && req.user.isAdmin) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  res.status(401).json({
    success: false,
    error: 'Authentication required'
  });
};

