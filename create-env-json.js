#!/usr/bin/env node

/**
 * Konvertiert .env Datei in JSON-Format für Google Cloud Run
 * 
 * Verwendung:
 *   node create-env-json.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const outputPath = path.join(__dirname, 'env-vars.json');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env Datei nicht gefunden:', envPath);
  process.exit(1);
}

// Lese .env Datei
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

const envVars = {};

lines.forEach((line, index) => {
  // Ignoriere Kommentare und leere Zeilen
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return;
  }
  
  // Parse KEY=VALUE
  const match = trimmedLine.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    
    // Entferne Anführungszeichen falls vorhanden
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    envVars[key] = value;
  } else {
    console.warn(`⚠️  Zeile ${index + 1} konnte nicht geparst werden: ${trimmedLine}`);
  }
});

// Erstelle JSON-Objekt im Format für gcloud
const gcloudEnvVars = {};
Object.keys(envVars).forEach(key => {
  gcloudEnvVars[key] = envVars[key];
});

// Speichere als JSON
fs.writeFileSync(outputPath, JSON.stringify(gcloudEnvVars, null, 2), 'utf8');

console.log('✅ Umgebungsvariablen erfolgreich konvertiert!');
console.log(`📄 Ausgabedatei: ${outputPath}`);
console.log(`📊 Anzahl Variablen: ${Object.keys(gcloudEnvVars).length}`);
console.log('\nVerfügbare Variablen:');
Object.keys(gcloudEnvVars).forEach(key => {
  const value = gcloudEnvVars[key];
  const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
  console.log(`  ${key} = ${displayValue}`);
});

console.log('\n📝 Verwendung beim Deployen:');
console.log(`gcloud run deploy gichttagebuchservice --source . --region europe-west1 --update-env-vars-from-file env-vars.json`);

















