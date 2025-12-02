const express = require('express');
const router = express.Router();
const uricAcidController = require('../controllers/uricAcidController');
const mealController = require('../controllers/mealController');
const foodItemController = require('../controllers/foodItemController');
const backupController = require('../controllers/backupController');
const analysisController = require('../controllers/analysisController');
const userController = require('../controllers/userController');
const apiKeyController = require('../controllers/apiKeyController');
const thumbnailController = require('../controllers/thumbnailController');
const { requireAdmin } = require('../middleware/auth');
const { authenticateApiKey, authenticateApiKeyOrSession, requirePermission, requireUserAccess } = require('../middleware/apiKeyAuth');

// API Key Management routes (nur für Admins)
router.post('/admin/api-keys', requireAdmin, apiKeyController.create);
router.post('/admin/api-keys/manual', requireAdmin, apiKeyController.createWithKey);
router.get('/admin/api-keys', requireAdmin, apiKeyController.getAll);
router.get('/admin/api-keys/:id', requireAdmin, apiKeyController.getById);
router.put('/admin/api-keys/:id', requireAdmin, apiKeyController.update);
router.delete('/admin/api-keys/:id', requireAdmin, apiKeyController.delete);

// Uric Acid Values routes (mit API-Key ODER Session-Auth)
// Für "all" Berechtigungen: userId ist optional
// POST/PUT erfordern API-Key (für App), GET erlaubt auch Session (für Web-UI)
router.post('/uric-acid-values', authenticateApiKey, requirePermission('canWriteOwnUricAcid'), uricAcidController.create);
router.get('/uric-acid-values', authenticateApiKeyOrSession, requirePermission('canReadOwnUricAcid'), uricAcidController.getAll);
router.get('/uric-acid-values/stats', authenticateApiKeyOrSession, requirePermission('canReadOwnUricAcid'), uricAcidController.getStats);
router.get('/uric-acid-values/last-timestamp', authenticateApiKey, requirePermission('canReadOwnUricAcid'), uricAcidController.getLastTimestamp);

// Meals routes (mit API-Key ODER Session-Auth)
// POST/PUT erfordern API-Key (für App), GET erlaubt auch Session (für Web-UI)
router.post('/meals', authenticateApiKey, requirePermission('canWriteOwnMeals'), mealController.create);
router.get('/meals', authenticateApiKeyOrSession, requirePermission('canReadOwnMeals'), mealController.getAll);
router.get('/meals/stats', authenticateApiKeyOrSession, requirePermission('canReadOwnMeals'), mealController.getDietStats);
router.get('/meals/last-timestamp', authenticateApiKey, requirePermission('canReadOwnMeals'), mealController.getLastTimestamp);

// Food Items routes (mit API-Key ODER Session-Auth)
// POST/PUT/DELETE erfordern API-Key (für App), GET erlaubt auch Session (für Web-UI)
router.post('/food-items', authenticateApiKey, requirePermission('canWriteOwnMeals'), foodItemController.create);
router.get('/food-items', authenticateApiKeyOrSession, requirePermission('canReadOwnMeals'), foodItemController.getAll);
router.put('/food-items/:id', authenticateApiKey, requirePermission('canWriteOwnMeals'), foodItemController.update);
router.delete('/food-items/:id', authenticateApiKey, requirePermission('canWriteOwnMeals'), foodItemController.delete);

// Backup routes (mit API-Key ODER Session-Auth)
router.get('/backups', authenticateApiKeyOrSession, requirePermission('canReadOwnUricAcid'), backupController.listBackups);
router.get('/backups/metadata', authenticateApiKeyOrSession, requirePermission('canReadOwnUricAcid'), backupController.getBackupMetadata);

// Analysis routes
router.post('/analysis', analysisController.analyze);
router.get('/analysis/latest', analysisController.getLatest);

