const User = require('../models/User');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

exports.loginSuccess = (req, res) => {
  try {
    logger.info('=== Login Success Handler ===');
    logger.info(`req.user: ${req.user ? JSON.stringify({id: req.user.id, email: req.user.email, isAdmin: req.user.isAdmin}) : 'null'}`);
    logger.info(`req.sessionID: ${req.sessionID}`);
    logger.info(`req.isAuthenticated: ${req.isAuthenticated ? req.isAuthenticated() : 'N/A'}`);
    logger.info(`req.session.passport: ${JSON.stringify(req.session.passport)}`);
    
    if (req.user) {
      logger.info(`User logged in: ${req.user.email} (Admin: ${req.user.isAdmin})`);
      
      // Passport sollte den User bereits in req.session.passport gespeichert haben
      // Aber wir stellen sicher, dass es gesetzt ist
      if (!req.session.passport || !req.session.passport.user) {
        logger.warn('Passport user not in session, setting manually');
        req.session.passport = { user: req.user.id };
      }
      
      // Stelle sicher, dass die Session gespeichert wird, bevor wir weiterleiten
      req.session.save((err) => {
        if (err) {
          logger.error('Error saving session:', err);
          return res.redirect('/login.html?error=session_error');
        }
        
        logger.info('Session saved successfully');
        logger.info(`Session after save - passport: ${JSON.stringify(req.session.passport)}`);
        logger.info(`Session ID: ${req.sessionID}`);
        logger.info(`Cookie will be set with: secure=${req.secure}, sameSite=none`);
        
        // Weiterleitung nach erfolgreicher Session-Speicherung
        // WICHTIG: Verwende HTTPS, wenn in Production (Cloud Run verwendet immer HTTPS)
        // Aber respektiere den Request-Protokoll für lokale Entwicklung
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
        const redirectUrl = protocol + '://' + req.get('host') + '/?login=success';
        logger.info(`Redirecting to: ${redirectUrl} (protocol: ${protocol}, original: ${req.protocol})`);
        
        // Setze das Cookie explizit, um sicherzustellen, dass es übertragen wird
        res.cookie('connect.sid', req.sessionID, {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          path: '/'
        });
        
        res.redirect(redirectUrl);
      });
    } else {
      logger.warn('Login success called but req.user is null');
      logger.warn(`Session state: ${JSON.stringify(req.session)}`);
      res.redirect('/login.html?error=authentication_failed');
    }
  } catch (error) {
    logger.error('Error in login success:', error);
    res.redirect('/login.html?error=server_error');
  }
};

exports.loginFailure = (req, res) => {
  logger.warn('Login failure');
  res.redirect('/login?error=authentication_failed');
};

exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('Error during logout:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session:', err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
};

exports.getCurrentUser = (req, res) => {
  try {
    // Im Development-Modus: Gib echten User zurück, wenn authentifiziert
    if (process.env.NODE_ENV === 'development') {
      if (req.user) {
        return res.json({
          success: true,
          data: {
            id: req.user.id,
            email: req.user.email,
            username: req.user.username,
            isAdmin: req.user.isAdmin,
            guid: req.user.guid
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }
    }
    
    if (req.user) {
      res.json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          isAdmin: req.user.isAdmin,
          guid: req.user.guid
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
  } catch (error) {
    logger.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

