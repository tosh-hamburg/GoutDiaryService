# PostgreSQL Migration Guide

Diese Anleitung beschreibt die Umstellung des Backend-Services von SQLite auf PostgreSQL.

## Voraussetzungen

- PostgreSQL Server ist installiert und läuft
- Zugriff auf die SQLite-Datenbank (W:\)
- Node.js Backend-Service (Express.js)
- npm-Pakete: `pg` (PostgreSQL Client)

## 1. PostgreSQL-Verbindung einrichten

### 1.1 PostgreSQL-Paket installieren

```bash
npm install pg
```

### 1.2 Datenbankverbindung konfigurieren

Erstelle eine neue Datei `config/database.js`:

```javascript
const { Pool } = require('pg');

// PostgreSQL-Verbindungskonfiguration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gout_diary',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Maximale Anzahl von Clients im Pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test der Verbindung
pool.on('connect', () => {
  console.log('PostgreSQL verbunden');
});

pool.on('error', (err) => {
  console.error('Unerwarteter Fehler bei inaktiver Client-Verbindung', err);
  process.exit(-1);
});

module.exports = pool;
```

### 1.3 Umgebungsvariablen setzen

Erstelle eine `.env` Datei im Backend-Root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gout_diary
DB_USER=postgres
DB_PASSWORD=dein_passwort
```

Installiere `dotenv` falls noch nicht vorhanden:

```bash
npm install dotenv
```

Lade `.env` in deiner Hauptdatei (z.B. `app.js` oder `server.js`):

```javascript
require('dotenv').config();
```

## 2. Datenbank initialisieren

### 2.1 PostgreSQL-Datenbank erstellen

Führe auf dem PostgreSQL-Server aus:

```sql
CREATE DATABASE gout_diary;
CREATE USER gout_diary_user WITH PASSWORD 'sicheres_passwort';
GRANT ALL PRIVILEGES ON DATABASE gout_diary TO gout_diary_user;
```

### 2.2 Schema erstellen

Erstelle eine Datei `scripts/create_schema.sql`:

```sql
-- Erstelle Schema
CREATE SCHEMA IF NOT EXISTS gout_diary;

-- Setze Standard-Schema
SET search_path TO gout_diary, public;

-- Users Tabelle
CREATE TABLE IF NOT EXISTS users (
    guid VARCHAR(255) PRIMARY KEY,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_backup_timestamp VARCHAR(255) NULL,
    gender VARCHAR(50) NULL,
    birth_year INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Uric Acid Values Tabelle
CREATE TABLE IF NOT EXISTS uric_acid_values (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    value REAL NOT NULL,
    factor TEXT NULL,
    notes TEXT NULL,
    fasten INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(guid) ON DELETE CASCADE,
    UNIQUE(user_id, timestamp, value)
);

-- Meals Tabelle
CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    meal_type VARCHAR(50) NOT NULL,
    name TEXT NULL,
    photo_path TEXT NULL,
    thumbnail_path TEXT NULL,
    total_purin INTEGER NOT NULL DEFAULT 0,
    total_uric_acid INTEGER NOT NULL DEFAULT 0,
    total_calories INTEGER NOT NULL DEFAULT 0,
    total_protein REAL NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(guid) ON DELETE CASCADE,
    UNIQUE(user_id, timestamp, meal_type)
);

