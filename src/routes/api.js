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
// Löschen aller Backup-Daten eines Users (User kann eigene Daten löschen)
router.delete('/users/delete-all', authenticateApiKey, requirePermission('canWriteOwnUricAcid'), userController.deleteAllUserData);
// Development-only: Löschen aller Backup-Daten eines Users (Admin)
if (process.env.NODE_ENV === 'development') {
  router.delete('/users/:guid/backup-data', requireAdmin, userController.deleteAllUserData);
}

// Thumbnail routes (mit API-Key)
router.post('/thumbnails/meals', authenticateApiKey, requirePermission('canWriteOwnMeals'), thumbnailController.uploadMealThumbnail);
router.post('/thumbnails/food-items', authenticateApiKey, requirePermission('canWriteOwnMeals'), thumbnailController.uploadFoodItemThumbnail);
router.get('/thumbnails/:userGuid/:thumbnailPath(*)', authenticateApiKeyOrSession, requirePermission('canReadOwnMeals'), thumbnailController.getThumbnail);
router.delete('/thumbnails/:userGuid/:thumbnailPath(*)', authenticateApiKey, requirePermission('canWriteOwnMeals'), thumbnailController.deleteThumbnail);

module.exports = router;


