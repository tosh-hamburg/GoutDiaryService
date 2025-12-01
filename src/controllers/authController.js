const User = require('../models/User');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');

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

// New: Verify Google Identity credential (ID token) from client (GSI / One-tap)
exports.verifyGoogleCredential = async (req, res) => {
  try {
    const credential = req.body?.credential || req.body?.id_token;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Missing credential in request body' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      logger.warn('GOOGLE_CLIENT_ID not configured - cannot verify Google credential');
      return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }

    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    } catch (err) {
      logger.warn('Invalid Google ID token:', err);
      return res.status(401).json({ success: false, error: 'Invalid Google credential' });
    }

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const displayName = payload.name || payload.email;

    if (!email) {
      return res.status(400).json({ success: false, error: 'No email in Google credential' });
    }

    // Find user by Google ID
    let user = User.findByGoogleId(googleId);

    if (!user) {
      // Try to find by email and link
      user = User.findByEmail(email);
      if (user) {
        const db = require('../database').getDatabase();
        const updateStmt = db.prepare('UPDATE users SET google_id = ? WHERE id = ?');
        updateStmt.run(googleId, user.id);
        user = User.findByGoogleId(googleId);
      } else {
        // Create new user
        const isDevelopment = process.env.NODE_ENV === 'development';
        let isAdmin;
        if (isDevelopment) {
          isAdmin = 1;
        } else {
          const db = require('../database').getDatabase();
          const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
          isAdmin = userCount === 0 ? 1 : 0;
        }

        const guid = uuidv4();
        const newUser = User.create({
          guid: guid,
          email: email,
          googleId: googleId,
          isAdmin: isAdmin === 1
        });
        user = newUser;
        logger.info(`New user created via Google credential: ${email} (Admin: ${newUser.isAdmin})`);
      }
    }

    // Log in the user via Passport session
    req.logIn(user, (err) => {
      if (err) {
        logger.error('Error logging in user after Google credential:', err);
        return res.status(500).json({ success: false, error: 'Login failed' });
      }

      // Ensure session saved before responding
      req.session.save((err) => {
        if (err) {
          logger.error('Error saving session after Google credential login:', err);
          return res.status(500).json({ success: false, error: 'Session save failed' });
        }

        logger.info(`User logged in via Google credential: ${user.email}`);
        return res.json({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            guid: user.guid
          }
        });
      });
    });
  } catch (error) {
    logger.error('Error in verifyGoogleCredential:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

