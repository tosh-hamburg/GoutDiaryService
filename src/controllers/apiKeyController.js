const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

/**
 * Erstellt einen neuen API-Key
 */
exports.create = (req, res) => {
  try {
    const {
      name,
      description,
      canReadOwnUricAcid = false,
      canWriteOwnUricAcid = false,
      canReadOwnMeals = false,
      canWriteOwnMeals = false,
      canReadAllUricAcid = false,
      canReadAllMeals = false
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Prüfe ob mindestens eine Berechtigung gesetzt ist
    const hasPermission = canReadOwnUricAcid || canWriteOwnUricAcid ||
                          canReadOwnMeals || canWriteOwnMeals ||
                          canReadAllUricAcid || canReadAllMeals;

    if (!hasPermission) {
      return res.status(400).json({
        success: false,
        error: 'At least one permission must be granted'
      });
    }

    const apiKey = ApiKey.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      canReadOwnUricAcid,
      canWriteOwnUricAcid,
      canReadOwnMeals,
      canWriteOwnMeals,
      canReadAllUricAcid,
      canReadAllMeals,
      createdBy: req.user ? req.user.id : null,
      isActive: true
    });

    logger.info(`API Key created: ${apiKey.name} (ID: ${apiKey.id})`);

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        key: apiKey.key, // Nur beim Erstellen!
        permissions: {
          canReadOwnUricAcid: apiKey.canReadOwnUricAcid,
          canWriteOwnUricAcid: apiKey.canWriteOwnUricAcid,
          canReadOwnMeals: apiKey.canReadOwnMeals,
          canWriteOwnMeals: apiKey.canWriteOwnMeals,
          canReadAllUricAcid: apiKey.canReadAllUricAcid,
          canReadAllMeals: apiKey.canReadAllMeals
        },
        createdAt: apiKey.createdAt,
        isActive: apiKey.isActive
      }
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key'
    });
  }
};

/**
 * Gibt alle API-Keys zurück (ohne Keys, nur Metadaten)
 */
exports.getAll = (req, res) => {
  try {
    const apiKeys = ApiKey.getAll();
    
    res.json({
      success: true,
      data: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        description: key.description,
        permissions: {
          canReadOwnUricAcid: key.canReadOwnUricAcid,
          canWriteOwnUricAcid: key.canWriteOwnUricAcid,
          canReadOwnMeals: key.canReadOwnMeals,
          canWriteOwnMeals: key.canWriteOwnMeals,
          canReadAllUricAcid: key.canReadAllUricAcid,
          canReadAllMeals: key.canReadAllMeals
        },
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        isActive: key.isActive
      }))
    });
  } catch (error) {
    logger.error('Error getting API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API keys'
    });
  }
};

/**
 * Gibt einen einzelnen API-Key zurück
 */
exports.getById = (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = ApiKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        permissions: {
          canReadOwnUricAcid: apiKey.canReadOwnUricAcid,
          canWriteOwnUricAcid: apiKey.canWriteOwnUricAcid,
          canReadOwnMeals: apiKey.canReadOwnMeals,
          canWriteOwnMeals: apiKey.canWriteOwnMeals,
          canReadAllUricAcid: apiKey.canReadAllUricAcid,
          canReadAllMeals: apiKey.canReadAllMeals
        },
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
        isActive: apiKey.isActive
      }
    });
  } catch (error) {
    logger.error('Error getting API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API key'
    });
  }
};

/**
 * Erstellt einen API-Key mit einem vorgegebenen Key-Wert (manuelles Hinzufügen)
 */
