#!/bin/bash
# Deployment Script - Kopiert Dateien auf Server und startet Service

SERVER="adm_ssh@192.168.4.59"
REMOTE_PATH="/volume1/nodejs/UricAcidService"
LOCAL_PATH="."

echo "=== Deploy zu Server ==="
echo "Server: $SERVER"
echo "Ziel: $REMOTE_PATH"
echo ""

# Kopiere Dateien (ausführen von lokalem Windows-Rechner)
echo "Kopiere Dateien..."
scp -r "$LOCAL_PATH/src" "$LOCAL_PATH/package.json" "$LOCAL_PATH/.gitignore" "$LOCAL_PATH/README.md" "$SERVER:$REMOTE_PATH/"

echo ""
echo "=== Verbinde zum Server und führe Setup aus ==="
ssh "$SERVER" << 'ENDSSH'
cd /volume1/nodejs/UricAcidService
echo "Aktuelles Verzeichnis: $(pwd)"
echo ""
echo "Installiere Dependencies..."
npm install
echo ""
echo "Setup abgeschlossen!"
echo "Zum Starten: npm run dev"
ENDSSH

echo ""
echo "=== Deployment abgeschlossen ==="