// User routes
router.post('/users/register', authenticateApiKey, userController.register); // API-Key erforderlich, aber keine spezifische Berechtigung
router.get('/users/me', authenticateApiKey, userController.getCurrentUser); // App kann eigene User-Daten abrufen
router.get('/users', requireAdmin, userController.getAll); // Nur für Admins (Web-UI)
router.get('/users/:guid', requireAdmin, userController.getByGuid); // Nur für Admins (Web-UI)
router.put('/users/:guid', authenticateApiKey, userController.update); // API-Key erforderlich
// Admin-API-Key Route: Gibt alle GUIDs zurück (erfordert Admin-API-Key mit canReadAllUricAcid oder canReadAllMeals)
router.get('/admin/users/guids', authenticateApiKey, userController.getAllGuids);
// Löschen aller Backup-Daten eines Users (User kann eigene Daten löschen)
router.delete('/users/delete-all', authenticateApiKey, requirePermission('canWriteOwnUricAcid'), userController.deleteAllUserData);
// Admin-Route: Löschen aller Backup-Daten eines Users (auch im Production-Modus)
router.delete('/users/:guid/backup-data', requireAdmin, userController.deleteAllUserData);

// Thumbnail routes (mit API-Key)
router.post('/thumbnails/meals', authenticateApiKey, requirePermission('canWriteOwnMeals'), thumbnailController.uploadMealThumbnail);
router.post('/thumbnails/food-items', authenticateApiKey, requirePermission('canWriteOwnMeals'), thumbnailController.uploadFoodItemThumbnail);
router.get('/thumbnails/:userGuid/:thumbnailPath(*)', authenticateApiKeyOrSession, requirePermission('canReadOwnMeals'), thumbnailController.getThumbnail);

// Log viewer routes (nur für Admins)
router.get('/admin/logs/files', requireAdmin, (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '../../logs');
    
    if (!fs.existsSync(logsDir)) {
      return res.json({ success: true, files: [] });
    }
    
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log') || file.endsWith('.log.gz'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          type: file.includes('exceptions') ? 'exceptions' : 
                file.includes('rejections') ? 'rejections' : 
                'application'
        };
      })
      .sort((a, b) => b.modified - a.modified);
    
    res.json({ success: true, files });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/logs/content', requireAdmin, (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const zlib = require('zlib');
    const { fileName, level, search, limit = 1000, offset = 0 } = req.query;
    
    if (!fileName) {
      return res.status(400).json({ success: false, error: 'fileName parameter required' });
    }
    
    const logsDir = path.join(__dirname, '../../logs');
    const filePath = path.join(logsDir, fileName);
    
    // Sicherheitsprüfung: Nur Dateien im logs-Verzeichnis erlauben
    if (!filePath.startsWith(logsDir)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    let content = '';
    if (fileName.endsWith('.gz')) {
      // Komprimierte Datei
      const compressed = fs.readFileSync(filePath);
      content = zlib.gunzipSync(compressed).toString('utf-8');
    } else {
      // Normale Datei
      content = fs.readFileSync(filePath, 'utf-8');
    }
    
    // Parse JSON-Logs (jede Zeile ist ein JSON-Objekt)
    const lines = content.split('\n').filter(line => line.trim());
    let entries = [];
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        entries.push(entry);
      } catch (e) {
        // Falls keine JSON-Zeile, als Plain-Text behandeln
        entries.push({ message: line, timestamp: new Date().toISOString(), level: 'info' });
      }
    }
    
    // Filter anwenden
    if (level) {
      entries = entries.filter(e => e.level === level);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      entries = entries.filter(e => {
        const message = (e.message || '').toLowerCase();
        const meta = JSON.stringify(e).toLowerCase();
        return message.includes(searchLower) || meta.includes(searchLower);
      });
    }
    
    // Sortiere nach Timestamp (neueste zuerst)
    entries.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
    
    // Pagination
    const total = entries.length;
    const paginatedEntries = entries.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      success: true,
      entries: paginatedEntries,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});
router.delete('/thumbnails/:userGuid/:thumbnailPath(*)', authenticateApiKey, requirePermission('canWriteOwnMeals'), thumbnailController.deleteThumbnail);

module.exports = router;


