/**
 * Migrationsskript für Benutzer-Daten
 * 
 * Verschiebt Daten von einer User-ID auf eine andere User-ID
 * 
 * WICHTIG: Dieses Skript sollte nur verwendet werden, wenn sicher ist,
 * dass die Daten wirklich zu dem Ziel-User gehören!
 * 
 * Verwendung:
 *   node migrate-user-data.js <SOURCE_USER_ID> <TARGET_USER_ID>
 * 
 * Beispiel:
 *   node migrate-user-data.js 4a46fd3e-e56b-44b6-b82f-52bc457c6f4d dc05ff72-e48e-442c-8c99-42cdd15e7605
 */

const { initDatabase, getDatabase } = require('./src/database');
const User = require('./src/models/User');
const UricAcidValue = require('./src/models/UricAcidValue');
const Meal = require('./src/models/Meal');
const FoodItem = require('./src/models/FoodItem');

const SOURCE_USER_ID = process.argv[2];
const TARGET_USER_ID = process.argv[3];

if (!SOURCE_USER_ID || !TARGET_USER_ID) {
  console.error('❌ ERROR: Beide User-IDs sind erforderlich!');
  console.error('Usage: node migrate-user-data.js <SOURCE_USER_ID> <TARGET_USER_ID>');
  process.exit(1);
}