exports.createWithKey = (req, res) => {
  try {
    const {
      key,
      name,
      description,
      canReadOwnUricAcid = false,
      canWriteOwnUricAcid = false,
      canReadOwnMeals = false,
      canWriteOwnMeals = false,
      canReadAllUricAcid = false,
      canReadAllMeals = false
    } = req.body;

    if (!key || key.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'API-Key ist erforderlich'
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Prüfe ob mindestens eine Berechtigung gesetzt ist
    const hasPermission = canReadOwnUricAcid || canWriteOwnUricAcid ||
                          canReadOwnMeals || canWriteOwnMeals ||
                          canReadAllUricAcid || canReadAllMeals;

    if (!hasPermission) {
      return res.status(400).json({
        success: false,
        error: 'At least one permission must be granted'
      });
    }

    const apiKey = ApiKey.createWithKey({
      key: key.trim(),
      name: name.trim(),
      description: description ? description.trim() : null,
      canReadOwnUricAcid,
      canWriteOwnUricAcid,
      canReadOwnMeals,
      canWriteOwnMeals,
      canReadAllUricAcid,
      canReadAllMeals,
      createdBy: req.user ? req.user.id : null,
      isActive: true
    });

    logger.info(`API Key manually added: ${apiKey.name} (ID: ${apiKey.id})`);

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        key: apiKey.key, // Nur beim Erstellen!
        permissions: {
          canReadOwnUricAcid: apiKey.canReadOwnUricAcid,
          canWriteOwnUricAcid: apiKey.canWriteOwnUricAcid,
          canReadOwnMeals: apiKey.canReadOwnMeals,
          canWriteOwnMeals: apiKey.canWriteOwnMeals,
          canReadAllUricAcid: apiKey.canReadAllUricAcid,
          canReadAllMeals: apiKey.canReadAllMeals
        },
        createdAt: apiKey.createdAt,
        isActive: apiKey.isActive
      }
    });
  } catch (error) {
    logger.error('Error creating API key with provided key:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create API key'
    });
  }
};

/**
 * Aktualisiert einen API-Key
 */
exports.update = (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = ApiKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    const {
      name,
      description,
      canReadOwnUricAcid = false,
      canWriteOwnUricAcid = false,
      canReadOwnMeals = false,
      canWriteOwnMeals = false,
      canReadAllUricAcid = false,
      canReadAllMeals = false,
      isActive = true
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Prüfe ob mindestens eine Berechtigung gesetzt ist
    const hasPermission = canReadOwnUricAcid || canWriteOwnUricAcid ||
                          canReadOwnMeals || canWriteOwnMeals ||
                          canReadAllUricAcid || canReadAllMeals;

    if (!hasPermission) {
      return res.status(400).json({
        success: false,
        error: 'At least one permission must be granted'
      });
    }

    const updatedKey = ApiKey.update(id, {
      name: name.trim(),
      description: description ? description.trim() : null,
      canReadOwnUricAcid,
      canWriteOwnUricAcid,
      canReadOwnMeals,
      canWriteOwnMeals,
      canReadAllUricAcid,
      canReadAllMeals,
      isActive
    });

    logger.info(`API Key updated: ${updatedKey.name} (ID: ${id})`);

    res.json({
      success: true,
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        description: updatedKey.description,
        permissions: {
          canReadOwnUricAcid: updatedKey.canReadOwnUricAcid,
          canWriteOwnUricAcid: updatedKey.canWriteOwnUricAcid,
          canReadOwnMeals: updatedKey.canReadOwnMeals,
          canWriteOwnMeals: updatedKey.canWriteOwnMeals,
          canReadAllUricAcid: updatedKey.canReadAllUricAcid,
          canReadAllMeals: updatedKey.canReadAllMeals
        },
        createdAt: updatedKey.createdAt,
        lastUsedAt: updatedKey.lastUsedAt,
        isActive: updatedKey.isActive
      }
    });
  } catch (error) {
    logger.error('Error updating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key'
    });
  }
};

/**
 * Löscht einen API-Key (soft delete)
 */
exports.delete = (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = ApiKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    ApiKey.delete(id);
    logger.info(`API Key deleted: ${apiKey.name} (ID: ${id})`);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key'
    });
  }
};

