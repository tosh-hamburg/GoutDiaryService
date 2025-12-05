/**
 * Migrationsskript: SQLite zu PostgreSQL
 * 
 * Verwendung:
 * 1. Stelle sicher, dass PostgreSQL läuft und die Datenbank erstellt wurde
 * 2. Setze Umgebungsvariablen in .env:
 *    - SQLITE_DB_PATH=W:\gout_diary.db
 *    - DB_HOST=localhost
 *    - DB_PORT=5432
 *    - DB_NAME=gout_diary
 *    - DB_USER=postgres
 *    - DB_PASSWORD=dein_passwort
 * 3. Führe aus: node scripts/migrate_sqlite_to_postgres.js
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

// SQLite-Datenbankpfad
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || 'W:\\gout_diary.db';

// PostgreSQL-Verbindung
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gout_diary',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  schema: 'gout_diary',
});

// SQLite-Datenbank öffnen
const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Fehler beim Öffnen der SQLite-Datenbank:', err.message);
    console.error('   Pfad:', SQLITE_DB_PATH);
    process.exit(1);
  }
  console.log('✓ SQLite-Datenbank geöffnet:', SQLITE_DB_PATH);
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

// Hilfsfunktion: SQLite Get als Promise
function sqliteGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Migrationsfunktion
async function migrate() {
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('\n🚀 Migration gestartet...\n');

    // Setze Schema
    await client.query('SET search_path TO gout_diary, public');

    // 1. Users migrieren
    console.log('📋 Migriere users...');
    const users = await sqliteQuery('SELECT * FROM users');
    let usersMigrated = 0;
    for (const user of users) {
      try {
        await client.query(
          `INSERT INTO gout_diary.users (guid, registered_at, last_backup_timestamp, gender, birth_year, created_at, updated_at)
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
        usersMigrated++;
      } catch (err) {
        console.error(`   ⚠️  Fehler bei User ${user.guid}:`, err.message);
      }
    }
    console.log(`   ✓ ${usersMigrated} von ${users.length} Benutzern migriert`);

    // 2. Uric Acid Values migrieren
    console.log('📋 Migriere uric_acid_values...');
    const uricAcidValues = await sqliteQuery('SELECT * FROM uric_acid_values ORDER BY id');
    let uricAcidMigrated = 0;
    let uricAcidSkipped = 0;
    for (const value of uricAcidValues) {
      try {
        const result = await client.query(
          `INSERT INTO gout_diary.uric_acid_values (user_id, timestamp, value, factor, notes, fasten, created_at)
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
        if (result.rowCount > 0) {
          uricAcidMigrated++;
        } else {
          uricAcidSkipped++;
        }
      } catch (err) {
        console.error(`   ⚠️  Fehler bei Uric Acid Value ID ${value.id}:`, err.message);
      }
    }
    console.log(`   ✓ ${uricAcidMigrated} Harnsäurewerte migriert (${uricAcidSkipped} übersprungen)`);

    // 3. Meals migrieren
    console.log('📋 Migriere meals...');
    const meals = await sqliteQuery('SELECT * FROM meals ORDER BY id');
    const mealIdMap = new Map(); // SQLite ID -> PostgreSQL ID
    let mealsMigrated = 0;
    
    for (const meal of meals) {
      try {
        const result = await client.query(
          `INSERT INTO gout_diary.meals (user_id, timestamp, meal_type, name, photo_path, thumbnail_path,
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
        if (result.rows.length > 0) {
          mealIdMap.set(meal.id, result.rows[0].id);
          mealsMigrated++;
        }
      } catch (err) {
        console.error(`   ⚠️  Fehler bei Meal ID ${meal.id}:`, err.message);
      }
    }
    console.log(`   ✓ ${mealsMigrated} Mahlzeiten migriert`);

    // 4. Meal Components migrieren
    console.log('📋 Migriere meal_components...');
    const mealComponents = await sqliteQuery('SELECT * FROM meal_components ORDER BY id');
    let componentsMigrated = 0;
    let componentsSkipped = 0;
    
    for (const component of mealComponents) {
      const newMealId = mealIdMap.get(component.meal_id);
      if (newMealId) {
        try {
          await client.query(
            `INSERT INTO gout_diary.meal_components (meal_id, food_item_name, estimated_weight, purin, uric_acid, calories, protein, created_at)
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
          componentsMigrated++;
        } catch (err) {
          console.error(`   ⚠️  Fehler bei Meal Component ID ${component.id}:`, err.message);
        }
      } else {
        componentsSkipped++;
      }
    }
    console.log(`   ✓ ${componentsMigrated} Meal-Komponenten migriert (${componentsSkipped} übersprungen - Meal nicht gefunden)`);

    // 5. Food Items migrieren
    console.log('📋 Migriere food_items...');
    const foodItems = await sqliteQuery('SELECT * FROM food_items ORDER BY id');
    let foodItemsMigrated = 0;
    
    for (const item of foodItems) {
      try {
        await client.query(
          `INSERT INTO gout_diary.food_items (user_id, name, purin_per_100g, uric_acid_per_100g, calories_per_100g,
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
        foodItemsMigrated++;
      } catch (err) {
        console.error(`   ⚠️  Fehler bei Food Item ID ${item.id}:`, err.message);
      }
    }
    console.log(`   ✓ ${foodItemsMigrated} Food Items migriert`);

    await client.query('COMMIT');
    console.log('\n✅ Migration erfolgreich abgeschlossen!\n');
    
    // Statistiken
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM gout_diary.users) as users,
        (SELECT COUNT(*) FROM gout_diary.uric_acid_values) as uric_acid,
        (SELECT COUNT(*) FROM gout_diary.meals) as meals,
        (SELECT COUNT(*) FROM gout_diary.meal_components) as components,
        (SELECT COUNT(*) FROM gout_diary.food_items) as food_items
    `);
    
    console.log('📊 PostgreSQL-Datenbank-Statistiken:');
    console.log('   Users:', stats.rows[0].users);
    console.log('   Uric Acid Values:', stats.rows[0].uric_acid);
    console.log('   Meals:', stats.rows[0].meals);
    console.log('   Meal Components:', stats.rows[0].components);
    console.log('   Food Items:', stats.rows[0].food_items);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Fehler bei der Migration:', error);
    throw error;
  } finally {
    client.release();
    sqliteDb.close();
    await pgPool.end();
  }
}

// Migration ausführen
console.log('🔧 SQLite zu PostgreSQL Migration');
console.log('================================\n');
console.log('SQLite DB:', SQLITE_DB_PATH);
console.log('PostgreSQL:', `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'gout_diary'}`);
console.log('');

migrate().catch((err) => {
  console.error('\n❌ Migration fehlgeschlagen:', err);
  process.exit(1);
});

