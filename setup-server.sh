#!/bin/bash
# Setup Script für UricAcidService auf Linux-Server

echo "=== UricAcidService Setup ==="

# Navigiere zum Projektverzeichnis
cd /volume1/nodejs/UricAcidService || exit 1

echo "Aktuelles Verzeichnis: $(pwd)"

# Prüfe Node.js Installation
echo ""
echo "=== Prüfe Node.js Installation ==="
if command -v node &> /dev/null; then
    echo "Node.js Version: $(node --version)"
else
    echo "FEHLER: Node.js ist nicht installiert!"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "npm Version: $(npm --version)"
else
    echo "FEHLER: npm ist nicht installiert!"
    exit 1
fi

# Installiere Dependencies
echo ""
echo "=== Installiere Dependencies ==="
npm install

# Prüfe ob .env Datei existiert
echo ""
echo "=== Prüfe Konfiguration ==="
if [ ! -f .env ]; then
    echo "WARNUNG: .env Datei nicht gefunden!"
    echo "Bitte erstelle eine .env Datei mit folgendem Inhalt:"
    echo ""
    echo "PORT=3001"
    echo "NODE_ENV=development"
    echo "OPENAI_API_KEY=sk-your-api-key-here"
    echo "LLM_MODEL=gpt-4-turbo-preview"
    echo "DB_PATH=./data/harnsaeure.db"
    echo "ALLOWED_ORIGINS=http://localhost:3000"
    echo ""
else
    echo "✓ .env Datei gefunden"
fi

# Erstelle data Verzeichnis falls nicht vorhanden
echo ""
echo "=== Erstelle Verzeichnisse ==="
mkdir -p data/photos
echo "✓ Verzeichnisse erstellt"

# Prüfe ob alle notwendigen Dateien vorhanden sind
echo ""
echo "=== Prüfe Projektdateien ==="
if [ -f "src/app.js" ]; then
    echo "✓ src/app.js gefunden"
else
    echo "FEHLER: src/app.js nicht gefunden!"
    exit 1
fi

if [ -f "package.json" ]; then
    echo "✓ package.json gefunden"
else
    echo "FEHLER: package.json nicht gefunden!"
    exit 1
fi

echo ""
echo "=== Setup abgeschlossen ==="
echo ""
echo "Zum Starten des Servers:"
echo "  npm run dev    (Development mit Auto-Reload)"
echo "  npm start      (Production)"
echo ""
echo "Der Server läuft dann auf: http://localhost:3001"


