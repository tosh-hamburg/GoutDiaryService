const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Prüfe ob Google OAuth Credentials vorhanden sind
const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
// Callback URL: Wenn nicht gesetzt, verwende relative URL (wird automatisch zur vollständigen URL)
// In Cloud Run sollte die vollständige URL verwendet werden
let callbackURL = process.env.GOOGLE_CALLBACK_URL;
if (!callbackURL) {
  // Fallback: Relative URL (Express wird sie zur vollständigen URL machen)
  callbackURL = '/auth/google/callback';
  logger.warn('GOOGLE_CALLBACK_URL not set, using relative URL: /auth/google/callback');
} else {
  logger.info(`Using GOOGLE_CALLBACK_URL: ${callbackURL}`);
}

if (!clientID || !clientSecret) {
  logger.warn('Google OAuth credentials not configured. OAuth authentication will be disabled.');
  logger.warn('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
} else {
  passport.use(new GoogleStrategy({
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL: callbackURL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const { id, emails, displayName } = profile;
      const email = emails && emails[0] ? emails[0].value : null;
      
      if (!email) {
        return done(new Error('No email found in Google profile'), null);
      }
      
      // Prüfe ob User bereits existiert
      let user = await User.findByGoogleId(id);
      
      if (!user) {
        // Prüfe ob User mit dieser Email existiert
        user = await User.findByEmail(email);
        
        if (user) {
          // Update existing user with Google ID
          const db = require('../database').getDatabase();
          const updateStmt = db.prepare('UPDATE users SET google_id = ? WHERE id = ?');
          await updateStmt.run(id, user.id);
          user = await User.findByGoogleId(id);
        } else {
          // Erstelle neuen User (Google OAuth = Web-Benutzer, kann Admin sein)
          const isDevelopment = process.env.NODE_ENV === 'development';
          let isAdmin;
          
          if (isDevelopment) {
            isAdmin = 1; // Im Development: Alle Web-Benutzer sind Admin
          } else {
            // Prüfe ob es der erste Web-Benutzer ist (wird Super-Admin)
            const db = require('../database').getDatabase();
            const countStmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE email IS NOT NULL OR username IS NOT NULL');
            const countRow = await countStmt.get();
            const webUserCount = countRow ? countRow.count : 0;
            isAdmin = webUserCount === 0 ? 1 : 0;
          }
          
          const guid = uuidv4();
          // Google OAuth Benutzer haben email, können also Admin sein
          const newUser = await User.create({
            guid: guid,
            email: email,
            googleId: id,
            isAdmin: isAdmin === 1 // Übergebe den berechneten Admin-Status
          });
          
          user = newUser;
          logger.info(`New user created via Google OAuth: ${email} (Admin: ${newUser.isAdmin})`);
        }
      }
      
      return done(null, user);
    } catch (error) {
      logger.error('Error in Google OAuth strategy:', error);
      return done(error, null);
    }
  }));
}

passport.serializeUser((user, done) => {
  logger.info(`Serializing user: ${user.email} (ID: ${user.id})`);
  done(null, user.id);
});

// Local Strategy (jetzt auch im Production-Modus verfügbar)
const isDevelopment = process.env.NODE_ENV === 'development';
passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username, password, done) => {
    try {
      const user = await User.findByUsername(username);
      if (!user) {
        logger.warn(`Local login failed: user not found: ${username}`);
        return done(null, false, { message: 'Ungültiger Benutzername oder Passwort' });
      }

      // Prüfe ob Benutzer überhaupt ein Passwort hat (GUID-Benutzer haben keins)
      if (!user.passwordHash) {
        logger.warn(`Local login failed: user ${username} has no password (GUID-only user)`);
        return done(null, false, { message: 'Ungültiger Benutzername oder Passwort' });
      }

      if (!User.verifyPassword(user, password)) {
        logger.warn(`Local login failed: invalid password for user: ${username}`);
        return done(null, false, { message: 'Ungültiger Benutzername oder Passwort' });
      }

      logger.info(`Local login successful: ${username} (Admin: ${user.isAdmin}, Mode: ${isDevelopment ? 'dev' : 'prod'})`);
      return done(null, user);
    } catch (error) {
      logger.error('Error in local strategy:', error);
      return done(error, null);
    }
  }
));

passport.deserializeUser(async (id, done) => {
  try {
    logger.info(`Deserializing user with ID: ${id}`);
    const user = await User.findById(id);
    if (user) {
      const identifier = user.email || user.username || 'unknown';
      logger.info(`User deserialized successfully: ${identifier} (Admin: ${user.isAdmin})`);
      done(null, user);
    } else {
      logger.warn(`User not found during deserialization: ${id}`);
      done(null, null);
    }
  } catch (error) {
    logger.error('Error deserializing user:', error);
    done(error, null);
  }
});
