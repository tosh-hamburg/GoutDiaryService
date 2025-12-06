/**
 * Debug-Skript zum Prüfen eines API-Keys
 * 
 * Verwendung:
 *   node debug-api-key.js <API_KEY>
 */

const { initDatabase, getDatabase } = require('./src/database');
const { getDbType } = require('./src/db/index');
const ApiKey = require('./src/models/ApiKey');

const apiKey = process.argv[2];

if (!apiKey) {
  console.error('❌ ERROR: API_KEY is required!');
  console.error('Usage: node debug-api-key.js <API_KEY>');
  process.exit(1);
}

async function debugApiKey() {
  try {
    // Initialisiere die Datenbank zuerst
    console.log('🔧 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized\n');
    
    console.log('🔍 Debugging API Key...');
    console.log(`Key: ${apiKey.substring(0, 10)}...`);
    
    const keyRecord = ApiKey.findByKey(apiKey);
    
    if (!keyRecord) {
      console.log('❌ API Key not found');
      return;
    }
    
    console.log('\n📋 API Key Details:');
    console.log(`  ID: ${keyRecord.id}`);
    console.log(`  Name: ${keyRecord.name}`);
    console.log(`  isActive: ${keyRecord.isActive} (type: ${typeof keyRecord.isActive})`);
    console.log(`  canReadOwnUricAcid: ${keyRecord.canReadOwnUricAcid}`);
    console.log(`  canWriteOwnUricAcid: ${keyRecord.canWriteOwnUricAcid}`);
    console.log(`  canReadOwnMeals: ${keyRecord.canReadOwnMeals}`);
    console.log(`  canWriteOwnMeals: ${keyRecord.canWriteOwnMeals}`);
    
    // Prüfe direkt in der Datenbank (ohne is_active Filter, um den rohen Wert zu sehen)
    const db = getDatabase();
    const dbType = getDbType();
    const keyHash = ApiKey.hashKey(apiKey);
    
    console.log(`\n🔑 Key Hash: ${keyHash}`);
    console.log(`  Key Hash length: ${keyHash.length}`);
    console.log(`  Database type: ${dbType}`);
    
    // Prüfe zuerst, ob überhaupt Keys in der Tabelle sind
    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM api_keys');
      const countResult = countStmt.get();
      console.log(`\n📊 Total API keys in database: ${countResult ? countResult.count : 'unknown'}`);
      
      // Zeige alle Key-Hashes (erste 20 Zeichen) für Debugging
      const allKeysStmt = db.prepare('SELECT id, name, LEFT(key_hash, 20) as hash_start, is_active FROM api_keys LIMIT 10');
      const allKeys = allKeysStmt.all();
      if (allKeys.length > 0) {
        console.log(`\n📋 Sample API keys in database:`);
        allKeys.forEach((k, i) => {
          console.log(`  ${i + 1}. ID: ${k.id}, Name: ${k.name}, Hash: ${k.hash_start}..., is_active: ${k.is_active}`);
        });
      }
    } catch (e) {
      console.log(`\n⚠️  Could not query API keys: ${e.message}`);
    }
    
    // Versuche zuerst ohne is_active Filter
    console.log(`\n🔍 Searching for key with hash: ${keyHash.substring(0, 20)}...`);
    const stmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
    const row = stmt.get(keyHash);
    
    console.log(`  Query result: ${row ? 'FOUND' : 'NOT FOUND'}`);
    if (row) {
      console.log(`  Row keys: ${Object.keys(row).join(', ')}`);
      console.log(`  Row values: ${JSON.stringify(row)}`);
      
    } else {
      console.log(`  ❌ Key not found! Checking if hash matches...`);
      // Prüfe ob ein ähnlicher Hash existiert
      try {
        const similarStmt = db.prepare('SELECT id, name, key_hash FROM api_keys LIMIT 5');
        const similarKeys = similarStmt.all();
        console.log(`  Sample hashes in DB:`);
        similarKeys.forEach((k, i) => {
          const match = k.key_hash && k.key_hash.substring(0, 20) === keyHash.substring(0, 20);
          console.log(`    ${i + 1}. ${k.key_hash ? k.key_hash.substring(0, 20) : 'NULL'}... ${match ? '✅ MATCH!' : ''}`);
        });
      } catch (e) {
        console.log(`  Could not check similar hashes: ${e.message}`);
      }
    }
    
    if (row) {
      console.log('\n📊 Raw Database Row (found without is_active filter):');
      console.log(`  is_active: ${row.is_active} (type: ${typeof row.is_active}, value: ${JSON.stringify(row.is_active)})`);
      console.log(`  Full row (excluding key_hash):`, JSON.stringify({
        id: row.id,
        name: row.name,
        is_active: row.is_active,
        can_read_own_uric_acid: row.can_read_own_uric_acid,
        can_write_own_uric_acid: row.can_write_own_uric_acid,
        can_read_own_meals: row.can_read_own_meals,
        can_write_own_meals: row.can_write_own_meals,
        created_at: row.created_at
      }, null, 2));
      
      // Prüfe ob is_active Spalte existiert und welchen Wert sie hat
      console.log('\n🔍 Checking database schema...');
      try {
        const db = getDatabase();
        const dbType = db.type || 'unknown';
        console.log(`  Database type: ${dbType}`);
        
        if (dbType === 'postgres') {
          // PostgreSQL: Prüfe Spalten-Informationen
          const columnInfo = db.prepare(`
            SELECT column_name, data_type, column_default, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'api_keys' AND column_name = 'is_active'
          `).all();
          
          if (columnInfo.length > 0) {
            console.log(`  ✅ Column exists:`, JSON.stringify(columnInfo[0], null, 2));
          } else {
            console.log(`  ❌ Column is_active does not exist in api_keys table!`);
            console.log(`  Available columns:`, db.prepare(`
              SELECT column_name FROM information_schema.columns WHERE table_name = 'api_keys'
            `).all().map(c => c.column_name));
          }
          
          // Prüfe den tatsächlichen Wert direkt in PostgreSQL
          const directQuery = db.prepare(`
            SELECT id, name, is_active, 
                   pg_typeof(is_active) as is_active_type,
                   is_active::text as is_active_text
            FROM api_keys 
            WHERE key_hash = $1
          `);
          const directRow = directQuery.get(keyHash);
          if (directRow) {
            console.log(`\n📊 Direct PostgreSQL query result:`);
            console.log(`  is_active: ${directRow.is_active} (type: ${directRow.is_active_type}, text: ${directRow.is_active_text})`);
          }
        } else {
          // SQLite: Prüfe mit PRAGMA
          const tableInfo = db.prepare("PRAGMA table_info(api_keys)").all();
          const isActiveColumn = tableInfo.find(col => col.name === 'is_active');
          if (isActiveColumn) {
            console.log(`  ✅ Column exists:`, JSON.stringify(isActiveColumn, null, 2));
          } else {
            console.log(`  ❌ Column is_active does not exist!`);
            console.log(`  Available columns:`, tableInfo.map(c => c.name));
          }
        }
      } catch (e) {
        console.log(`  ⚠️  Could not check column: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
      }
      
      // Wenn is_active undefined ist, versuche es zu setzen
      if (row.is_active === undefined || row.is_active === null) {
        console.log('\n⚠️  WARNING: is_active is undefined/null!');
        console.log('  Attempting to fix by setting is_active = TRUE...');
        try {
          const db = getDatabase();
          // Versuche UPDATE mit verschiedenen Formaten
          try {
            const updateStmt = db.prepare('UPDATE api_keys SET is_active = TRUE WHERE key_hash = ?');
            updateStmt.run(keyHash);
            console.log('  ✅ Updated is_active to TRUE (using TRUE)');
          } catch (e1) {
            try {
              const updateStmt = db.prepare('UPDATE api_keys SET is_active = 1 WHERE key_hash = ?');
              updateStmt.run(keyHash);
              console.log('  ✅ Updated is_active to 1 (using INTEGER)');
            } catch (e2) {
              console.log(`  ❌ Failed to update: ${e2.message}`);
              throw e2;
            }
          }
          
          // Lese den Key erneut
          const updatedStmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
          const updatedRow = updatedStmt.get(keyHash);
          if (updatedRow) {
            console.log(`  New is_active value: ${updatedRow.is_active} (type: ${typeof updatedRow.is_active})`);
            console.log(`  ✅ Fix successful! Try using the API key again.`);
          }
        } catch (updateError) {
          console.log(`  ❌ Failed to update: ${updateError.message}`);
          console.log(`  Stack: ${updateError.stack}`);
        }
      }
    } else {
      console.log('\n❌ No row found in database with this key hash');
      console.log('  Trying to find all API keys to see what exists...');
      
      // Zeige alle API-Keys (ohne key_hash für Sicherheit)
      const allStmt = db.prepare('SELECT id, name, is_active, created_at FROM api_keys ORDER BY created_at DESC LIMIT 10');
      const allRows = allStmt.all();
      
      if (allRows.length > 0) {
        console.log(`\n📋 Found ${allRows.length} API key(s) in database:`);
        allRows.forEach((r, i) => {
          console.log(`  ${i + 1}. ID: ${r.id}, Name: ${r.name}, is_active: ${r.is_active} (type: ${typeof r.is_active})`);
        });
      } else {
        console.log('  No API keys found in database at all!');
      }
    }
    
    if (keyRecord.isActive) {
      console.log('\n✅ API Key is active');
    } else {
      console.log('\n❌ API Key is INACTIVE');
      console.log('  This might be the problem!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

debugApiKey();

