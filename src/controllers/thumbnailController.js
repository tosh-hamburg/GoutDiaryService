const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const User = require('../models/User');

// Konfiguriere multer für File-Uploads
// Speichere Dateien im GUID-Verzeichnis mit der relativen Pfadstruktur
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userGuid = req.body.userGuid || req.query.userGuid;
    
    logger.debug('Multer destination called', {
      userGuid,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimeType: file?.mimetype,
      bodyKeys: Object.keys(req.body || {}),
      relativePath: req.body.relativePath
    });
    
    if (!userGuid) {
      logger.error('Multer destination: userGuid missing', {
        body: req.body,
        query: req.query
      });
      return cb(new Error('userGuid is required'));
    }
    
    // Basis-Verzeichnis für Thumbnails (parallel zu src)
    const baseDir = path.join(__dirname, '../../data/thumbnails');
    
    // Erstelle GUID-Verzeichnis
    const guidDir = path.join(baseDir, userGuid);
    
    // Bestimme das Zielverzeichnis basierend auf dem relativen Pfad
    const relativePath = req.body.relativePath || '';
    const targetDir = path.join(guidDir, relativePath);
    
    logger.debug('Multer destination calculated', {
      baseDir,
      guidDir,
      relativePath,
      targetDir
    });
    
    // Erstelle Verzeichnisstruktur falls nicht vorhanden
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        logger.info(`Created thumbnail directory: ${targetDir}`);
      }
      cb(null, targetDir);
    } catch (error) {
      logger.error(`Error creating thumbnail directory: ${targetDir}`, error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Verwende den ursprünglichen Dateinamen
    const originalName = file.originalname || `thumbnail_${Date.now()}.jpg`;
    logger.debug('Multer filename', { originalName, fileFieldname: file.fieldname });
    cb(null, originalName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB Limit
  },
  fileFilter: (req, file, cb) => {
    // Erlaube nur Bildformate
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

/**
 * Upload-Thumbnail für eine Mahlzeit
 */
exports.uploadMealThumbnail = [
  upload.single('thumbnail'),
  (req, res, next) => {
    try {
      logger.info('Meal thumbnail upload request received', {
        hasFile: !!req.file,
        fileSize: req.file?.size,
        fileName: req.file?.originalname,
        userGuid: req.body.userGuid,
        relativePath: req.body.relativePath,
        contentType: req.get('Content-Type')
      });
      
      if (!req.file) {
        logger.warn('Meal thumbnail upload failed: No file uploaded', {
          body: req.body,
          headers: req.headers
        });
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const userGuid = req.body.userGuid;
      if (!userGuid) {
        logger.error('Meal thumbnail upload failed: userGuid missing', {
          filePath: req.file.path,
          body: req.body
        });
        // Lösche hochgeladene Datei bei Fehler
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'userGuid is required' });
      }
      
      // Relativer Pfad vom GUID-Verzeichnis aus
      // req.file.path ist bereits der vollständige Pfad zur Datei
      const guidDir = path.join(__dirname, '../../data/thumbnails', userGuid);
      const relativePath = path.relative(guidDir, req.file.path).replace(/\\/g, '/'); // Normalisiere Pfad-Separatoren
      
      // Vollständiger relativer Pfad (inkl. Dateiname)
      // relativePath enthält bereits den Dateinamen, wenn die Datei direkt im GUID-Verzeichnis liegt
      // oder den Pfad + Dateiname, wenn sie in einem Unterverzeichnis liegt
      const fullRelativePath = relativePath || req.file.filename;
      
      logger.info(`Meal thumbnail uploaded successfully for user ${userGuid}`, {
        fullRelativePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        destination: req.file.path,
        guidDir
      });
      
      res.status(201).json({
        success: true,
        data: {
          thumbnailPath: fullRelativePath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      });
    } catch (error) {
      // Lösche hochgeladene Datei bei Fehler
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting uploaded file after error', unlinkError);
        }
      }
      logger.error('Error uploading meal thumbnail:', error);
      next(error);
    }
  }
];

/**
 * Upload-Thumbnail für ein Lebensmittel
 */
exports.uploadFoodItemThumbnail = [
  upload.single('thumbnail'),
  (req, res, next) => {
    try {
      logger.info('Food item thumbnail upload request received', {
        hasFile: !!req.file,
        fileSize: req.file?.size,
        fileName: req.file?.originalname,
        userGuid: req.body.userGuid,
        relativePath: req.body.relativePath,
        contentType: req.get('Content-Type')
      });
      
      if (!req.file) {
        logger.warn('Food item thumbnail upload failed: No file uploaded', {
          body: req.body,
          headers: req.headers
        });
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const userGuid = req.body.userGuid;
      if (!userGuid) {
        logger.error('Food item thumbnail upload failed: userGuid missing', {
          filePath: req.file.path,
          body: req.body
        });
        // Lösche hochgeladene Datei bei Fehler
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'userGuid is required' });
      }
      
      // Relativer Pfad vom GUID-Verzeichnis aus
      // req.file.path ist bereits der vollständige Pfad zur Datei
      const guidDir = path.join(__dirname, '../../data/thumbnails', userGuid);
      const relativePath = path.relative(guidDir, req.file.path).replace(/\\/g, '/'); // Normalisiere Pfad-Separatoren
      
      // Vollständiger relativer Pfad (inkl. Dateiname)
      // relativePath enthält bereits den Dateinamen, wenn die Datei direkt im GUID-Verzeichnis liegt
      // oder den Pfad + Dateiname, wenn sie in einem Unterverzeichnis liegt
      const fullRelativePath = relativePath || req.file.filename;
      
      logger.info(`Food item thumbnail uploaded successfully for user ${userGuid}`, {
        fullRelativePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        destination: req.file.path,
        guidDir
      });
      
      res.status(201).json({
        success: true,
        data: {
          thumbnailPath: fullRelativePath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      });
    } catch (error) {
      // Lösche hochgeladene Datei bei Fehler
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting uploaded file after error', unlinkError);
        }
      }
      logger.error('Error uploading food item thumbnail:', error);
      next(error);
    }
  }
];