-- Meal Components Tabelle
CREATE TABLE IF NOT EXISTS meal_components (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER NOT NULL,
    food_item_name TEXT NOT NULL,
    estimated_weight INTEGER NOT NULL,
    purin INTEGER NOT NULL,
    uric_acid INTEGER NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

-- Food Items Tabelle
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name TEXT NOT NULL,
    purin_per_100g INTEGER NOT NULL,
    uric_acid_per_100g INTEGER NOT NULL,
    calories_per_100g INTEGER NOT NULL DEFAULT 0,
    protein_percentage REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    image_path TEXT NULL,
    is_custom INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(guid) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_uric_acid_user_timestamp ON uric_acid_values(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_meals_user_timestamp ON meals(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_meal_components_meal_id ON meal_components(meal_id);
CREATE INDEX IF NOT EXISTS idx_food_items_user_id ON food_items(user_id);
```

Führe das Schema aus:

```bash
psql -U postgres -d gout_diary -f scripts/create_schema.sql
```

## 3. Datenmigration von SQLite zu PostgreSQL

### 3.1 Migrationsskript erstellen

Erstelle `scripts/migrate_sqlite_to_postgres.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

// SQLite-Datenbankpfad
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || 'W:\\gout_diary.db';

// PostgreSQL-Verbindung
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gout_diary',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// SQLite-Datenbank öffnen
const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
  if (err) {
    console.error('Fehler beim Öffnen der SQLite-Datenbank:', err);
    process.exit(1);
  }
  console.log('SQLite-Datenbank geöffnet:', SQLITE_DB_PATH);
});

// Hilfsfunktion: SQLite Query als Promise
function sqliteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Migrationsfunktion
async function migrate() {
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Migration gestartet...\n');

    // 1. Users migrieren
    console.log('Migriere users...');
    const users = await sqliteQuery('SELECT * FROM users');
    for (const user of users) {
      await client.query(
        `INSERT INTO users (guid, registered_at, last_backup_timestamp, gender, birth_year, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (guid) DO UPDATE SET
           last_backup_timestamp = EXCLUDED.last_backup_timestamp,
           gender = EXCLUDED.gender,
           birth_year = EXCLUDED.birth_year,
           updated_at = EXCLUDED.updated_at`,
        [
          user.guid,
          user.registered_at ? new Date(user.registered_at) : new Date(),
          user.last_backup_timestamp || null,
          user.gender || null,
          user.birth_year || null,
          user.created_at ? new Date(user.created_at) : new Date(),
          user.updated_at ? new Date(user.updated_at) : new Date(),
        ]
      );
    }
    console.log(`✓ ${users.length} Benutzer migriert`);

    // 2. Uric Acid Values migrieren
    console.log('Migriere uric_acid_values...');
    const uricAcidValues = await sqliteQuery('SELECT * FROM uric_acid_values');
    for (const value of uricAcidValues) {
      await client.query(
        `INSERT INTO uric_acid_values (user_id, timestamp, value, factor, notes, fasten, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, timestamp, value) DO NOTHING`,
        [
          value.user_id,
          value.timestamp,
          value.value,
          value.factor || null,
          value.notes || null,
          value.fasten || 0,
          value.created_at ? new Date(value.created_at) : new Date(),
        ]
      );
    }
    console.log(`✓ ${uricAcidValues.length} Harnsäurewerte migriert`);

    // 3. Meals migrieren
    console.log('Migriere meals...');
    const meals = await sqliteQuery('SELECT * FROM meals');
    const mealIdMap = new Map(); // SQLite ID -> PostgreSQL ID
    
    for (const meal of meals) {
      const result = await client.query(
        `INSERT INTO meals (user_id, timestamp, meal_type, name, photo_path, thumbnail_path,
                           total_purin, total_uric_acid, total_calories, total_protein, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (user_id, timestamp, meal_type) DO UPDATE SET
           name = EXCLUDED.name,
           photo_path = EXCLUDED.photo_path,
           thumbnail_path = EXCLUDED.thumbnail_path,
           total_purin = EXCLUDED.total_purin,
           total_uric_acid = EXCLUDED.total_uric_acid,
           total_calories = EXCLUDED.total_calories,
           total_protein = EXCLUDED.total_protein,
           notes = EXCLUDED.notes
         RETURNING id`,
        [
          meal.user_id,
          meal.timestamp,
          meal.meal_type,
          meal.name || null,
          meal.photo_path || null,
          meal.thumbnail_path || null,
          meal.total_purin || 0,
          meal.total_uric_acid || 0,
          meal.total_calories || 0,
          meal.total_protein || 0,
          meal.notes || null,
          meal.created_at ? new Date(meal.created_at) : new Date(),
        ]
      );
      mealIdMap.set(meal.id, result.rows[0].id);
    }
    console.log(`✓ ${meals.length} Mahlzeiten migriert`);

    // 4. Meal Components migrieren
    console.log('Migriere meal_components...');
    const mealComponents = await sqliteQuery('SELECT * FROM meal_components');
    for (const component of mealComponents) {
      const newMealId = mealIdMap.get(component.meal_id);
      if (newMealId) {
        await client.query(
          `INSERT INTO meal_components (meal_id, food_item_name, estimated_weight, purin, uric_acid, calories, protein, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newMealId,
            component.food_item_name,
            component.estimated_weight,
            component.purin,
            component.uric_acid,
            component.calories,
            component.protein,
            component.created_at ? new Date(component.created_at) : new Date(),
          ]
        );
      }
    }
    console.log(`✓ ${mealComponents.length} Meal-Komponenten migriert`);

    // 5. Food Items migrieren
    console.log('Migriere food_items...');
    const foodItems = await sqliteQuery('SELECT * FROM food_items');
    for (const item of foodItems) {
      await client.query(
        `INSERT INTO food_items (user_id, name, purin_per_100g, uric_acid_per_100g, calories_per_100g,
                                protein_percentage, category, image_path, is_custom, updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id, name) DO UPDATE SET
           purin_per_100g = EXCLUDED.purin_per_100g,
           uric_acid_per_100g = EXCLUDED.uric_acid_per_100g,
           calories_per_100g = EXCLUDED.calories_per_100g,
           protein_percentage = EXCLUDED.protein_percentage,
           category = EXCLUDED.category,
           image_path = EXCLUDED.image_path,
           is_custom = EXCLUDED.is_custom,
           updated_at = EXCLUDED.updated_at`,
        [
          item.user_id,
          item.name,
          item.purin_per_100g,
          item.uric_acid_per_100g,
          item.calories_per_100g || 0,
          item.protein_percentage || 0,
          item.category,
          item.image_path || null,
          item.is_custom || 0,
          item.updated_at ? new Date(item.updated_at) : new Date(),
          item.created_at ? new Date(item.created_at) : new Date(),
        ]
      );
    }
    console.log(`✓ ${foodItems.length} Food Items migriert`);

    await client.query('COMMIT');
    console.log('\n✓ Migration erfolgreich abgeschlossen!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fehler bei der Migration:', error);
    throw error;
  } finally {
    client.release();
    sqliteDb.close();
    await pgPool.end();
  }
}

// Migration ausführen
migrate().catch((err) => {
  console.error('Migration fehlgeschlagen:', err);
  process.exit(1);
});
```

### 3.2 Abhängigkeiten installieren

```bash
npm install sqlite3 pg dotenv
```

### 3.3 Migration ausführen

```bash
node scripts/migrate_sqlite_to_postgres.js
```

## 4. Backend-Code anpassen

### 4.1 Datenbank-Modul ersetzen

Ersetze dein SQLite-Datenbankmodul (z.B. `database.js`) durch:

```javascript
const pool = require('./config/database');

// Beispiel: Get Database (für Kompatibilität)
function getDatabase() {
  return pool;
}

// Beispiel: Query-Funktion
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error', { text, error });
    throw error;
  }
}

// Beispiel: Prepared Statements (für Kompatibilität)
function prepare(sql) {
  return {
    all: async (params) => {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    get: async (params) => {
      const result = await pool.query(sql, params);
      return result.rows[0] || null;
    },
    run: async (params) => {
      await pool.query(sql, params);
      return { changes: 0 }; // PostgreSQL gibt changes nicht direkt zurück
    },
  };
}

module.exports = {
  getDatabase: () => pool,
  query,
  prepare,
  pool,
};
```

### 4.2 SQL-Anpassungen

PostgreSQL verwendet andere Syntax als SQLite:

**Unterschiede:**
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `TEXT` → `TEXT` (gleich)
- `REAL` → `REAL` (gleich)
- `DATETIME` → `TIMESTAMP WITH TIME ZONE`
- `COUNT(*)` → gleich, aber `rowCount` statt `changes`
- `GROUP_CONCAT` → `STRING_AGG`

**Beispiel-Anpassung:**

```javascript
// Vorher (SQLite):
const users = db.prepare('SELECT * FROM users').all();

// Nachher (PostgreSQL):
const result = await pool.query('SELECT * FROM users');
const users = result.rows;
```

## 5. Testing

### 5.1 Verbindung testen

```javascript
const pool = require('./config/database');

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('PostgreSQL verbunden:', result.rows[0]);
  } catch (error) {
    console.error('Verbindungsfehler:', error);
  }
}

testConnection();
```

### 5.2 Datenvergleich

Vergleiche die Anzahl der Datensätze:

```sql
-- PostgreSQL
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM uric_acid_values) as uric_acid,
  (SELECT COUNT(*) FROM meals) as meals,
  (SELECT COUNT(*) FROM meal_components) as components,
  (SELECT COUNT(*) FROM food_items) as food_items;
```

## 6. Rollback-Plan

Falls Probleme auftreten:

1. **Backup der SQLite-Datenbank erstellen:**
   ```bash
   cp W:\gout_diary.db W:\gout_diary.db.backup
   ```

2. **PostgreSQL-Datenbank zurücksetzen:**
   ```sql
   DROP DATABASE gout_diary;
   CREATE DATABASE gout_diary;
   ```

3. **Alte SQLite-Verbindung wiederherstellen**

## 7. Produktions-Deployment

1. **Umgebungsvariablen setzen:**
   ```env
   DB_HOST=dein_postgres_server
   DB_PORT=5432
   DB_NAME=gout_diary
   DB_USER=gout_diary_user
   DB_PASSWORD=sicheres_passwort
   SQLITE_DB_PATH=W:\gout_diary.db
   ```

2. **Service neu starten:**
   ```bash
   pm2 restart gout-diary-service
   # oder
   systemctl restart gout-diary-service
   ```

## Unterstützung

Bei Problemen:
- Prüfe PostgreSQL-Logs: `/var/log/postgresql/`
- Prüfe Verbindungslog: `SELECT * FROM pg_stat_activity;`
- Teste Verbindung: `psql -U postgres -d gout_diary`

