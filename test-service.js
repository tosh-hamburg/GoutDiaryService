/**
 * Testskript für Service-Funktionen
 * 
 * Testet systematisch:
 * - UricAcid: Create, Update, Delete
 * - Meals: Create, Update, Delete
 * - FoodItems: Create, Update, Delete
 * - Restore/Batch-Download: Alle Daten für die App
 * 
 * Verwendung:
 *   node test-service.js <API_KEY> <USER_GUID> [BASE_URL]
 * 
 * Beispiel:
 *   node test-service.js my-api-key 123e4567-e89b-12d3-a456-426614174000 http://localhost:3000
 */

const https = require('https');
const http = require('http');

// Konfiguration
const API_KEY = process.argv[2];
const USER_GUID = process.argv[3] || 'test-user-guid-' + Date.now();
const BASE_URL = process.argv[4] || 'http://localhost:3000';

// Test-Ergebnisse
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Hilfsfunktionen
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    // Stelle sicher, dass der Pfad mit /api/v1 beginnt, wenn er nicht bereits vollständig ist
    let fullPath = path;
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      if (!path.startsWith('/')) {
        fullPath = '/' + path;
      }
      // API-Routen sind unter /api/v1 registriert
      if (!fullPath.startsWith('/api/v1/') && !fullPath.startsWith('/api/v1')) {
        if (fullPath.startsWith('/api/')) {
          // Ersetze /api/ durch /api/v1/
          fullPath = '/api/v1' + fullPath.substring(4);
        } else {
          fullPath = '/api/v1' + fullPath;
        }
      }
    }
    
    const url = new URL(fullPath, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };

    // Debug: Logge die aufgerufene URL
    const requestUrl = url.toString();
    // Zeige URL bei ersten Requests oder wenn DEBUG gesetzt ist
    if (process.env.DEBUG || !makeRequest._requestCount) {
      makeRequest._requestCount = (makeRequest._requestCount || 0) + 1;
      if (makeRequest._requestCount <= 3) { // Zeige nur die ersten 3 Requests
        console.log(`🔍 ${method} ${requestUrl}`);
      }
    } else {
      makeRequest._requestCount = (makeRequest._requestCount || 0) + 1;
    }

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        const isJson = contentType.includes('application/json');
        
        // Wenn die Response HTML ist, ist etwas schief gelaufen
        if (contentType.includes('text/html') || (!isJson && body.trim().startsWith('<'))) {
          const errorMsg = `Server returned HTML instead of JSON.\n` +
            `URL: ${requestUrl}\n` +
            `Status: ${res.statusCode}\n` +
            `This usually means:\n` +
            `- The endpoint doesn't exist (404) - check if path starts with /api/v1/\n` +
            `- Authentication failed (401/403) - check API key\n` +
            `- Server error (500) - check server logs\n` +
            `Response preview: ${body.substring(0, 300)}...`;
          
          reject(new Error(errorMsg));
          return;
        }
        
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
            rawBody: body // Für Debugging
          });
        } catch (e) {
          // Wenn JSON-Parsing fehlschlägt, aber es sollte JSON sein
          if (isJson || body.trim().startsWith('{') || body.trim().startsWith('[')) {
            reject(new Error(`Failed to parse JSON response: ${e.message}. Body: ${body.substring(0, 500)}`));
            return;
          }
          
          // Nicht-JSON Response (z.B. leerer Body)
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body || {},
            rawBody: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}. URL: ${url.toString()}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function log(message, type = 'info') {
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function test(name, testFn) {
  return async () => {
    try {
      log(`Test: ${name}`, 'info');
      await testFn();
      results.passed++;
      log(`✓ ${name} - PASSED`, 'success');
    } catch (error) {
      results.failed++;
      results.errors.push({ test: name, error: error.message });
      log(`✗ ${name} - FAILED: ${error.message}`, 'error');
      // Zeige zusätzliche Debug-Informationen bei Fehlern
      if (error.message.includes('HTML') || error.message.includes('parse')) {
        log(`  → Mögliche Ursachen: Falsche Base URL, fehlender API-Key, oder Server-Fehler`, 'error');
        log(`  → Base URL: ${BASE_URL}`, 'error');
        log(`  → API Key vorhanden: ${API_KEY ? 'Ja (' + API_KEY.substring(0, 10) + '...)' : 'Nein'}`, 'error');
      }
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertStatus(response, expectedStatus, message) {
  if (response.status !== expectedStatus) {
    const responsePreview = typeof response.data === 'string' 
      ? response.data.substring(0, 500) 
      : JSON.stringify(response.data).substring(0, 500);
    throw new Error(
      message || 
      `Expected status ${expectedStatus}, got ${response.status}.\n` +
      `Response: ${responsePreview}${response.rawBody ? '\nRaw body preview: ' + response.rawBody.substring(0, 200) : ''}`
    );
  }
}

function assertSuccess(response, message) {
  // Prüfe zuerst, ob response.data überhaupt existiert
  if (!response.data) {
    throw new Error(
      message || 
      `Response data is missing. Status: ${response.status}. Raw: ${response.rawBody ? response.rawBody.substring(0, 500) : 'N/A'}`
    );
  }
  
  // Wenn data ein String ist (z.B. HTML), ist etwas schief gelaufen
  if (typeof response.data === 'string') {
    throw new Error(
      message ||
      `Response is not JSON but string (likely HTML error page). Status: ${response.status}.\n` +
      `Preview: ${response.data.substring(0, 300)}`
    );
  }
  
  if (!response.data.success) {
    throw new Error(
      message || 
      `Expected success: true, got false. Status: ${response.status}.\n` +
      `Response: ${JSON.stringify(response.data, null, 2)}`
    );
  }
}

// Test-Daten
let createdUricAcidId = null;
let createdMealId = null;
let createdFoodItemId = null;

// ============================================
// URIC ACID TESTS
// ============================================

const testUricAcidCreate = test('UricAcid: Create', async () => {
  const data = {
    userId: USER_GUID,
    timestamp: new Date().toISOString(),
    value: 5.5,
    normal: true,
    muchMeat: false,
    muchSport: false,
    muchSugar: false,
    muchAlcohol: false,
    fasten: false,
    goutAttack: false,
    notes: 'Test Harnsäurewert'
  };

  const response = await makeRequest('POST', '/api/uric-acid-values', data);
  assertStatus(response, 201);
  assertSuccess(response);
  assert(response.data.data, 'Response should contain data');
  assert(response.data.data.id, 'Response should contain id');
  assert(response.data.data.value === 5.5, 'Value should be 5.5');
  
  createdUricAcidId = response.data.data.id;
  log(`  Created UricAcid with ID: ${createdUricAcidId}`);
});

const testUricAcidUpdate = test('UricAcid: Update', async () => {
  assert(createdUricAcidId, 'UricAcid must be created first');
  
  const data = {
    id: createdUricAcidId,
    userId: USER_GUID,
    timestamp: new Date().toISOString(),
    value: 6.2,
    normal: false,
    muchMeat: true,
    notes: 'Updated Harnsäurewert'
  };

  const response = await makeRequest('POST', '/api/uric-acid-values', data);
  assertStatus(response, 201);
  assertSuccess(response);
  assert(response.data.data.value === 6.2, 'Updated value should be 6.2');
  assert(response.data.data.muchMeat === true, 'muchMeat should be true');
  
  log(`  Updated UricAcid ID: ${createdUricAcidId}`);
});

const testUricAcidDelete = test('UricAcid: Delete', async () => {
  assert(createdUricAcidId, 'UricAcid must be created first');
  
  const response = await makeRequest(
    'DELETE', 
    `/api/uric-acid-values/${createdUricAcidId}?userId=${USER_GUID}`
  );
  assertStatus(response, 200);
  assertSuccess(response);
  
  log(`  Deleted UricAcid ID: ${createdUricAcidId}`);
});

// ============================================
// MEALS TESTS
// ============================================

const testMealCreate = test('Meals: Create', async () => {
  const data = {
    userId: USER_GUID,
    timestamp: new Date().toISOString(),
    mealType: 'LUNCH',
    name: 'Test Mahlzeit',
    totalPurin: 250,  // Summe der Komponenten: 50 + 100 + 100 = 250
    totalUricAcid: 350,  // Summe der Komponenten: 75 + 150 + 125 = 350
    totalCalories: 800,  // Summe der Komponenten: 200 + 300 + 300 = 800
    totalProtein: 35.5,  // Summe der Komponenten: 10.5 + 15.0 + 10.0 = 35.5
    components: [
      {
        foodItemName: 'Test Komponente 1',
        estimatedWeight: 100,
        purin: 50,
        uricAcid: 75,
        calories: 200,
        protein: 10.5
      },
      {
        foodItemName: 'Test Komponente 2',
        estimatedWeight: 150,
        purin: 100,
        uricAcid: 150,
        calories: 300,
        protein: 15.0
      },
      {
        foodItemName: 'Test Komponente 3',
        estimatedWeight: 120,
        purin: 100,
        uricAcid: 125,
        calories: 300,
        protein: 10.0
      }
    ]
  };

  const response = await makeRequest('POST', '/api/meals', data);
  assertStatus(response, 201);
  assertSuccess(response);
  assert(response.data.data, 'Response should contain data');
  assert(response.data.data.id, 'Response should contain id');
  assert(response.data.data.mealType === 'LUNCH', 'MealType should be LUNCH');
  assert(Array.isArray(response.data.data.components), 'Response should contain components array');
  assert(response.data.data.components.length === 3, 'Should have 3 components');
  assert(response.data.data.components[0].foodItemName === 'Test Komponente 1', 'First component name should match');
  assert(response.data.data.components[1].foodItemName === 'Test Komponente 2', 'Second component name should match');
  assert(response.data.data.components[2].foodItemName === 'Test Komponente 3', 'Third component name should match');
  
  createdMealId = response.data.data.id;
  log(`  Created Meal with ID: ${createdMealId} (${response.data.data.components.length} components)`);
});

const testMealUpdate = test('Meals: Update', async () => {
  assert(createdMealId, 'Meal must be created first');
  
  const data = {
    id: createdMealId,
    userId: USER_GUID,
    timestamp: new Date().toISOString(),
    mealType: 'DINNER',
    name: 'Updated Mahlzeit',
    totalPurin: 180,  // Summe der neuen Komponenten: 80 + 100 = 180
    totalUricAcid: 240,  // Summe der neuen Komponenten: 120 + 120 = 240
    totalCalories: 550,  // Summe der neuen Komponenten: 250 + 300 = 550
    totalProtein: 22.5,  // Summe der neuen Komponenten: 12.5 + 10.0 = 22.5
    components: [
      {
        foodItemName: 'Updated Komponente 1',
        estimatedWeight: 80,
        purin: 80,
        uricAcid: 120,
        calories: 250,
        protein: 12.5
      },
      {
        foodItemName: 'Updated Komponente 2',
        estimatedWeight: 100,
        purin: 100,
        uricAcid: 120,
        calories: 300,
        protein: 10.0
      }
    ]
  };

  const response = await makeRequest('POST', '/api/meals', data);
  assertStatus(response, 201);
  assertSuccess(response);
  assert(response.data.data.mealType === 'DINNER', 'Updated mealType should be DINNER');
  assert(response.data.data.name === 'Updated Mahlzeit', 'Updated name should match');
  assert(Array.isArray(response.data.data.components), 'Response should contain components array');
  assert(response.data.data.components.length === 2, 'Should have 2 components after update');
  assert(response.data.data.components[0].foodItemName === 'Updated Komponente 1', 'First updated component name should match');
  assert(response.data.data.components[1].foodItemName === 'Updated Komponente 2', 'Second updated component name should match');
  
  log(`  Updated Meal ID: ${createdMealId} (${response.data.data.components.length} components)`);
});

const testMealDelete = test('Meals: Delete', async () => {
  assert(createdMealId, 'Meal must be created first');
  
  const response = await makeRequest(
    'DELETE', 
    `/api/meals/${createdMealId}?userId=${USER_GUID}`
  );
  assertStatus(response, 200);
  assertSuccess(response);
  
  log(`  Deleted Meal ID: ${createdMealId}`);
});

// ============================================
// FOOD ITEMS TESTS
// ============================================

const testFoodItemCreate = test('FoodItems: Create', async () => {
  const data = {
    userId: USER_GUID,
    name: 'Test Nahrungsmittel',
    purinPer100g: 100,
    uricAcidPer100g: 150,
    caloriesPer100g: 200,
    proteinPercentage: 15.5,
    category: 'FLEISCH'
  };

  const response = await makeRequest('POST', '/api/food-items', data);
  assertStatus(response, 201);
  assertSuccess(response);
  assert(response.data.data, 'Response should contain data');
  assert(response.data.data.id, 'Response should contain id');
  assert(response.data.data.name === 'Test Nahrungsmittel', 'Name should match');
  
  createdFoodItemId = response.data.data.id;
  log(`  Created FoodItem with ID: ${createdFoodItemId}`);
});

const testFoodItemUpdate = test('FoodItems: Update', async () => {
  assert(createdFoodItemId, 'FoodItem must be created first');
  
  const data = {
    userId: USER_GUID, // userId (GUID) ist erforderlich
    name: 'Updated Nahrungsmittel',
    purinPer100g: 120,
    uricAcidPer100g: 180,
    caloriesPer100g: 250,
    proteinPercentage: 18.0,
    category: 'GEMÜSE'
  };

  const response = await makeRequest('PUT', `/api/food-items/${createdFoodItemId}`, data);
  assertStatus(response, 200);
  assertSuccess(response);
  assert(response.data.data.name === 'Updated Nahrungsmittel', 'Updated name should match');
  assert(response.data.data.category === 'GEMÜSE', 'Updated category should be GEMÜSE');
  
  log(`  Updated FoodItem ID: ${createdFoodItemId}`);
});

const testFoodItemDelete = test('FoodItems: Delete', async () => {
  assert(createdFoodItemId, 'FoodItem must be created first');
  
  const response = await makeRequest(
    'DELETE', 
    `/api/food-items/${createdFoodItemId}?userId=${USER_GUID}`
  );
  assertStatus(response, 200);
  assertSuccess(response);
  
  log(`  Deleted FoodItem ID: ${createdFoodItemId}`);
});

// ============================================
// RESTORE / BATCH-DOWNLOAD TESTS
// ============================================

const testRestoreUricAcid = test('Restore: UricAcid Batch-Download', async () => {
  // Erstelle Test-Daten
  const testData = {
    userId: USER_GUID,
    timestamp: new Date().toISOString(),
    value: 5.0,
    normal: true
  };
  
  await makeRequest('POST', '/api/uric-acid-values', testData);
  
  // Hole alle UricAcid-Werte
  const response = await makeRequest('GET', `/api/uric-acid-values?userId=${USER_GUID}`);
  assertStatus(response, 200);
  assertSuccess(response);
  assert(Array.isArray(response.data.data), 'Response should be an array');
  assert(response.data.data.length > 0, 'Should have at least one UricAcid value');
  
  log(`  Downloaded ${response.data.data.length} UricAcid values`);
  
  // Cleanup
  for (const item of response.data.data) {
    await makeRequest('DELETE', `/api/uric-acid-values/${item.id}?userId=${USER_GUID}`);
  }
});

const testRestoreMeals = test('Restore: Meals Batch-Download', async () => {
  // Erstelle Test-Daten
  const testData = {
    userId: USER_GUID,
    timestamp: new Date().toISOString(),
    mealType: 'BREAKFAST',
    name: 'Test Mahlzeit für Restore',
    totalPurin: 100,
    totalUricAcid: 150,
    totalCalories: 400,
    totalProtein: 20.0,
    components: []
  };
  
  await makeRequest('POST', '/api/meals', testData);
  
  // Hole alle Meals
  const response = await makeRequest('GET', `/api/meals?userId=${USER_GUID}`);
  assertStatus(response, 200);
  assertSuccess(response);
  assert(Array.isArray(response.data.data), 'Response should be an array');
  assert(response.data.data.length > 0, 'Should have at least one Meal');
  
  log(`  Downloaded ${response.data.data.length} Meals`);
  
  // Cleanup
  for (const item of response.data.data) {
    await makeRequest('DELETE', `/api/meals/${item.id}?userId=${USER_GUID}`);
  }
});

const testRestoreFoodItems = test('Restore: FoodItems Batch-Download', async () => {
  // Erstelle Test-Daten
  const testData = {
    userId: USER_GUID,
    name: 'Test Nahrungsmittel für Restore',
    purinPer100g: 80,
    uricAcidPer100g: 120,
    caloriesPer100g: 180,
    proteinPercentage: 12.0,
    category: 'OBST'
  };
  
  await makeRequest('POST', '/api/food-items', testData);
  
  // Hole alle FoodItems
  const response = await makeRequest('GET', `/api/food-items?userId=${USER_GUID}`);
  assertStatus(response, 200);
  assertSuccess(response);
  assert(Array.isArray(response.data.data), 'Response should be an array');
  assert(response.data.data.length > 0, 'Should have at least one FoodItem');
  
  log(`  Downloaded ${response.data.data.length} FoodItems`);
  
  // Cleanup
  for (const item of response.data.data) {
    await makeRequest('DELETE', `/api/food-items/${item.id}?userId=${USER_GUID}`);
  }
});

const testRestoreBackupMetadata = test('Restore: Backup Metadata', async () => {
  const response = await makeRequest('GET', `/api/backups/metadata?userId=${USER_GUID}`);
  assertStatus(response, 200);
  assertSuccess(response);
  assert(response.data.data, 'Response should contain data');
  assert(typeof response.data.data.uricAcidCount === 'number', 'Should have uricAcidCount');
  assert(typeof response.data.data.mealCount === 'number', 'Should have mealCount');
  assert(typeof response.data.data.foodItemCount === 'number', 'Should have foodItemCount');
  
  log(`  Backup Metadata: ${response.data.data.uricAcidCount} UricAcid, ${response.data.data.mealCount} Meals, ${response.data.data.foodItemCount} FoodItems`);
});

const testRestoreBackupList = test('Restore: Backup List', async () => {
  const response = await makeRequest('GET', `/api/backups?userId=${USER_GUID}`);
  assertStatus(response, 200);
  assertSuccess(response);
  assert(Array.isArray(response.data.data), 'Response should be an array');
  
  log(`  Found ${response.data.data.length} backup(s)`);
});

// ============================================
// TEST RUNNER
// ============================================

async function testConnection() {
  try {
    log('Testing server connection...', 'info');
    // Versuche einen einfachen Request (z.B. Backup Metadata)
    const response = await makeRequest('GET', `/backups/metadata?userId=${USER_GUID}`);
    log('✓ Server connection successful', 'success');
    return true;
  } catch (error) {
    log('✗ Server connection failed', 'error');
    log(`  Error: ${error.message}`, 'error');
    log('  → Check if the server is running and the BASE_URL is correct', 'error');
    return false;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Service Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User GUID: ${USER_GUID}`);
  console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT PROVIDED'}`);
  console.log('='.repeat(60) + '\n');

  if (!API_KEY) {
    console.error('❌ ERROR: API_KEY is required!');
    console.error('Usage: node test-service.js <API_KEY> <USER_GUID> [BASE_URL]');
    process.exit(1);
  }

  // Teste Verbindung zum Server
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('\n❌ Cannot proceed without server connection. Exiting.');
    process.exit(1);
  }
  console.log('');

  // UricAcid Tests
  console.log('\n--- UricAcid Tests ---');
  await testUricAcidCreate();
  await testUricAcidUpdate();
  await testUricAcidDelete();

  // Meals Tests
  console.log('\n--- Meals Tests ---');
  await testMealCreate();
  await testMealUpdate();
  await testMealDelete();

  // FoodItems Tests
  console.log('\n--- FoodItems Tests ---');
  await testFoodItemCreate();
  await testFoodItemUpdate();
  await testFoodItemDelete();

  // Restore/Batch-Download Tests
  console.log('\n--- Restore / Batch-Download Tests ---');
  await testRestoreUricAcid();
  await testRestoreMeals();
  await testRestoreFoodItems();
  await testRestoreBackupMetadata();
  await testRestoreBackupList();

  // Zusammenfassung
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((err, index) => {
      console.log(`  ${index + 1}. ${err.test}: ${err.error}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

// Starte Tests
runTests().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

