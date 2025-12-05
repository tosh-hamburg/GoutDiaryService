#!/bin/bash
# Service-Neustart-Script mit automatischer Port-Bereinigung

echo "=== Service-Neustart für GoutDiaryService ==="
echo ""

SERVICE_DIR="/volume1/nodejs/goutdiary"
SERVICE_NAME="GoutDiaryService"

# Prüfe, ob Verzeichnis existiert
if [ ! -d "$SERVICE_DIR" ]; then
    echo "FEHLER: Service-Verzeichnis nicht gefunden: $SERVICE_DIR"
    exit 1
fi

cd "$SERVICE_DIR" || exit 1
echo "Verzeichnis: $(pwd)"
echo ""

# 1. Finde und beende Prozess auf Port 3001
echo "1. Bereinige Port 3001..."
PID=$(lsof -ti:3001 2>/dev/null)

if [ ! -z "$PID" ]; then
    echo "   Gefundener Prozess (PID): $PID"
    kill -9 $PID 2>/dev/null
    sleep 2
    echo "   ✓ Prozess beendet"
else
    echo "   ✓ Port 3001 ist frei"
fi

echo ""

# 2. PM2 Status prüfen und Service stoppen
if command -v pm2 &> /dev/null; then
    echo "2. PM2 Service-Management..."
    
    # Prüfe, ob Service in PM2 läuft
    if pm2 list | grep -q "$SERVICE_NAME"; then
        echo "   Service '$SERVICE_NAME' gefunden in PM2"
        echo "   Stoppe Service..."
        pm2 stop "$SERVICE_NAME" 2>/dev/null
        sleep 1
        echo "   Lösche Service aus PM2..."
        pm2 delete "$SERVICE_NAME" 2>/dev/null
        sleep 1
        echo "   ✓ Service gestoppt und entfernt"
    else
        echo "   Service nicht in PM2 gefunden"
    fi
    
    echo ""
    
    # 3. Service neu starten mit PM2
    echo "3. Starte Service mit PM2..."
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js
        sleep 2
        
        # Prüfe Status
        echo ""
        echo "4. Service-Status:"
        pm2 list
        
        echo ""
        echo "5. Zeige Logs (letzte 20 Zeilen):"
        pm2 logs "$SERVICE_NAME" --lines 20 --nostream
        
        echo ""
        echo "=== Service wurde neu gestartet ==="
        echo ""
        echo "Nützliche Befehle:"
        echo "  pm2 logs $SERVICE_NAME          # Logs anzeigen"
        echo "  pm2 monit                        # Service überwachen"
        echo "  pm2 restart $SERVICE_NAME        # Service neu starten"
        echo "  pm2 stop $SERVICE_NAME           # Service stoppen"
    else
        echo "   FEHLER: ecosystem.config.js nicht gefunden!"
        exit 1
    fi
else
    echo "2. PM2 nicht gefunden, starte mit npm..."
    
    # Starte direkt mit npm
    if [ -f "package.json" ]; then
        echo "   Starte Service mit: npm run dev"
        echo ""
        npm run dev &
        sleep 2
        
        # Prüfe Status
        if lsof -i:3001 > /dev/null 2>&1; then
            echo "   ✓ Service läuft auf Port 3001"
        else
            echo "   WARNUNG: Service scheint nicht zu laufen. Prüfe Logs."
        fi
    else
        echo "   FEHLER: package.json nicht gefunden!"
        exit 1
    fi
fi

echo ""
echo "=== Fertig ==="
