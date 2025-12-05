# Service-Crash beheben - Port 3001 bereits belegt

## Problem

Der Service kann nicht starten mit folgendem Fehler:
```
Error: listen EADDRINUSE: address already in use :::3001
```

Dies bedeutet, dass Port 3001 bereits von einem anderen Prozess verwendet wird.

## Ursache

Mögliche Ursachen:
1. Ein alter Service-Prozess läuft noch im Hintergrund
2. PM2 hat den Service nicht korrekt gestoppt
3. Ein anderer Prozess verwendet Port 3001

## Lösung

### Schritt 1: Port-Konflikt beheben

Führen Sie das Script aus, um den Port-Konflikt zu beheben:

```bash
cd /volume1/nodejs/goutdiary
chmod +x fix-port-3001.sh
./fix-port-3001.sh
```

Oder manuell:

1. **Finde Prozess auf Port 3001:**
   ```bash
   lsof -i:3001
   # oder
   netstat -tulpn | grep :3001
   ```

2. **Beende den Prozess:**
   ```bash
   kill -9 <PID>
   ```

3. **Prüfe PM2 Status:**
   ```bash
   pm2 list
   ```

4. **Stoppe/Starte Service in PM2:**
   ```bash
   pm2 stop GoutDiaryService
   pm2 delete GoutDiaryService
   ```

### Schritt 2: Service neu starten

Nachdem Port 3001 frei ist, starten Sie den Service neu:

**Option 1: Mit PM2 (empfohlen für Production)**
```bash
cd /volume1/nodejs/goutdiary
pm2 start ecosystem.config.js
pm2 save  # Speichere PM2-Konfiguration
pm2 list  # Prüfe Status
```

**Option 2: Direkt mit npm (für Development)**
```bash
cd /volume1/nodejs/goutdiary
npm run dev
```

### Schritt 3: Service-Status prüfen

Prüfen Sie, ob der Service läuft:

```bash
# PM2 Status
pm2 status
pm2 logs GoutDiaryService

# Oder prüfe Port
lsof -i:3001

# Health Check
curl http://localhost:3001/health
```

## Automatische Behebung

Das Script `fix-port-3001.sh` führt alle Schritte automatisch aus:

1. Findet Prozess auf Port 3001
2. Beendet den Prozess
3. Prüft PM2 Status
4. Stoppt/löscht alte PM2-Prozesse
5. Gibt Anweisungen zum Neustart

## Prävention

Um zukünftige Probleme zu vermeiden:

1. **Verwenden Sie PM2 für Service-Management:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 startup  # Auto-Start bei System-Reboot
   pm2 save     # Speichere Konfiguration
   ```

2. **Service korrekt stoppen:**
   ```bash
   pm2 stop GoutDiaryService
   # ODER
   pm2 delete GoutDiaryService
   ```

3. **Überwachen Sie den Service:**
   ```bash
   pm2 monit
   ```

## Logs prüfen

Wenn der Service nicht startet, prüfen Sie die Logs:

```bash
# Application Logs
tail -f logs/application-current.log

# Exception Logs
tail -f logs/exceptions-*.log

# PM2 Logs
pm2 logs GoutDiaryService
```

## Weitere Hilfe

- Prüfen Sie die Service-Konfiguration in `ecosystem.config.js`
- Prüfen Sie Umgebungsvariablen in `.env`
- Prüfen Sie, ob die Datenbank korrekt initialisiert ist
