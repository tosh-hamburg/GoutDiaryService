const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

/**
 * Middleware zur Authentifizierung mit API-Key
 * Erwartet den API-Key im Header: X-API-Key
 */
exports.authenticateApiKey = (req, res, next) => {
  try {
    // API-Key aus Header extrahieren
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required. Please provide X-API-Key header.'
      });
    }

    // Finde API-Key in der Datenbank
    const keyRecord = ApiKey.findByKey(apiKey);
    
    if (!keyRecord) {
      logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 10)}...`);
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!keyRecord.isActive) {
      logger.warn(`Inactive API key attempted: ${keyRecord.name} (ID: ${keyRecord.id})`);
      return res.status(401).json({
        success: false,
        error: 'API key is inactive'
      });
    }

    // Aktualisiere letzte Verwendung
    ApiKey.updateLastUsed(keyRecord.id);

    // Füge API-Key-Info zum Request hinzu
    req.apiKey = keyRecord;
    
    next();
  } catch (error) {
    logger.error('Error authenticating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Kombinierte Authentifizierung: API-Key ODER Session (für Web-UI)
 * Erlaubt sowohl API-Key-Authentifizierung (für App) als auch Session-Authentifizierung (für Web-UI)
 */
exports.authenticateApiKeyOrSession = (req, res, next) => {
  // Prüfe zuerst auf API-Key
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
  
  if (apiKey) {
    // API-Key-Authentifizierung
    try {
      const keyRecord = ApiKey.findByKey(apiKey);
      
      if (!keyRecord) {
        logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 10)}...`);
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      if (!keyRecord.isActive) {
        logger.warn(`Inactive API key attempted: ${keyRecord.name} (ID: ${keyRecord.id})`);
        return res.status(401).json({
          success: false,
          error: 'API key is inactive'
        });
      }

      ApiKey.updateLastUsed(keyRecord.id);
      req.apiKey = keyRecord;
      return next();
    } catch (error) {
      logger.error('Error authenticating API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }
  }
  
  // Kein API-Key vorhanden, prüfe Session-Authentifizierung
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Session-Authentifizierung erfolgreich
    // Für Session-Auth setzen wir req.apiKey auf null, damit requirePermission weiß, dass es Session-Auth ist
    req.apiKey = null;
    req.isSessionAuth = true;
    return next();
  }
  
  // Weder API-Key noch Session vorhanden
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please provide X-API-Key header or login via web interface.'
  });
};

/**
 * Prüft ob der API-Key eine bestimmte Berechtigung hat
 * Unterstützt sowohl "own" als auch "all" Berechtigungen
 * Für Session-Auth (Web-UI): Admins haben automatisch alle Berechtigungen
 */
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    // Wenn Session-Authentifizierung: Admins haben alle Berechtigungen
    if (req.isSessionAuth && req.user && req.user.isAdmin) {
      return next();
    }
    
    // Für API-Key-Authentifizierung: Prüfe Berechtigungen
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required'
      });
    }

    // Prüfe die spezifische Berechtigung
    if (ApiKey.hasPermission(req.apiKey, permission)) {
      return next();
    }

    // Für "own" Berechtigungen: Prüfe auch die entsprechende "all" Berechtigung
    if (permission === 'canReadOwnUricAcid' && ApiKey.hasPermission(req.apiKey, 'canReadAllUricAcid')) {
      return next();
    }
    if (permission === 'canWriteOwnUricAcid' && ApiKey.hasPermission(req.apiKey, 'canReadAllUricAcid')) {
      // Für Schreibzugriff auf alle Daten benötigen wir eine separate Berechtigung
      // Aktuell erlauben wir nur "own" Schreibzugriff
      // Für "all" Schreibzugriff müsste eine neue Berechtigung hinzugefügt werden
    }
    if (permission === 'canReadOwnMeals' && ApiKey.hasPermission(req.apiKey, 'canReadAllMeals')) {
      return next();
    }
    if (permission === 'canWriteOwnMeals' && ApiKey.hasPermission(req.apiKey, 'canReadAllMeals')) {
      // Siehe oben
    }

    logger.warn(`API key ${req.apiKey.name} (ID: ${req.apiKey.id}) attempted to access resource without permission: ${permission}`);
    return res.status(403).json({
      success: false,
      error: `Permission denied: ${permission} required`
    });
  };
};

/**
 * Prüft ob der API-Key Zugriff auf Daten eines bestimmten Users hat
 * Erwartet userGuid im Request (aus Query-Parameter oder Body)
 */
exports.requireUserAccess = (req, res, next) => {
  if (!req.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key authentication required'
    });
  }

  // Hole userGuid aus Query-Parameter oder Body
  const requestedGuid = req.query.userId || req.body.userId;
  
  if (!requestedGuid) {
    return res.status(400).json({
      success: false,
      error: 'userId (GUID) is required'
    });
  }

  // Prüfe ob API-Key Zugriff auf alle Daten hat
  if (req.apiKey.canReadAllUricAcid || req.apiKey.canReadAllMeals) {
    // Zugriff auf alle Daten erlaubt
    req.requestedUserGuid = requestedGuid;
    return next();
  }

  // Ansonsten: Prüfe ob es die eigenen Daten sind
  // Für "own" Permissions muss die GUID übereinstimmen
  // (Die GUID wird vom Client mitgesendet)
  req.requestedUserGuid = requestedGuid;
  next(); // Die spezifische Berechtigungsprüfung erfolgt in den Controllern
};

