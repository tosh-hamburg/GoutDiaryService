# Docker Deployment - Anleitung

## Problem mit dem aktuellen Setup

Das Problem mit deiner aktuellen YAML-Konfiguration:
- `command: bash -c "npm install && npm run dev"` führt bei jedem Start `npm install` aus
- Das führt zu langen Startzeiten und "unplanmäßigen" Neustarts
- Dependencies sollten ins Image eingebaut werden, nicht bei jedem Start installiert

## Lösung: Dockerfile verwenden

### 1. Dateien bereitstellen

Stelle sicher, dass diese Dateien in `/volume1/nodejs/goutdiary` liegen:
- `Dockerfile` (neu erstellt)
- `docker-compose.yml` (neu erstellt)
- `.dockerignore` (neu erstellt)

### 2. Docker Image bauen

```bash
# SSH auf Synology
ssh admin@192.168.4.59

# Zum Projekt-Verzeichnis wechseln
cd /volume1/nodejs/goutdiary

# Image bauen
docker-compose build app

# Oder manuell:
docker build -t gout-diary-app:latest .
```

### 3. Container starten

```bash
# Alle Container starten
docker-compose up -d

# Nur app-Container neu starten
docker-compose restart app

# Logs anzeigen
docker-compose logs -f app
```

### 4. Prüfen ob es funktioniert

```bash
# Status prüfen
docker-compose ps

# Logs anzeigen
docker-compose logs app

# Health-Check
curl http://localhost:3001/health
```

## Alternative: Development-Modus mit Volume

Falls du weiterhin im Development-Modus arbeiten möchtest (Code-Änderungen ohne Image-Rebuild):

### docker-compose.dev.yml erstellen

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: gout_db_container
    restart: unless-stopped
    environment:
      POSTGRES_USER: goutservice
      POSTGRES_PASSWORD: tosh&123
      POSTGRES_DB: goutdiary
    volumes:
      - /volume1/docker/postgresql/data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    networks:
      - gout-network

  app:
    image: node:20-alpine
    container_name: gout_node_app_dev
    restart: unless-stopped
    working_dir: /usr/src/app
    command: sh -c "npm install && npm run dev"
    ports:
      - "3001:3001"
    depends_on:
      - db
    volumes:
      - /volume1/nodejs/goutdiary:/usr/src/app
      - /usr/src/app/node_modules  # Wichtig: Verhindert Überschreiben
    environment:
      NODE_ENV: development
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: goutdiary
      DB_USER: goutservice
      DB_PASSWORD: tosh&123
    networks:
      - gout-network

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin_server
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: dunker.thorsten@gmail.com
      PGADMIN_DEFAULT_PASSWORD: tosh&123
    ports:
      - "5050:80"
    volumes:
      - /volume1/docker/postgresadmin:/var/lib/pgadmin
    depends_on:
      - db
    networks:
      - gout-network

networks:
  gout-network:
    driver: bridge
```

Starten mit:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Empfohlenes Setup: Production

### 1. Verzeichnisstruktur auf Synology

```
/volume1/
├── nodejs/goutdiary/          # Code-Repository
│   ├── src/
│   ├── package.json
│   ├── Dockerfile             # NEU
│   ├── docker-compose.yml     # NEU
│   └── .dockerignore          # NEU
│
└── docker/
    ├── postgresql/
    │   └── data/              # PostgreSQL-Daten
    ├── postgresadmin/         # pgAdmin-Daten
    └── goutdiary/
        ├── data/              # App-Daten (photos, etc.)
        └── logs/              # App-Logs
```

### 2. Erstmalige Einrichtung

```bash
# 1. Alte Container stoppen
docker-compose down

# 2. Image bauen
docker-compose build app

# 3. Container starten
docker-compose up -d

# 4. Logs prüfen
docker-compose logs -f app
```

### 3. Logs-Ausgabe sollte zeigen:

```
[INFO] Starting server initialization...
[INFO] Initializing database...
[INFO] PostgreSQL is available, using PostgreSQL
[INFO] PostgreSQL connection established
[INFO] Creating PostgreSQL schema...
[INFO] PostgreSQL schema created successfully
[INFO] No SQLite database found, skipping migration
[INFO] Creating default admin user...
[INFO] Default admin user created: dunker.thorsten@gmail.com
[INFO] Database initialized successfully
[INFO] Server running on http://dev.gout-diary.com:3001
```

### 4. Admin-Login testen

Browser: `https://dev.gout-diary.com:3001/login.html`
- Email: `dunker.thorsten@gmail.com`
- Passwort: `tosh&123`