/**
 * Lösche ein Thumbnail
 */
exports.deleteThumbnail = (req, res, next) => {
  try {
    const userGuid = req.params.userGuid || req.query.userGuid;
    const thumbnailPath = req.params.thumbnailPath || req.query.thumbnailPath;
    
    if (!userGuid || !thumbnailPath) {
      return res.status(400).json({ error: 'userGuid and thumbnailPath are required' });
    }
    
    // Vollständiger Pfad zur Datei
    const fullPath = path.join(__dirname, '../../data/thumbnails', userGuid, thumbnailPath);
    
    // Sicherheitsprüfung: Stelle sicher, dass der Pfad innerhalb des GUID-Verzeichnisses liegt
    const guidDir = path.join(__dirname, '../../data/thumbnails', userGuid);
    const resolvedPath = path.resolve(fullPath);
    const resolvedGuidDir = path.resolve(guidDir);
    
    if (!resolvedPath.startsWith(resolvedGuidDir)) {
      return res.status(403).json({ error: 'Invalid thumbnail path' });
    }
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`Deleted thumbnail for user ${userGuid}: ${thumbnailPath}`);
      
      res.json({
        success: true,
        message: 'Thumbnail deleted successfully'
      });
    } else {
      res.status(404).json({ error: 'Thumbnail not found' });
    }
  } catch (error) {
    logger.error('Error deleting thumbnail:', error);
    next(error);
  }
};

/**
 * Hole ein Thumbnail (für Download)
 */
exports.getThumbnail = (req, res, next) => {
  try {
    const userGuid = req.params.userGuid;
    const thumbnailPath = req.params.thumbnailPath;
    
    if (!userGuid || !thumbnailPath) {
      return res.status(400).json({ error: 'userGuid and thumbnailPath are required' });
    }
    
    // Vollständiger Pfad zur Datei
    const fullPath = path.join(__dirname, '../../data/thumbnails', userGuid, thumbnailPath);
    
    // Sicherheitsprüfung: Stelle sicher, dass der Pfad innerhalb des GUID-Verzeichnisses liegt
    const guidDir = path.join(__dirname, '../../data/thumbnails', userGuid);
    const resolvedPath = path.resolve(fullPath);
    const resolvedGuidDir = path.resolve(guidDir);
    
    if (!resolvedPath.startsWith(resolvedGuidDir)) {
      return res.status(403).json({ error: 'Invalid thumbnail path' });
    }
    
    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
    } else {
      res.status(404).json({ error: 'Thumbnail not found' });
    }
  } catch (error) {
    logger.error('Error getting thumbnail:', error);
    next(error);
  }
};

