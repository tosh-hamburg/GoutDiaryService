const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const { initDatabase } = require('./database');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs');

// Load environment variables
// In Cloud Run werden Umgebungsvariablen automatisch gesetzt, .env wird nur lokal verwendet
if (process.env.NODE_ENV !== 'production' || !process.env.GOOGLE_CLIENT_ID) {
  // Versuche .env Datei zu laden (nur für lokale Entwicklung)
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    logger.info(`Loaded .env from: ${envPath}`);
  } else {
    dotenv.config(); // Versuche Standard-Pfad
  }
}

// Debug: Zeige ob OAuth Variablen gesetzt sind (ohne Werte zu loggen)
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`GOOGLE_CLIENT_ID is ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'}`);
logger.info(`GOOGLE_CLIENT_SECRET is ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
logger.info(`GOOGLE_CALLBACK_URL: ${process.env.GOOGLE_CALLBACK_URL || 'not set (using default /auth/google/callback)'}`);
if (process.env.GOOGLE_CALLBACK_URL) {
  logger.info(`Full callback URL will be: ${process.env.GOOGLE_CALLBACK_URL}`);
}

// Load Passport config AFTER dotenv
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - WICHTIG für Cloud Run, damit req.protocol korrekt ist
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'harnsaeure-tracker-secret-key-change-in-production',
  resave: true, // Für Cloud Run: true, damit Session bei jedem Request gespeichert wird
  saveUninitialized: false,
  name: 'connect.sid', // Expliziter Cookie-Name
  rolling: false, // NICHT bei jedem Request erneuern, sonst geht Session verloren
  cookie: {
    secure: 'auto', // Automatisch basierend auf req.secure (wird durch trust proxy gesetzt)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' für Cross-Site in Production
    domain: undefined, // Keine Domain setzen, damit Cookie für alle Subdomains funktioniert
    path: '/' // Cookie für alle Pfade verfügbar
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health Check (früh, für Load Balancer)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'harnsaeure-feasibility',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Auth Routes (müssen vor Root-Route sein, damit Callback funktioniert)
app.use('/auth', authRoutes);

// API Routes
app.use('/api/v1', apiRoutes);

// Root Route - Serve Web UI or API Info (MUSS VOR statischen Dateien sein!)
app.get('/', (req, res, next) => {
  // Debug-Logging für Auth-Status
  logger.info(`Root route accessed - isAuthenticated: ${req.isAuthenticated ? req.isAuthenticated() : 'N/A'}, user: ${req.user ? req.user.email : 'none'}, sessionID: ${req.sessionID}`);
  logger.info(`Session passport: ${JSON.stringify(req.session.passport)}`);
  logger.info(`Query params: ${JSON.stringify(req.query)}`);
  
  // Im Development-Modus: Weiterleitung zu login-dev.html wenn nicht authentifiziert
  if (process.env.NODE_ENV === 'development') {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      logger.info('Development mode: User not authenticated, redirecting to login-dev.html');
      return res.redirect('/login-dev.html');
    }
  } else {
    // Production: Weiterleitung zu login.html wenn nicht authentifiziert
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      logger.info('User not authenticated, redirecting to login');
      logger.info(`Session state: ${JSON.stringify(req.session)}`);
      return res.redirect('/login.html');
    }
  }
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      service: 'Harnsäure-Analyse-Service',
      version: '0.1.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        api: {
          base: '/api/v1',
          uricAcidValues: {
            create: 'POST /api/v1/uric-acid-values',
            getAll: 'GET /api/v1/uric-acid-values?userId=xxx',
            stats: 'GET /api/v1/uric-acid-values/stats?userId=xxx&days=30'
          },
          meals: {
            create: 'POST /api/v1/meals',
            getAll: 'GET /api/v1/meals?userId=xxx',
            stats: 'GET /api/v1/meals/stats?userId=xxx&days=30'
          },
          analysis: {
            analyze: 'POST /api/v1/analysis',
            latest: 'GET /api/v1/analysis/latest?userId=xxx'
          }
        }
      }
    });
  }
});

// Serve static files (web UI) - login.html is public
app.get('/login.html', (req, res) => {
  // Production: Google OAuth Login
  const loginPath = path.join(__dirname, '../public/login.html');
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    res.status(404).send('Login page not found');
  }
});

// Development Login Page
app.get('/login-dev.html', (req, res) => {
  // Nur in Development verfügbar
  if (process.env.NODE_ENV !== 'development') {
    return res.redirect('/login.html');
  }
  const loginDevPath = path.join(__dirname, '../public/login-dev.html');
  if (fs.existsSync(loginDevPath)) {
    res.sendFile(loginDevPath);
  } else {
    res.status(404).send('Development login page not found');
  }
});

// Serve static files (web UI) - NACH allen Routen, damit Routen Vorrang haben
// WICHTIG: index.html wird NICHT automatisch serviert, da Root-Route zuerst kommt
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    index: false, // Verhindere automatisches Servieren von index.html
    dotfiles: 'ignore',
    setHeaders: (res, filePath) => {
      // Allow login.html without auth
      if (filePath.endsWith('login.html')) {
        return;
      }
      // For other files, check auth in the route handler
    }
  }));
}

// Serve photos statically
const photosDir = path.join(__dirname, '../data/photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}
app.use('/photos', express.static(photosDir));

// Error Handling
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 Handler - MUSS als letztes kommen, nach allen Routen und statischen Dateien
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  // Wenn es eine HTML-Anfrage ist, versuche index.html zu servieren (falls authentifiziert)
  if (req.accepts('html')) {
    // Prüfe Auth für HTML-Anfragen
    if (process.env.NODE_ENV === 'development' || (req.isAuthenticated && req.isAuthenticated())) {
      const indexPath = path.join(__dirname, '../public/index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    // Nicht authentifiziert oder index.html nicht gefunden
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Page not found</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #333; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <h1>Error: Page not found</h1>
        <p>The requested URL was not found on this server.</p>
        <p><a href="/login.html">Go to login</a></p>
      </body>
      </html>
    `);
  }
  // Für API-Anfragen: JSON zurückgeben
  res.status(404).json({ error: 'Route not found' });
});

// Initialize Database and Start Server
async function start() {
  try {
    // Initialize SQLite database
    await initDatabase();
    logger.info('Database initialized');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on http://dev.gout-diary.com:${PORT}`);
      logger.info(`Health check: http://dev.gout-diary.com:${PORT}/health`);
      logger.info(`API: http://dev.gout-diary.com:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

