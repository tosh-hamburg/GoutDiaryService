const express = require('express');
const router = express.Router();
const uricAcidController = require('../controllers/uricAcidController');
const mealController = require('../controllers/mealController');
const foodItemController = require('../controllers/foodItemController');
const backupController = require('../controllers/backupController');
const analysisController = require('../controllers/analysisController');
const userController = require('../controllers/userController');
const apiKeyController = require('../controllers/apiKeyController');
const { requireAdmin } = require('../middleware/auth');
const { authenticateApiKey, authenticateApiKeyOrSession, requirePermission, requireUserAccess } = require('../middleware/apiKeyAuth');

// API Key Management routes (nur für Admins)
router.post('/admin/api-keys', requireAdmin, apiKeyController.create);
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
router.get('/users', requireAdmin, userController.getAll); // Nur für Admins (Web-UI)
router.get('/users/:guid', requireAdmin, userController.getByGuid); // Nur für Admins (Web-UI)
router.put('/users/:guid', authenticateApiKey, userController.update); // API-Key erforderlich

module.exports = router;


