/**
 * Debug-Skript für Benutzer-Daten
 * 
 * Prüft:
 * - Ob der User existiert
 * - Welche User-ID er hat
 * - Ob Daten mit dieser User-ID existieren
 * - Ob es mehrere User-Einträge mit derselben GUID gibt
 * 
 * Verwendung:
 *   node debug-user-data.js <GUID>
 * 
 * Beispiel:
 *   node debug-user-data.js 9455224b-bb6a-4e88-a082-e3a9aa6524cb
 */

const { initDatabase, getDatabase } = require('./src/database');
const User = require('./src/models/User');
const UricAcidValue = require('./src/models/UricAcidValue');
const Meal = require('./src/models/Meal');
const FoodItem = require('./src/models/FoodItem');

const USER_GUID = process.argv[2];

if (!USER_GUID) {
  console.error('❌ ERROR: GUID ist erforderlich!');
  console.error('Usage: node debug-user-data.js <GUID>');
  process.exit(1);
}

async function debugUserData() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('User Data Debug');
    console.log('='.repeat(60));
    console.log(`User GUID: ${USER_GUID}\n`);

    // Initialisiere Datenbank
    await initDatabase();
    const db = getDatabase();

    // 1. Prüfe ob User existiert
    console.log('1. Prüfe User-Einträge...');
    const user = await User.findByGuid(USER_GUID);
    
    if (!user) {
      console.log('❌ User nicht gefunden!');
      
      // Prüfe ob es User mit ähnlicher GUID gibt
      const allUsersStmt = db.prepare('SELECT id, guid, email, created_at FROM users ORDER BY created_at DESC LIMIT 10');
      const allUsers = await allUsersStmt.all();
      console.log('\nLetzte 10 User in der Datenbank:');
      allUsers.forEach(u => {
        console.log(`  - GUID: ${u.guid}, ID: ${u.id}, Email: ${u.email || 'N/A'}, Created: ${u.created_at}`);
      });
      
      process.exit(1);
    }
    
    console.log('✅ User gefunden:');
    console.log(`   ID: ${user.id}`);
    console.log(`   GUID: ${user.guid}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Created: ${user.createdAt || 'N/A'}`);
    console.log(`   Last Backup: ${user.lastBackupTimestamp || 'N/A'}`);

    // 2. Prüfe ob es mehrere User mit derselben GUID gibt
    console.log('\n2. Prüfe auf doppelte GUIDs...');
    const duplicateGuidStmt = db.prepare('SELECT id, guid, email, created_at FROM users WHERE guid = ?');
    const duplicateUsers = await duplicateGuidStmt.all(USER_GUID);
    
    if (duplicateUsers.length > 1) {
      console.log(`⚠️  WARNUNG: ${duplicateUsers.length} User-Einträge mit derselben GUID gefunden!`);
      duplicateUsers.forEach((u, index) => {
        console.log(`   ${index + 1}. ID: ${u.id}, Email: ${u.email || 'N/A'}, Created: ${u.created_at}`);
      });
    } else {
      console.log('✅ Nur ein User-Eintrag mit dieser GUID');
    }

    // 3. Prüfe Daten mit der aktuellen User-ID
    const userId = user.id;
    console.log(`\n3. Prüfe Daten mit User-ID: ${userId}...`);
    
    // UricAcid Values
    const uricAcidValues = await UricAcidValue.findByUserId(userId);
    console.log(`   UricAcid Values: ${uricAcidValues.length}`);
    
    // Meals
    const meals = await Meal.findByUserId(userId);
    console.log(`   Meals: ${meals.length}`);
    
    // FoodItems
    const foodItems = await FoodItem.findByUserId(userId);
    console.log(`   FoodItems: ${foodItems.length}`);

    // 4. Prüfe ob es Daten mit anderen User-IDs gibt, die möglicherweise zu diesem User gehören
    console.log('\n4. Prüfe auf Daten mit anderen User-IDs...');
    
    // Alle User-IDs, die in den Tabellen verwendet werden
    const uricAcidUserIdsStmt = db.prepare('SELECT DISTINCT user_id, COUNT(*) as count FROM uric_acid_values GROUP BY user_id');
    const uricAcidUserIds = await uricAcidUserIdsStmt.all();
    
    const mealUserIdsStmt = db.prepare('SELECT DISTINCT user_id, COUNT(*) as count FROM meals GROUP BY user_id');
    const mealUserIds = await mealUserIdsStmt.all();
    
    const foodItemUserIdsStmt = db.prepare('SELECT DISTINCT user_id, COUNT(*) as count FROM food_items GROUP BY user_id');
    const foodItemUserIds = await foodItemUserIdsStmt.all();
    
    console.log('\n   Alle User-IDs in den Tabellen:');
    console.log('   UricAcid Values:');
    uricAcidUserIds.forEach(row => {
      const isCurrentUser = row.user_id === userId;
      const marker = isCurrentUser ? ' ← AKTUELLER USER' : '';
      console.log(`     - User-ID: ${row.user_id}, Count: ${row.count}${marker}`);
    });
    
    console.log('   Meals:');
    mealUserIds.forEach(row => {
      const isCurrentUser = row.user_id === userId;
      const marker = isCurrentUser ? ' ← AKTUELLER USER' : '';
      console.log(`     - User-ID: ${row.user_id}, Count: ${row.count}${marker}`);
    });
    
    console.log('   FoodItems:');
    foodItemUserIds.forEach(row => {
      const isCurrentUser = row.user_id === userId;
      const marker = isCurrentUser ? ' ← AKTUELLER USER' : '';
      console.log(`     - User-ID: ${row.user_id}, Count: ${row.count}${marker}`);
    });

    // 5. Prüfe ob es User-Einträge mit anderen IDs gibt, die möglicherweise zu diesem User gehören
    console.log('\n5. Prüfe auf User-Einträge mit anderen IDs...');
    const allUsersWithDataStmt = db.prepare(`
      SELECT u.id, u.guid, u.email, u.created_at,
        (SELECT COUNT(*) FROM uric_acid_values WHERE user_id = u.id) as uric_acid_count,
        (SELECT COUNT(*) FROM meals WHERE user_id = u.id) as meal_count,
        (SELECT COUNT(*) FROM food_items WHERE user_id = u.id) as food_item_count
      FROM users u
      WHERE u.guid = ? OR u.id IN (
        SELECT DISTINCT user_id FROM uric_acid_values
        UNION
        SELECT DISTINCT user_id FROM meals
        UNION
        SELECT DISTINCT user_id FROM food_items
      )
      ORDER BY u.created_at DESC
    `);
    const allUsersWithData = await allUsersWithDataStmt.all(USER_GUID);
    
    console.log(`\n   Gefundene User-Einträge (mit Daten oder gleicher GUID):`);
    allUsersWithData.forEach((u, index) => {
      const isCurrentUser = u.id === userId;
      const isSameGuid = u.guid === USER_GUID;
      const marker = isCurrentUser ? ' ← AKTUELLER USER' : (isSameGuid ? ' ← GLEICHE GUID!' : '');
      console.log(`   ${index + 1}. ID: ${u.id}, GUID: ${u.guid}, Email: ${u.email || 'N/A'}, Created: ${u.created_at}`);
      console.log(`      UricAcid: ${u.uric_acid_count || 0}, Meals: ${u.meal_count || 0}, FoodItems: ${u.food_item_count || 0}${marker}`);
    });
    
    // 6. Prüfe welche GUIDs zu den User-IDs mit Daten gehören
    console.log('\n6. Prüfe GUIDs der User-IDs mit Daten...');
    const userIdsWithData = [...new Set([
      ...uricAcidUserIds.map(r => r.user_id),
      ...mealUserIds.map(r => r.user_id),
      ...foodItemUserIds.map(r => r.user_id)
    ])];
    
    for (const dataUserId of userIdsWithData) {
      const userWithData = await User.findById(dataUserId);
      if (userWithData) {
        const isSameGuid = userWithData.guid === USER_GUID;
        const marker = isSameGuid ? ' ← GLEICHE GUID!' : '';
        console.log(`   User-ID: ${dataUserId}`);
        console.log(`     GUID: ${userWithData.guid}${marker}`);
        console.log(`     Email: ${userWithData.email || 'N/A'}`);
        console.log(`     Created: ${userWithData.createdAt || 'N/A'}`);
      } else {
        console.log(`   User-ID: ${dataUserId} → User nicht gefunden!`);
      }
    }

    // 7. Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('Zusammenfassung');
    console.log('='.repeat(60));
    console.log(`User-ID: ${userId}`);
    console.log(`UricAcid Values: ${uricAcidValues.length}`);
    console.log(`Meals: ${meals.length}`);
    console.log(`FoodItems: ${foodItems.length}`);
    
    if (uricAcidValues.length === 0 && meals.length === 0 && foodItems.length === 0) {
      console.log('\n⚠️  WARNUNG: Keine Daten für diesen User gefunden!');
      console.log('   Mögliche Ursachen:');
      console.log('   - Daten wurden mit einer anderen User-ID gespeichert');
      console.log('   - Daten wurden gelöscht');
      console.log('   - Migration hat die User-ID geändert');
      
      // Prüfe ob es Daten mit derselben GUID gibt
      const usersWithSameGuid = allUsersWithData.filter(u => u.guid === USER_GUID && u.id !== userId);
      if (usersWithSameGuid.length > 0) {
        console.log('\n   ⚠️  GEFUNDEN: Es gibt andere User-Einträge mit derselben GUID, die Daten haben!');
        usersWithSameGuid.forEach(u => {
          console.log(`   - User-ID: ${u.id}, UricAcid: ${u.uric_acid_count || 0}, Meals: ${u.meal_count || 0}, FoodItems: ${u.food_item_count || 0}`);
        });
      }
    } else {
      console.log('\n✅ Daten gefunden');
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Fehler:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

debugUserData();

