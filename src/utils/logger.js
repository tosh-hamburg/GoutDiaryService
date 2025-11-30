const path = require('path');
const fs = require('fs');

// Versuche winston zu laden, falls nicht verfügbar: Fallback auf einfaches Logging
let winston, DailyRotateFile, logger;
let useWinston = false;

try {
  winston = require('winston');
  DailyRotateFile = require('winston-daily-rotate-file');
  useWinston = true;
  
  // Erstelle logs-Verzeichnis falls nicht vorhanden
  // Logs-Verzeichnis direkt im Projekt-Root (parallel zu src)
  const logsDir = path.join(__dirname, '../../logs');
  const resolvedLogsDir = path.resolve(logsDir);
  if (!fs.existsSync(resolvedLogsDir)) {
    fs.mkdirSync(resolvedLogsDir, { recursive: true });
  }

  // Konfiguriere rollierendes Logging
  const dailyRotateFileTransport = new DailyRotateFile({
    filename: path.join(resolvedLogsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m', // Maximale Dateigröße pro Log-Datei
    maxFiles: '14d', // Behalte Logs für 14 Tage
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    zippedArchive: true, // Komprimiere alte Log-Dateien
    createSymlink: true, // Erstelle Symlink zur aktuellen Log-Datei
    symlinkName: 'application-current.log'
  });

  // Konsole-Transport für Development
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      })
    )
  });

  // Erstelle Logger
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
      dailyRotateFileTransport,
      consoleTransport // Immer aktiv, unabhängig vom Modus
    ],
    // Behandle nicht abgefangene Exceptions
    exceptionHandlers: [
      new DailyRotateFile({
        filename: path.join(resolvedLogsDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true
      })
    ],
    // Behandle nicht abgefangene Promise-Rejections
    rejectionHandlers: [
      new DailyRotateFile({
        filename: path.join(resolvedLogsDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true
      })
    ]
  });
  
  console.log('[INFO] Winston logging initialized successfully');
} catch (error) {
  console.warn('[WARN] Winston not available, using fallback logging:', error.message);
  console.warn('[WARN] To enable advanced logging, run: npm install winston winston-daily-rotate-file');
  useWinston = false;
}

// Kompatibilitäts-API für bestehenden Code
if (useWinston && logger) {
  // Winston-basiertes Logging
  module.exports = {
    info: (message, ...args) => {
      if (args.length > 0 && args[0] instanceof Error) {
        logger.info(message, { error: args[0].message, stack: args[0].stack, ...args.slice(1) });
      } else {
        logger.info(message, ...args);
      }
    },
    error: (message, ...args) => {
      if (args.length > 0 && args[0] instanceof Error) {
        logger.error(message, { error: args[0].message, stack: args[0].stack, ...args.slice(1) });
      } else {
        logger.error(message, ...args);
      }
    },
    warn: (message, ...args) => {
      if (args.length > 0 && args[0] instanceof Error) {
        logger.warn(message, { error: args[0].message, stack: args[0].stack, ...args.slice(1) });
      } else {
        logger.warn(message, ...args);
      }
    },
    debug: (message, ...args) => {
      if (args.length > 0 && args[0] instanceof Error) {
        logger.debug(message, { error: args[0].message, stack: args[0].stack, ...args.slice(1) });
      } else {
        logger.debug(message, ...args);
      }
    }
  };
} else {
  // Fallback: Einfaches Console-Logging (wie vorher)
  module.exports = {
    info: (message, ...args) => {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    },
    error: (message, ...args) => {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    },
    warn: (message, ...args) => {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    },
    debug: (message, ...args) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
      }
    }
  };
}
