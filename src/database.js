// DEPRECATED: This file is kept for backward compatibility
// New code should use src/db/index.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Import new database system
const newDb = require('./db/index');

let db = null;
let usingNewSystem = false;

async function initDatabase() {
  try {
    logger.info('initDatabase() called');

    // Try to use new database system (PostgreSQL with fallback to SQLite)
    try {
      await newDb.initDatabase();
      usingNewSystem = true;
      logger.info('Using new database system (PostgreSQL or SQLite via db/index.js)');

      // Get SQLite db if using SQLite in new system
      const dbInstance = newDb.getDatabase();
      if (dbInstance.type === 'sqlite') {
        db = dbInstance.db;
      }

      return db;
    } catch (error) {
      logger.warn('New database system failed, falling back to legacy SQLite:', error);
      usingNewSystem = false;
    }

    // Fallback to legacy SQLite initialization
    const dbPath = process.env.DB_PATH || './data/harnsaeure.db';
    const dbDir = path.dirname(dbPath);

    logger.info(`Database path: ${dbPath}, directory: ${dbDir}`);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      logger.info(`Creating database directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }

    // Open database connection
    logger.info('Opening database connection...');
    db = new Database(dbPath);
    logger.info('Database connection opened');

    logger.info('Setting WAL mode...');
    db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    logger.info('WAL mode enabled');

    logger.info(`Database initialized: ${dbPath}`);

    // Create tables
    logger.info('Creating tables...');
    createTables();
    logger.info('Tables created successfully');

    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

function createTables() {
  try {
    // Users table (anonymisiert mit GUID)
    // google_id ohne UNIQUE in CREATE TABLE (UNIQUE wird über Index erzwungen)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        guid TEXT UNIQUE NOT NULL,
        gender TEXT CHECK(gender IN ('MALE', 'FEMALE', 'DIVERSE')),
        birth_year INTEGER CHECK(birth_year >= 1900 AND birth_year <= 2100),
        last_backup_timestamp DATETIME,
        email TEXT,
        google_id TEXT,
        username TEXT,
        password_hash TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migration: Prüfe ob neue Spalten existieren
    try {
      const tableInfo = db.prepare("PRAGMA table_info(users)").all();
      const hasGuid = tableInfo.some(col => col.name === 'guid');
      const hasEmail = tableInfo.some(col => col.name === 'email');
      const hasGoogleId = tableInfo.some(col => col.name === 'google_id');
      const hasIsAdmin = tableInfo.some(col => col.name === 'is_admin');
      const hasGender = tableInfo.some(col => col.name === 'gender');
      const hasBirthYear = tableInfo.some(col => col.name === 'birth_year');
      const hasLastBackupTimestamp = tableInfo.some(col => col.name === 'last_backup_timestamp');
      const hasUsername = tableInfo.some(col => col.name === 'username');
      const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');
      
      // Wenn neue Spalten fehlen, füge sie hinzu (ohne UNIQUE, da SQLite das nicht unterstützt)
      if (hasGuid && (!hasEmail || !hasGoogleId || !hasIsAdmin || !hasUsername || !hasPasswordHash || !hasLastBackupTimestamp)) {
        logger.info('Adding missing columns to users table');
        try {
          if (!hasEmail) {
            db.exec('ALTER TABLE users ADD COLUMN email TEXT');
          }
          if (!hasGoogleId) {
            // Füge Spalte OHNE UNIQUE hinzu (UNIQUE wird über Index erzwungen)
            db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
          }
          if (!hasIsAdmin) {
            db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
          }
          if (!hasUsername) {
            db.exec('ALTER TABLE users ADD COLUMN username TEXT');
          }
          if (!hasPasswordHash) {
            db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
          }
          if (!hasLastBackupTimestamp) {
            db.exec('ALTER TABLE users ADD COLUMN last_backup_timestamp DATETIME');
          }
          // Erstelle Indexe NACH dem Hinzufügen der Spalten
          // Warte kurz, damit die Spalten sicher hinzugefügt sind
          if (!hasEmail) {
            try {
              db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
            } catch (e) {
              logger.warn('Could not create idx_users_email:', e.message);
            }
          }
          if (!hasGoogleId) {
            try {
              db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL');
            } catch (idxError) {
              logger.warn('Could not create unique index on google_id with WHERE, trying without:', idxError.message);
              try {
                db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
              } catch (e2) {
                logger.warn('Could not create idx_users_google_id at all:', e2.message);
              }
            }
          }
        } catch (alterError) {
          logger.warn('Error adding columns, might already exist:', alterError.message);
        }
      }
      
      if (!hasGuid || !hasGender || !hasBirthYear) {
        logger.info('Migrating users table to new structure with guid, gender, birth_year');
        
        // Alte Daten sichern (falls vorhanden)
        const oldData = db.prepare("SELECT * FROM users").all();
        
        // Tabelle löschen und neu erstellen
        db.exec("DROP TABLE IF EXISTS users");
        db.exec(`
          CREATE TABLE users (
            id TEXT PRIMARY KEY,
            guid TEXT UNIQUE NOT NULL,
            gender TEXT CHECK(gender IN ('MALE', 'FEMALE', 'DIVERSE')),
            birth_year INTEGER CHECK(birth_year >= 1900 AND birth_year <= 2100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Für alte Einträge: generiere GUIDs (falls Daten vorhanden)
        if (oldData.length > 0) {
          const { v4: uuidv4 } = require('uuid');
          const insertStmt = db.prepare(`
            INSERT INTO users (id, guid, created_at) 
            VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))
          `);
          
          for (const user of oldData) {
            const newGuid = uuidv4();
            insertStmt.run(user.id, newGuid, user.created_at);
          }
          
          logger.info(`Migrated ${oldData.length} users: generated GUIDs for existing records`);
        } else {
          logger.info('Migrated users table: no existing records to migrate');
        }
      }
    } catch (migrationError) {
      logger.warn('Migration check failed, continuing with table creation:', migrationError);
    }
    
    // Create indexes (mit Fehlerbehandlung)
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_guid ON users(guid)');
    } catch (e) {
      logger.warn('Could not create idx_users_guid:', e.message);
    }
    
    // UNIQUE Index für google_id (nur für nicht-NULL Werte)
    try {
      // Prüfe ob Spalte existiert
      const tableInfo = db.prepare("PRAGMA table_info(users)").all();
      const hasGoogleId = tableInfo.some(col => col.name === 'google_id');
      
      if (hasGoogleId) {
        try {
          db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL');
        } catch (e) {
          // Fallback: UNIQUE Index ohne WHERE (für ältere SQLite Versionen)
          logger.warn('Could not create unique index with WHERE clause, trying without:', e.message);
          try {
            db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
          } catch (e2) {
            logger.warn('Could not create idx_users_google_id:', e2.message);
          }
        }
      }
    } catch (e) {
      logger.warn('Error checking/google_id index:', e.message);
    }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    } catch (e) {
      logger.warn('Could not create idx_users_email:', e.message);
    }
    
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL');
    } catch (e) {
      logger.warn('Could not create idx_users_username:', e.message);
    }
    
    // Uric Acid Values table
    db.exec(`
      CREATE TABLE IF NOT EXISTS uric_acid_values (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        value REAL NOT NULL CHECK(value >= 0 AND value <= 20),
        normal INTEGER DEFAULT 0,
        much_meat INTEGER DEFAULT 0,
        much_sport INTEGER DEFAULT 0,
        much_sugar INTEGER DEFAULT 0,
        much_alcohol INTEGER DEFAULT 0,
        fasten INTEGER DEFAULT 0,
        gout_attack INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Meals table
    db.exec(`
      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
        name TEXT,
        total_purin INTEGER NOT NULL CHECK(total_purin >= 0),
        total_uric_acid INTEGER NOT NULL CHECK(total_uric_acid >= 0),
        total_calories INTEGER NOT NULL CHECK(total_calories >= 0),
        total_protein REAL NOT NULL CHECK(total_protein >= 0),
        thumbnail_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Migration: Füge thumbnail_path Spalte hinzu, falls sie nicht existiert
    try {
      const tableInfo = db.prepare("PRAGMA table_info(meals)").all();
      const hasThumbnailPath = tableInfo.some(col => col.name === 'thumbnail_path');
      
      if (!hasThumbnailPath) {
        logger.info('Adding thumbnail_path column to meals table');
        db.exec('ALTER TABLE meals ADD COLUMN thumbnail_path TEXT');
      }
    } catch (migrationError) {
      logger.warn('Error checking/adding thumbnail_path to meals table:', migrationError.message);
    }
    
    // Meal Components table
    db.exec(`
      CREATE TABLE IF NOT EXISTS meal_components (
        id TEXT PRIMARY KEY,
        meal_id TEXT NOT NULL,
        food_item_name TEXT NOT NULL,
        estimated_weight INTEGER NOT NULL CHECK(estimated_weight >= 0),
        purin INTEGER NOT NULL CHECK(purin >= 0),
        uric_acid INTEGER NOT NULL CHECK(uric_acid >= 0),
        calories INTEGER NOT NULL CHECK(calories >= 0),
        protein REAL NOT NULL CHECK(protein >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
      )
    `);
    
    // Analysis Results table
    db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        analysis_date DATETIME NOT NULL,
        data_period_start DATETIME NOT NULL,
        data_period_end DATETIME NOT NULL,
        insights TEXT,
        recommendations TEXT,
        confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // API Keys table
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        can_read_own_uric_acid INTEGER DEFAULT 0,
        can_write_own_uric_acid INTEGER DEFAULT 0,
        can_read_own_meals INTEGER DEFAULT 0,
        can_write_own_meals INTEGER DEFAULT 0,
        can_read_all_uric_acid INTEGER DEFAULT 0,
        can_read_all_meals INTEGER DEFAULT 0,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    
    // Food Items table (nur benutzerdefinierte Lebensmittel)
    db.exec(`
      CREATE TABLE IF NOT EXISTS food_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        purin_per_100g INTEGER NOT NULL CHECK(purin_per_100g >= 0),
        uric_acid_per_100g INTEGER NOT NULL CHECK(uric_acid_per_100g >= 0),
        calories_per_100g INTEGER NOT NULL CHECK(calories_per_100g >= 0),
        protein_percentage REAL NOT NULL CHECK(protein_percentage >= 0),
        category TEXT NOT NULL,
        image_path TEXT,
        thumbnail_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      )
    `);
    
    // Migration: Füge thumbnail_path Spalte hinzu, falls sie nicht existiert
    try {
      const tableInfo = db.prepare("PRAGMA table_info(food_items)").all();
      const hasThumbnailPath = tableInfo.some(col => col.name === 'thumbnail_path');
      if (!hasThumbnailPath) {
        logger.info('Adding thumbnail_path column to food_items table');
        db.exec('ALTER TABLE food_items ADD COLUMN thumbnail_path TEXT');
      }
    } catch (migrationError) {
      logger.warn('Error checking/adding thumbnail_path to food_items table:', migrationError.message);
    }
    
    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_uric_acid_user_timestamp 
      ON uric_acid_values(user_id, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_meals_user_timestamp 
      ON meals(user_id, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_meal_components_meal_id 
      ON meal_components(meal_id);
      
      CREATE INDEX IF NOT EXISTS idx_food_items_user_id 
      ON food_items(user_id);
      
      CREATE INDEX IF NOT EXISTS idx_food_items_user_name 
      ON food_items(user_id, name);
      
      CREATE INDEX IF NOT EXISTS idx_analysis_user_date 
      ON analysis_results(user_id, analysis_date);
      
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash 
      ON api_keys(key_hash);
      
      CREATE INDEX IF NOT EXISTS idx_api_keys_is_active 
      ON api_keys(is_active);
    `);
    
    logger.info('Database tables created');
    
    // Erstelle Admin-Konto für Development, falls es nicht existiert
    if (process.env.NODE_ENV === 'development') {
      createDevAdminAccount();
    }
  } catch (error) {
    logger.error('Failed to create tables:', error);
    throw error;
  }
}

function createDevAdminAccount() {
  try {
    const bcrypt = require('bcrypt');
    const User = require('./models/User');
    const { v4: uuidv4 } = require('uuid');
    
    // Prüfe ob Admin-Konto bereits existiert
    const existingAdmin = User.findByUsername('admin');
    if (existingAdmin) {
      logger.info('Development admin account already exists');
      return;
    }
    
    // Erstelle Admin-Konto
    const passwordHash = bcrypt.hashSync('N6M6M:S3x$3-33R1LSsS', 10);
    const guid = uuidv4();
    
    const db = getDatabase();
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, guid, username, password_hash, is_admin, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, guid, 'admin', passwordHash, 1, 'admin@dev.gout-diary.com');
    
    logger.info('Development admin account created: username=admin');
  } catch (error) {
    logger.error('Failed to create development admin account:', error);
  }
}

function getDatabase() {
  // If using new database system (PostgreSQL), return the wrapper
  if (usingNewSystem) {
    const dbInstance = newDb.getDatabase();

    // For PostgreSQL, create a SQLite-compatible wrapper
    if (dbInstance.type === 'postgres') {
      return {
        prepare: (sql) => {
          return {
            get: async (...params) => {
              let pgSql = sql;
              let paramIndex = 1;
              pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

              const result = await dbInstance.query(pgSql, params);
              return result.rows && result.rows.length > 0 ? result.rows[0] : null;
            },
            all: async (...params) => {
              let pgSql = sql;
              let paramIndex = 1;
              pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

              const result = await dbInstance.query(pgSql, params);
              return result.rows || [];
            },
            run: async (...params) => {
              let pgSql = sql;
              let paramIndex = 1;
              pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

              if (sql.trim().toUpperCase().startsWith('INSERT')) {
                if (!pgSql.includes('RETURNING')) {
                  pgSql += ' RETURNING id';
                }
              }

              const result = await dbInstance.query(pgSql, params);
              return {
                changes: result.rowCount || 0,
                lastInsertRowid: result.rows && result.rows.length > 0 ? result.rows[0].id : null
              };
            }
          };
        },
        exec: async (sql) => {
          await dbInstance.query(sql);
        }
      };
    }

    // For SQLite via new system
    return dbInstance.db;
  }

  // Legacy SQLite
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};


