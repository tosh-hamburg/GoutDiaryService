# Docker Quick Start - Schnellanleitung

## Problem

Dein aktuelles Setup führt `npm install` bei jedem Container-Start aus, was zu:
- Langen Startzeiten führt
- "Unplanmäßigen" Neustarts
- Unnötigem Netzwerk-Traffic

## Lösung in 3 Schritten

### Schritt 1: Dateien übertragen

Die folgenden neuen Dateien wurden erstellt:
- `Dockerfile` - Baut fertiges Node.js-Image
- `docker-compose.yml` - Neue Docker-Konfiguration
- `.dockerignore` - Optimiert Image-Größe
- `docker-start.sh` - Helper-Script (optional)

Stelle sicher, dass diese in `/volume1/nodejs/goutdiary/` liegen.

### Schritt 2: Image bauen

```bash
# SSH auf Synology
ssh admin@192.168.4.59

# Zum Projekt-Verzeichnis
cd /volume1/nodejs/goutdiary

# Alte Container stoppen
docker-compose down

# Neues Image bauen
docker-compose build app
```

### Schritt 3: Container starten

```bash
# Container starten
docker-compose up -d

# Status prüfen
docker-compose ps

# Logs anzeigen
docker-compose logs -f app
```

## Erwartete Ausgabe

Nach erfolgreichem Start solltest du sehen:

```
[INFO] Starting server initialization...
[INFO] Initializing database...
[INFO] PostgreSQL is available, using PostgreSQL
[INFO] PostgreSQL connection established
[INFO] Creating PostgreSQL schema...
[INFO] No SQLite database found, skipping migration
[INFO] Creating default admin user...
[INFO] Default admin user created: dunker.thorsten@gmail.com
[INFO] Server running on http://dev.gout-diary.com:3001
```

## Container-Status prüfen

```bash
docker-compose ps
```

Sollte zeigen:
```
NAME              STATUS          PORTS
gout_db_container Up (healthy)    5433->5432
gout_node_app     Up (healthy)    3001->3001
pgadmin_server    Up              5050->80
```

## Login testen

Browser: `https://dev.gout-diary.com:3001/login.html`

Zugangsdaten:
- Email: `dunker.thorsten@gmail.com`
- Passwort: `tosh&123`

## Unterschiede Alt vs. Neu

### Alt (Dein YAML):
```yaml
app:
  image: node:20
  command: bash -c "npm install && npm run dev"  # ← Problem!
  volumes:
    - /volume1/nodejs/goutdiary:/usr/src/app
```

**Probleme:**
- ❌ `npm install` läuft bei jedem Start
- ❌ Lange Startzeit
- ❌ Netzwerk-Traffic bei jedem Start
- ❌ Synology zeigt "unplanmäßiger Neustart"

### Neu (Mit Dockerfile):
```yaml
app:
  build:
    context: /volume1/nodejs/goutdiary
  image: gout-diary-app:latest
  # Kein command nötig - ist im Dockerfile
```

**Vorteile:**
- ✅ Dependencies im Image eingebaut
- ✅ Schneller Start
- ✅ Kein `npm install` bei Restart
- ✅ Sauberer Container-Status

## Helper-Script verwenden (Optional)

```bash
# Ausführbar machen
chmod +x docker-start.sh

# Image bauen
./docker-start.sh build

# Container starten
./docker-start.sh start

# Logs anzeigen
./docker-start.sh logs

# Status prüfen
./docker-start.sh status

# Neu starten
./docker-start.sh restart
```

## Häufige Befehle

### Container neu starten
```bash
docker-compose restart app
```

### Logs live anzeigen
```bash
docker-compose logs -f app
```

### Container stoppen
```bash
docker-compose down
```

### Nach Code-Änderungen
```bash
# Image neu bauen
docker-compose build app

# Container mit neuem Image starten
docker-compose up -d app
```

## Fehlerbehebung

### Container startet nicht

**Logs prüfen:**
```bash
docker-compose logs app
```

**Im Vordergrund starten:**
```bash
docker-compose up app
```

### PostgreSQL-Verbindung schlägt fehl

**DB-Container prüfen:**
```bash
docker-compose ps db
```

**DB-Logs prüfen:**
```bash
docker-compose logs db
```

**Manuell verbinden:**
```bash
docker exec -it gout_db_container psql -U goutservice -d goutdiary
```

### "npm install" läuft immer noch

**Prüfe welches docker-compose.yml verwendet wird:**
```bash
cat docker-compose.yml | grep -A5 "app:"
```

Sollte zeigen:
```yaml
app:
  build:
    context: /volume1/nodejs/goutdiary
```

**NICHT:**
```yaml
app:
  command: bash -c "npm install && npm run dev"  # ← Alt!
```

## Synology Container Manager

### Container-Status

1. Container Manager öffnen
2. Sollte zeigen: `gout_node_app` - **Grün** (Healthy)
3. **Nicht** "Unplanmäßig neu gestartet"

### Container neu starten

1. Container auswählen: `gout_node_app`
2. Aktion → Neu starten
3. Sollte sofort starten (keine lange Wartezeit)

## Checkliste

Nach dem Setup sollte alles funktionieren:

- [ ] Image erfolgreich gebaut: `docker images | grep gout-diary-app`
- [ ] Container laufen: `docker-compose ps` zeigt "Up (healthy)"
- [ ] PostgreSQL verbunden: Logs zeigen "PostgreSQL is available"
- [ ] Admin-Benutzer erstellt: Logs zeigen "Default admin user created"
- [ ] Login funktioniert: https://dev.gout-diary.com:3001/login.html
- [ ] Kein "npm install" bei Restart
- [ ] Container-Status in Synology zeigt "Healthy" (grün)

## Rollback

Falls etwas nicht funktioniert, zurück zum alten Setup:

```bash
# Neue Container stoppen
docker-compose down

# Altes docker-compose.yml wiederherstellen
# (Dein ursprüngliches YAML)

# Alte Container starten
docker-compose up -d
```

## Next Steps

Nach erfolgreichem Setup:

1. **Migration testen**: Alte SQLite-Daten werden automatisch migriert
2. **Backup einrichten**: `./docker-start.sh backup`
3. **Monitoring**: Health-Check URL in Überwachung einbinden
4. **Auto-Updates**: Automatisches Rebuild bei Code-Änderungen

## Support

Bei Problemen:
1. Logs prüfen: `docker-compose logs app`
2. Status prüfen: `docker-compose ps`
3. Health-Check: `curl http://localhost:3001/health`
4. Dokumentation: `DOCKER_DEPLOYMENT.md`