## Updates durchführen

### Code-Updates (ohne Docker)

```bash
# Auf Synology
cd /volume1/nodejs/goutdiary

# Git pull oder Code ändern
git pull

# Container neu starten (lädt Code neu, falls Volume gemountet)
docker-compose restart app
```

### Code-Updates (mit Docker-Image)

```bash
# Image neu bauen
docker-compose build app

# Container mit neuem Image starten
docker-compose up -d app
```

## Problembehebung

### "npm install" läuft bei jedem Start

**Problem**: Volume überschreibt node_modules
**Lösung**:
```yaml
volumes:
  - /volume1/nodejs/goutdiary:/usr/src/app
  - /usr/src/app/node_modules  # Diese Zeile hinzufügen
```

### PostgreSQL-Verbindung schlägt fehl

**Problem**: `getaddrinfo ENOTFOUND db`
**Lösung**:
- Prüfe ob `db` Container läuft: `docker-compose ps`
- Prüfe Netzwerk: `docker network inspect goutdiary_gout-network`
- Verwende `depends_on` mit `condition: service_healthy`

### Container startet nicht

**Problem**: Exit code 1
**Lösung**:
```bash
# Logs prüfen
docker-compose logs app

# Container im Vordergrund starten für Debugging
docker-compose up app
```

### Permissions-Probleme

**Problem**: EACCES: permission denied
**Lösung**:
```bash
# Berechtigungen setzen auf Synology
sudo chown -R 1000:1000 /volume1/nodejs/goutdiary/data
sudo chown -R 1000:1000 /volume1/docker/goutdiary
```

## Synology Container Manager

### Container-Neustart

1. Container Manager öffnen
2. Container auswählen: `gout_node_app`
3. "Aktion" → "Neu starten"

### Logs anzeigen

1. Container Manager öffnen
2. Container auswählen: `gout_node_app`
3. "Details" → "Log"

### Health-Status prüfen

- Grüner Status = Healthy
- Gelber Status = Starting
- Roter Status = Unhealthy

## Environment-Variablen verwalten

### Option 1: .env-Datei (Empfohlen)

Erstelle `/volume1/nodejs/goutdiary/.env.docker`:

```bash
NODE_ENV=production
SESSION_SECRET=dein-secret-hier
GOOGLE_CLIENT_ID=deine-client-id
GOOGLE_CLIENT_SECRET=dein-secret
```

In docker-compose.yml:
```yaml
app:
  env_file:
    - .env.docker
```

### Option 2: Synology Secrets (Sicherer)

1. Container Manager → Einstellungen → Secrets
2. Neue Secrets erstellen
3. In docker-compose.yml referenzieren

## Backup-Strategie

### PostgreSQL

```bash
# Backup
docker exec gout_db_container pg_dump -U goutservice goutdiary > backup.sql

# Restore
docker exec -i gout_db_container psql -U goutservice goutdiary < backup.sql
```

### App-Daten

```bash
# Backup
tar -czf goutdiary-data-backup.tar.gz /volume1/docker/goutdiary/data/

# Restore
tar -xzf goutdiary-data-backup.tar.gz -C /
```

## Monitoring

### Health-Check URL

```bash
curl http://localhost:3001/health
```

Erwartete Antwort:
```json
{
  "status": "ok",
  "service": "harnsaeure-feasibility",
  "timestamp": "2025-12-06T...",
  "uptime": 123.456
}
```

### Container-Status

```bash
docker-compose ps
```

Sollte zeigen:
```
NAME              STATUS          PORTS
gout_db_container Up (healthy)    0.0.0.0:5433->5432/tcp
gout_node_app     Up (healthy)    0.0.0.0:3001->3001/tcp
pgadmin_server    Up              0.0.0.0:5050->80/tcp
```

## Produktiv-Checkliste

- [ ] Dockerfile erstellt und getestet
- [ ] docker-compose.yml angepasst
- [ ] .dockerignore erstellt
- [ ] Image erfolgreich gebaut
- [ ] Container starten ohne Fehler
- [ ] Health-Check zeigt "healthy"
- [ ] PostgreSQL-Verbindung funktioniert
- [ ] Admin-Login funktioniert
- [ ] Backup-Strategie implementiert
- [ ] Monitoring eingerichtet
- [ ] Logs werden persistiert
