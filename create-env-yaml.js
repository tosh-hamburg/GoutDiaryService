#!/usr/bin/env node

/**
 * Konvertiert .env Datei in YAML-Format für Google Cloud Run
 * Verwendet --flags-file Format für gcloud commands
 * 
 * Verwendung:
 *   node create-env-yaml.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const outputPath = path.join(__dirname, 'env-vars.yaml');

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

// Erstelle YAML-Format für --flags-file
// --update-env-vars erwartet ein Dictionary im YAML-Format
// WICHTIG: PORT sollte nicht als Umgebungsvariable gesetzt werden, da es bereits als --port Flag verwendet wird
const envVarsDict = {};
Object.keys(envVars).forEach(key => {
  // Überspringe PORT, da es als --port Flag gesetzt wird
  if (key === 'PORT') {
    return;
  }
  envVarsDict[key] = envVars[key];
});

// Erstelle YAML-Datei im --flags-file Format
// Laut Dokumentation: https://docs.cloud.google.com/sdk/gcloud/reference/topic/flags-file
// Dictionary-Werte werden als YAML-Dictionary formatiert
let yamlContent = `# Umgebungsvariablen für Google Cloud Run
# Erstellt von create-env-yaml.js
# 
# Verwendung:
#   gcloud run deploy gichttagebuchservice --source . --flags-file=env-vars.yaml

--update-env-vars:
`;

// Füge jedes Key-Value-Paar als YAML-Dictionary-Eintrag hinzu
// WICHTIG: Alle Werte müssen als Strings formatiert werden (in Anführungszeichen),
// da Umgebungsvariablen immer Strings sein müssen und YAML sonst Zahlen als Integer interpretiert
Object.keys(envVarsDict).forEach(key => {
  const value = envVarsDict[key];
  // Alle Werte müssen als Strings formatiert werden (in Anführungszeichen)
  // Escape Anführungszeichen und Backslashes
  const escapedValue = value
    .replace(/\\/g, '\\\\')  // Escape Backslashes zuerst
    .replace(/"/g, '\\"')    // Escape Anführungszeichen
    .replace(/\n/g, '\\n');  // Escape Newlines
  yamlContent += `  ${key}: "${escapedValue}"\n`;
});

// Füge weitere Flags hinzu
yamlContent += `--region: europe-west1
--allow-unauthenticated: true
--port: 3001
`;

// Speichere als YAML
fs.writeFileSync(outputPath, yamlContent, 'utf8');

console.log('✅ Umgebungsvariablen erfolgreich in YAML konvertiert!');
console.log(`📄 Ausgabedatei: ${outputPath}`);
console.log(`📊 Anzahl Variablen: ${Object.keys(envVars).length}`);
console.log('\nVerfügbare Variablen:');
Object.keys(envVars).forEach(key => {
  const value = envVars[key];
  const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
  console.log(`  ${key} = ${displayValue}`);
});

console.log('\n📝 Verwendung beim Deployen:');
console.log(`gcloud run deploy gichttagebuchservice --source . --flags-file=env-vars.yaml`);

