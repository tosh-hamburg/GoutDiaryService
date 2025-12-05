#!/bin/bash
# Script zum Beheben des Port-3001-Konflikts und Neustarten des Services

echo "=== Port-3001-Konflikt beheben ==="
echo ""

# Finde Prozess, der Port 3001 verwendet
echo "1. Prüfe, welcher Prozess Port 3001 verwendet..."
PID=$(lsof -ti:3001 2>/dev/null || netstat -tulpn 2>/dev/null | grep :3001 | awk '{print $7}' | cut -d'/' -f1 | head -n1)

if [ -z "$PID" ]; then
    echo "   Kein Prozess auf Port 3001 gefunden."
else
    echo "   Gefundener Prozess (PID): $PID"
    echo "   Prozess-Details:"
    ps aux | grep $PID | grep -v grep || echo "   (Prozess nicht mehr gefunden)"
    echo ""
    
    # Beende den Prozess
    echo "2. Beende Prozess $PID..."
    kill -9 $PID 2>/dev/null
    sleep 2
    
    # Prüfe, ob Prozess noch läuft
    if ps -p $PID > /dev/null 2>&1; then
        echo "   WARNUNG: Prozess läuft noch, versuche erneut..."
        kill -9 $PID 2>/dev/null
        sleep 1
    else
        echo "   ✓ Prozess erfolgreich beendet"
    fi
fi

echo ""
echo "3. Prüfe PM2 Status..."
if command -v pm2 &> /dev/null; then
    echo "   PM2 ist installiert"
    echo ""
    echo "   Aktuelle PM2 Prozesse:"
    pm2 list
    echo ""
    
    # Stoppe GoutDiaryService falls läuft
    echo "4. Stoppe GoutDiaryService (falls vorhanden)..."
    pm2 stop GoutDiaryService 2>/dev/null || echo "   Service nicht in PM2 gefunden"
    pm2 delete GoutDiaryService 2>/dev/null || echo "   Service nicht in PM2 zu löschen"
    
    sleep 2
    
    # Prüfe nochmal Port 3001
    echo ""
    echo "5. Finale Prüfung von Port 3001..."
    FINAL_PID=$(lsof -ti:3001 2>/dev/null || netstat -tulpn 2>/dev/null | grep :3001 | awk '{print $7}' | cut -d'/' -f1 | head -n1)
    
    if [ -z "$FINAL_PID" ]; then
        echo "   ✓ Port 3001 ist jetzt frei!"
        echo ""
        echo "=== Port ist jetzt frei. Sie können den Service jetzt starten: ==="
        echo "   cd /volume1/nodejs/goutdiary"
        echo "   pm2 start ecosystem.config.js"
        echo "   oder"
        echo "   npm run dev"
    else
        echo "   WARNUNG: Port 3001 wird noch von Prozess $FINAL_PID verwendet!"
        echo "   Versuche erneut zu beenden..."
        kill -9 $FINAL_PID 2>/dev/null
        sleep 1
        echo "   Bitte manuell prüfen mit: lsof -i:3001"
    fi
else
    echo "   PM2 ist nicht installiert oder nicht im PATH"
    echo ""
    echo "=== Port sollte jetzt frei sein. Starten Sie den Service manuell: ==="
    echo "   cd /volume1/nodejs/goutdiary"
    echo "   npm run dev"
fi

echo ""
echo "=== Fertig ==="
