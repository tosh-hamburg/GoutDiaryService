const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

let dbType = null; // 'postgres' or 'sqlite'
let postgresPool = null;
let sqliteDb = null;

/**
 * Prüft ob PostgreSQL verfügbar ist
 */
async function checkPostgresAvailability() {
  try {
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    logger.warn('PostgreSQL not available:', error.message);
    return false;
  }
}

/**
 * Initialisiert die Datenbankverbindung
 */
async function initDatabase() {
  try {
    logger.info('Initializing database...');

    // Prüfe ob PostgreSQL verfügbar ist
    const postgresAvailable = await checkPostgresAvailability();

    if (postgresAvailable) {
      logger.info('PostgreSQL is available, using PostgreSQL');
      await initPostgres();
    } else {
      logger.info('PostgreSQL not available, using SQLite');
      initSQLite();
    }

    logger.info(`Database initialized successfully (type: ${dbType})`);
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Initialisiert PostgreSQL
 */
async function initPostgres() {
  try {
    dbType = 'postgres';

    postgresPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await postgresPool.connect();
    logger.info('PostgreSQL connection established');
    client.release();

    // Erstelle Schema
    await createPostgresSchema();

    // Prüfe ob SQLite-Datenbank existiert und migriere
    const sqlitePath = process.env.DB_PATH || './data/harnsaeure.db';
    if (fs.existsSync(sqlitePath)) {
      logger.info(`SQLite database found at ${sqlitePath}, checking if migration needed`);
      await migrateSQLiteToPostgres(sqlitePath);
    } else {
      logger.info('No SQLite database found, skipping migration');
      // Erstelle Standard-Admin-Benutzer
      await createDefaultAdmin();
    }
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL:', error);
    throw error;
  }
}

/**
 * Initialisiert SQLite
 */
function initSQLite() {
  try {
    dbType = 'sqlite';

    const dbPath = process.env.DB_PATH || './data/harnsaeure.db';
    const dbDir = path.dirname(dbPath);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database connection
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');

    logger.info(`SQLite database initialized: ${dbPath}`);

    // Create tables
    createSQLiteTables();
  } catch (error) {
    logger.error('Failed to initialize SQLite:', error);
    throw error;
  }
}

/**
 * Erstellt PostgreSQL-Schema
 */
async function createPostgresSchema() {
  const client = await postgresPool.connect();
  try {
    logger.info('Creating PostgreSQL schema...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        guid TEXT UNIQUE NOT NULL,
        gender TEXT CHECK(gender IN ('MALE', 'FEMALE', 'DIVERSE')),
        birth_year INTEGER CHECK(birth_year >= 1900 AND birth_year <= 2100),
        last_backup_timestamp TIMESTAMPTZ,
        email TEXT,
        google_id TEXT UNIQUE,
        username TEXT UNIQUE,
        password_hash TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for users
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_guid ON users(guid)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    // Uric Acid Values table
    await client.query(`
      CREATE TABLE IF NOT EXISTS uric_acid_values (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        value REAL NOT NULL CHECK(value >= 0 AND value <= 20),
        normal BOOLEAN DEFAULT FALSE,
        much_meat BOOLEAN DEFAULT FALSE,
        much_sport BOOLEAN DEFAULT FALSE,
        much_sugar BOOLEAN DEFAULT FALSE,
        much_alcohol BOOLEAN DEFAULT FALSE,
        fasten BOOLEAN DEFAULT FALSE,
        gout_attack BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Meals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
        name TEXT,
        total_purin INTEGER NOT NULL CHECK(total_purin >= 0),
        total_uric_acid INTEGER NOT NULL CHECK(total_uric_acid >= 0),
        total_calories INTEGER NOT NULL CHECK(total_calories >= 0),
        total_protein REAL NOT NULL CHECK(total_protein >= 0),
        thumbnail_path TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Meal Components table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_components (
        id TEXT PRIMARY KEY,
        meal_id TEXT NOT NULL,
        food_item_name TEXT NOT NULL,
        estimated_weight INTEGER NOT NULL CHECK(estimated_weight >= 0),
        purin INTEGER NOT NULL CHECK(purin >= 0),
        uric_acid INTEGER NOT NULL CHECK(uric_acid >= 0),
        calories INTEGER NOT NULL CHECK(calories >= 0),
        protein REAL NOT NULL CHECK(protein >= 0),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
      )
    `);

    // Analysis Results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        analysis_date TIMESTAMPTZ NOT NULL,
        data_period_start TIMESTAMPTZ NOT NULL,
        data_period_end TIMESTAMPTZ NOT NULL,
        insights TEXT,
        recommendations TEXT,
        confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // API Keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        can_read_own_uric_acid BOOLEAN DEFAULT FALSE,
        can_write_own_uric_acid BOOLEAN DEFAULT FALSE,
        can_read_own_meals BOOLEAN DEFAULT FALSE,
        can_write_own_meals BOOLEAN DEFAULT FALSE,
        can_read_all_uric_acid BOOLEAN DEFAULT FALSE,
        can_read_all_meals BOOLEAN DEFAULT FALSE,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Food Items table
    await client.query(`
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
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_uric_acid_user_timestamp ON uric_acid_values(user_id, timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_meals_user_timestamp ON meals(user_id, timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_meal_components_meal_id ON meal_components(meal_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_food_items_user_id ON food_items(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_food_items_user_name ON food_items(user_id, name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_analysis_user_date ON analysis_results(user_id, analysis_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active)');

    logger.info('PostgreSQL schema created successfully');
  } finally {
    client.release();
  }
}

/**
 * Erstellt SQLite-Tabellen (bestehende Logik)
 */
function createSQLiteTables() {
  // Die bestehende createTables-Logik aus database.js
  const originalDatabase = require('../database');
  // Wir verwenden die bestehende Implementierung
  logger.info('Using existing SQLite table creation logic');
}

/**
 * Migriert Daten von SQLite zu PostgreSQL
 */
async function migrateSQLiteToPostgres(sqlitePath) {
  const client = await postgresPool.connect();

  try {
    logger.info('Starting migration from SQLite to PostgreSQL...');

    // Prüfe ob bereits Daten in PostgreSQL existieren
    const { rows } = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(rows[0].count) > 0) {
      logger.info('PostgreSQL database already contains data, skipping migration');
      return;
    }

    // Öffne SQLite-Datenbank
    const sourceDb = new Database(sqlitePath, { readonly: true });

    await client.query('BEGIN');

    // Migriere Users
    const users = sourceDb.prepare('SELECT * FROM users').all();
    logger.info(`Migrating ${users.length} users...`);
    for (const user of users) {
      await client.query(`
        INSERT INTO users (id, guid, gender, birth_year, last_backup_timestamp, email, google_id, username, password_hash, is_admin, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [
        user.id,
        user.guid,
        user.gender,
        user.birth_year,
        user.last_backup_timestamp,
        user.email,
        user.google_id,
        user.username,
        user.password_hash,
        user.is_admin === 1,
        user.created_at,
        user.updated_at
      ]);
    }

    // Migriere Uric Acid Values
    const uricAcidValues = sourceDb.prepare('SELECT * FROM uric_acid_values').all();
    logger.info(`Migrating ${uricAcidValues.length} uric acid values...`);
    for (const value of uricAcidValues) {
      await client.query(`
        INSERT INTO uric_acid_values (id, user_id, timestamp, value, normal, much_meat, much_sport, much_sugar, much_alcohol, fasten, gout_attack, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `, [
        value.id,
        value.user_id,
        value.timestamp,
        value.value,
        value.normal === 1,
        value.much_meat === 1,
        value.much_sport === 1,
        value.much_sugar === 1,
        value.much_alcohol === 1,
        value.fasten === 1,
        value.gout_attack === 1,
        value.notes,
        value.created_at
      ]);
    }

    // Migriere Meals
    const meals = sourceDb.prepare('SELECT * FROM meals').all();
    logger.info(`Migrating ${meals.length} meals...`);
    for (const meal of meals) {
      await client.query(`
        INSERT INTO meals (id, user_id, timestamp, meal_type, name, total_purin, total_uric_acid, total_calories, total_protein, thumbnail_path, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        meal.id,
        meal.user_id,
        meal.timestamp,
        meal.meal_type,
        meal.name,
        meal.total_purin,
        meal.total_uric_acid,
        meal.total_calories,
        meal.total_protein,
        meal.thumbnail_path,
        meal.created_at
      ]);
    }

    // Migriere Meal Components
    const mealComponents = sourceDb.prepare('SELECT * FROM meal_components').all();
    logger.info(`Migrating ${mealComponents.length} meal components...`);
    for (const component of mealComponents) {
      await client.query(`
        INSERT INTO meal_components (id, meal_id, food_item_name, estimated_weight, purin, uric_acid, calories, protein, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        component.id,
        component.meal_id,
        component.food_item_name,
        component.estimated_weight,
        component.purin,
        component.uric_acid,
        component.calories,
        component.protein,
        component.created_at
      ]);
    }

    // Migriere Food Items
    const foodItems = sourceDb.prepare('SELECT * FROM food_items').all();
    logger.info(`Migrating ${foodItems.length} food items...`);
    for (const item of foodItems) {
      await client.query(`
        INSERT INTO food_items (id, user_id, name, purin_per_100g, uric_acid_per_100g, calories_per_100g, protein_percentage, category, image_path, thumbnail_path, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [
        item.id,
        item.user_id,
        item.name,
        item.purin_per_100g,
        item.uric_acid_per_100g,
        item.calories_per_100g,
        item.protein_percentage,
        item.category,
        item.image_path,
        item.thumbnail_path,
        item.created_at,
        item.updated_at
      ]);
    }

    // Migriere Analysis Results
    try {
      const analysisResults = sourceDb.prepare('SELECT * FROM analysis_results').all();
      logger.info(`Migrating ${analysisResults.length} analysis results...`);
      for (const result of analysisResults) {
        await client.query(`
          INSERT INTO analysis_results (id, user_id, analysis_date, data_period_start, data_period_end, insights, recommendations, confidence_score, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          result.id,
          result.user_id,
          result.analysis_date,
          result.data_period_start,
          result.data_period_end,
          result.insights,
          result.recommendations,
          result.confidence_score,
          result.created_at
        ]);
      }
    } catch (err) {
      logger.warn('Could not migrate analysis_results (table might not exist):', err.message);
    }

    // Migriere API Keys
    try {
      const apiKeys = sourceDb.prepare('SELECT * FROM api_keys').all();
      logger.info(`Migrating ${apiKeys.length} API keys...`);
      for (const key of apiKeys) {
        await client.query(`
          INSERT INTO api_keys (id, key_hash, name, description, can_read_own_uric_acid, can_write_own_uric_acid, can_read_own_meals, can_write_own_meals, can_read_all_uric_acid, can_read_all_meals, created_by, created_at, last_used_at, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING
        `, [
          key.id,
          key.key_hash,
          key.name,
          key.description,
          key.can_read_own_uric_acid === 1,
          key.can_write_own_uric_acid === 1,
          key.can_read_own_meals === 1,
          key.can_write_own_meals === 1,
          key.can_read_all_uric_acid === 1,
          key.can_read_all_meals === 1,
          key.created_by,
          key.created_at,
          key.last_used_at,
          key.is_active === 1
        ]);
      }
    } catch (err) {
      logger.warn('Could not migrate api_keys (table might not exist):', err.message);
    }

    await client.query('COMMIT');
    sourceDb.close();

    logger.info('Migration completed successfully!');
    logger.info('Renaming SQLite database to .migrated...');

    // Benenne SQLite-Datenbank um
    const migratedPath = sqlitePath + '.migrated';
    fs.renameSync(sqlitePath, migratedPath);

    logger.info(`SQLite database renamed to ${migratedPath}`);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Erstellt Standard-Admin-Benutzer
 */
async function createDefaultAdmin() {
  const client = await postgresPool.connect();

  try {
    // Prüfe ob bereits ein Admin existiert
    const { rows } = await client.query('SELECT COUNT(*) as count FROM users WHERE email = $1', ['dunker.thorsten@gmail.com']);

    if (parseInt(rows[0].count) > 0) {
      logger.info('Default admin user already exists');
      return;
    }

    logger.info('Creating default admin user...');

    const id = uuidv4();
    const guid = uuidv4();
    const passwordHash = await bcrypt.hash('tosh&123', 10);

    await client.query(`
      INSERT INTO users (id, guid, email, username, password_hash, is_admin)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, guid, 'dunker.thorsten@gmail.com', 'thorsten.dunker', passwordHash, true]);

    logger.info('Default admin user created: dunker.thorsten@gmail.com');
  } catch (error) {
    logger.error('Failed to create default admin user:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gibt die Datenbankverbindung zurück
 */
function getDatabase() {
  if (dbType === 'postgres') {
    return {
      type: 'postgres',
      pool: postgresPool,
      query: async (text, params) => {
        const client = await postgresPool.connect();
        try {
          const result = await client.query(text, params);
          return result;
        } finally {
          client.release();
        }
      }
    };
  } else if (dbType === 'sqlite') {
    return {
      type: 'sqlite',
      db: sqliteDb
    };
  } else {
    throw new Error('Database not initialized');
  }
}

/**
 * Schließt die Datenbankverbindung
 */
async function closeDatabase() {
  if (dbType === 'postgres' && postgresPool) {
    await postgresPool.end();
    logger.info('PostgreSQL connection pool closed');
  } else if (dbType === 'sqlite' && sqliteDb) {
    sqliteDb.close();
    logger.info('SQLite connection closed');
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  getDbType: () => dbType
};
