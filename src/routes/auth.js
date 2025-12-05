const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const logger = require('../utils/logger');

// Development-Modus: Keine Auth erforderlich
const isDevelopment = process.env.NODE_ENV === 'development';

// Prüfe ob Google OAuth konfiguriert ist
const isOAuthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

// Debug-Logging
if (!isOAuthConfigured && !isDevelopment) {
  logger.warn('Google OAuth not configured:');
  logger.warn(`  GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'}`);
  logger.warn(`  GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
}

if (isDevelopment) {
  logger.info('Development mode: Local username/password authentication enabled');
}

// Google OAuth routes (classic OAuth) and Google Identity credential (GSI)
const isGsiAvailable = !!process.env.GOOGLE_CLIENT_ID;

// Route to accept Google Identity credential (ID token) from client (GSI / One-tap / mobile)
if (isGsiAvailable) {
  router.post('/google/credential', authController.verifyGoogleCredential);
}

// Classic Google OAuth routes
if (isOAuthConfigured) {
  router.get('/google', (req, res, next) => {
    logger.info('OAuth login initiated');
    logger.info(`Request host: ${req.get('host')}`);
    logger.info(`Request protocol: ${req.protocol}`);
    logger.info(`Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    next();
  }, passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get('/google/callback',
    (req, res, next) => {
      logger.info('=== OAuth callback received ===');
      logger.info(`Request URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
      logger.info(`Query params: ${JSON.stringify(req.query)}`);
      logger.info(`Session ID before auth: ${req.sessionID}`);
      logger.info(`Session state: ${JSON.stringify(req.session)}`);
      next();
    },
    passport.authenticate('google', { 
      failureRedirect: '/login.html?error=authentication_failed',
      session: true // Stelle sicher, dass Session verwendet wird
    }),
    (req, res, next) => {
      logger.info('=== OAuth authentication successful (before loginSuccess) ===');
      logger.info(`Session ID after auth: ${req.sessionID}`);
      logger.info(`User after auth: ${req.user ? req.user.email : 'none'}`);
      logger.info(`Is authenticated: ${req.isAuthenticated ? req.isAuthenticated() : 'N/A'}`);
      logger.info(`Session passport: ${JSON.stringify(req.session.passport)}`);
      next();
    },
    authController.loginSuccess
  );
} else {
  // Fallback wenn OAuth nicht konfiguriert ist
  router.get('/google', (req, res) => {
    res.status(503).json({
      error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.'
    });
  });

  router.get('/google/callback', (req, res) => {
    res.status(503).json({
      error: 'Google OAuth is not configured.'
    });
  });
}

// Local login (jetzt auch im Production-Modus verfügbar)
router.post('/local', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      logger.error('Local authentication error:', err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
    if (!user) {
      return res.status(401).json({ success: false, error: info?.message || 'Ungültiger Benutzername oder Passwort' });
    }
    req.logIn(user, (err) => {
      if (err) {
        logger.error('Login error:', err);
        return res.status(500).json({ success: false, error: 'Login failed' });
      }
      logger.info(`Local login successful: ${user.username || user.email} (Development: ${isDevelopment})`);
      return res.json({
        success: true,
        redirect: '/',
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin,
          guid: user.guid
        }
      });
    });
  })(req, res, next);
});

// Logout
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

// Get current user
router.get('/me', (req, res) => {
  // Verwende den Controller, der bereits Development-Modus berücksichtigt
  authController.getCurrentUser(req, res);
});

module.exports = router;