async function migrateUserData() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('User Data Migration');
    console.log('='.repeat(60));
    console.log(`Source User-ID: ${SOURCE_USER_ID}`);
    console.log(`Target User-ID: ${TARGET_USER_ID}\n`);

    // Initialisiere Datenbank
    await initDatabase();
    const db = getDatabase();

    // Prüfe ob beide User existieren
    console.log('1. Prüfe User-Einträge...');
    const sourceUser = await User.findById(SOURCE_USER_ID);
    const targetUser = await User.findById(TARGET_USER_ID);
    
    if (!sourceUser) {
      console.error(`❌ Source User nicht gefunden: ${SOURCE_USER_ID}`);
      process.exit(1);
    }
    
    if (!targetUser) {
      console.error(`❌ Target User nicht gefunden: ${TARGET_USER_ID}`);
      process.exit(1);
    }
    
    console.log('✅ Source User gefunden:');
    console.log(`   ID: ${sourceUser.id}`);
    console.log(`   GUID: ${sourceUser.guid}`);
    console.log(`   Email: ${sourceUser.email || 'N/A'}`);
    
    console.log('\n✅ Target User gefunden:');
    console.log(`   ID: ${targetUser.id}`);
    console.log(`   GUID: ${targetUser.guid}`);
    console.log(`   Email: ${targetUser.email || 'N/A'}`);

    // Prüfe Daten vor Migration
    console.log('\n2. Prüfe Daten vor Migration...');
    const sourceUricAcid = await UricAcidValue.findByUserId(SOURCE_USER_ID);
    const sourceMeals = await Meal.findByUserId(SOURCE_USER_ID);
    const sourceFoodItems = await FoodItem.findByUserId(SOURCE_USER_ID);
    
    const targetUricAcid = await UricAcidValue.findByUserId(TARGET_USER_ID);
    const targetMeals = await Meal.findByUserId(TARGET_USER_ID);
    const targetFoodItems = await FoodItem.findByUserId(TARGET_USER_ID);
    
    console.log(`Source User Daten:`);
    console.log(`   UricAcid Values: ${sourceUricAcid.length}`);
    console.log(`   Meals: ${sourceMeals.length}`);
    console.log(`   FoodItems: ${sourceFoodItems.length}`);
    
    console.log(`\nTarget User Daten (vor Migration):`);
    console.log(`   UricAcid Values: ${targetUricAcid.length}`);
    console.log(`   Meals: ${targetMeals.length}`);
    console.log(`   FoodItems: ${targetFoodItems.length}`);

    if (sourceUricAcid.length === 0 && sourceMeals.length === 0 && sourceFoodItems.length === 0) {
      console.log('\n⚠️  WARNUNG: Source User hat keine Daten!');
      process.exit(1);
    }

    // Bestätigung
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  WARNUNG: Diese Aktion kann nicht rückgängig gemacht werden!');
    console.log('='.repeat(60));
    console.log(`Es werden ${sourceUricAcid.length} UricAcid Values, ${sourceMeals.length} Meals und ${sourceFoodItems.length} FoodItems migriert.`);
    console.log(`Von User-ID: ${SOURCE_USER_ID} (GUID: ${sourceUser.guid})`);
    console.log(`Zu User-ID: ${TARGET_USER_ID} (GUID: ${targetUser.guid})`);
    console.log('='.repeat(60));
    console.log('\nDrücken Sie STRG+C zum Abbrechen, oder warten Sie 5 Sekunden...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Migration durchführen
    console.log('3. Starte Migration...\n');
    
    // Migriere UricAcid Values
    if (sourceUricAcid.length > 0) {
      console.log(`   Migriere ${sourceUricAcid.length} UricAcid Values...`);
      const updateUricAcidStmt = db.prepare('UPDATE uric_acid_values SET user_id = ? WHERE user_id = ?');
      const result = await updateUricAcidStmt.run(TARGET_USER_ID, SOURCE_USER_ID);
      console.log(`   ✅ ${result.changes || 0} UricAcid Values migriert`);
    }
    
    // Migriere Meals
    if (sourceMeals.length > 0) {
      console.log(`   Migriere ${sourceMeals.length} Meals...`);
      const updateMealsStmt = db.prepare('UPDATE meals SET user_id = ? WHERE user_id = ?');
      const result = await updateMealsStmt.run(TARGET_USER_ID, SOURCE_USER_ID);
      console.log(`   ✅ ${result.changes || 0} Meals migriert`);
    }
    
    // Migriere FoodItems
    if (sourceFoodItems.length > 0) {
      console.log(`   Migriere ${sourceFoodItems.length} FoodItems...`);
      const updateFoodItemsStmt = db.prepare('UPDATE food_items SET user_id = ? WHERE user_id = ?');
      const result = await updateFoodItemsStmt.run(TARGET_USER_ID, SOURCE_USER_ID);
      console.log(`   ✅ ${result.changes || 0} FoodItems migriert`);
    }

    // Prüfe Daten nach Migration
    console.log('\n4. Prüfe Daten nach Migration...');
    const finalTargetUricAcid = await UricAcidValue.findByUserId(TARGET_USER_ID);
    const finalTargetMeals = await Meal.findByUserId(TARGET_USER_ID);
    const finalTargetFoodItems = await FoodItem.findByUserId(TARGET_USER_ID);
    
    console.log(`Target User Daten (nach Migration):`);
    console.log(`   UricAcid Values: ${finalTargetUricAcid.length}`);
    console.log(`   Meals: ${finalTargetMeals.length}`);
    console.log(`   FoodItems: ${finalTargetFoodItems.length}`);

    // Prüfe ob Source User noch Daten hat
    const finalSourceUricAcid = await UricAcidValue.findByUserId(SOURCE_USER_ID);
    const finalSourceMeals = await Meal.findByUserId(SOURCE_USER_ID);
    const finalSourceFoodItems = await FoodItem.findByUserId(SOURCE_USER_ID);
    
    console.log(`\nSource User Daten (nach Migration):`);
    console.log(`   UricAcid Values: ${finalSourceUricAcid.length}`);
    console.log(`   Meals: ${finalSourceMeals.length}`);
    console.log(`   FoodItems: ${finalSourceFoodItems.length}`);

    // Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('Migration abgeschlossen!');
    console.log('='.repeat(60));
    console.log(`✅ ${finalTargetUricAcid.length} UricAcid Values`);
    console.log(`✅ ${finalTargetMeals.length} Meals`);
    console.log(`✅ ${finalTargetFoodItems.length} FoodItems`);
    console.log(`\nAlle Daten wurden erfolgreich zu User-ID ${TARGET_USER_ID} (GUID: ${targetUser.guid}) migriert.`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Fehler:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

migrateUserData();

