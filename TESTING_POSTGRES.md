# PostgreSQL Setup - Test-Anleitung

## Voraussetzungen

1. PostgreSQL-Datenbank läuft und ist erreichbar
2. `.env`-Datei ist korrekt konfiguriert:
   ```
   DB_HOST=db
   DB_PORT=5432
   DB_NAME=goutdiary
   DB_USER=goutservice
   DB_PASSWORD='tosh&123'
   ```

## Test-Schritte

### 1. Service starten (Development)

```bash
npm run dev
```

**Erwartetes Ergebnis**:
```
[INFO] Starting server initialization...
[INFO] Initializing database...
[INFO] PostgreSQL is available, using PostgreSQL
[INFO] PostgreSQL connection established
[INFO] Creating PostgreSQL schema...
[INFO] PostgreSQL schema created successfully
```

Falls SQLite-Datenbank existiert:
```
[INFO] SQLite database found at ./data/harnsaeure.db, checking if migration needed
[INFO] Starting migration from SQLite to PostgreSQL...
[INFO] Migrating X users...
[INFO] Migrating Y uric acid values...
[INFO] Migration completed successfully!
[INFO] SQLite database renamed to ./data/harnsaeure.db.migrated
```

Falls keine SQLite-Datenbank:
```
[INFO] No SQLite database found, skipping migration
[INFO] Creating default admin user...
[INFO] Default admin user created: dunker.thorsten@gmail.com
```

### 2. Login testen

1. Browser öffnen: `https://dev.gout-diary.com:3001/login.html`
2. Anmelden mit:
   - Email: `dunker.thorsten@gmail.com`
   - Passwort: `tosh&123`

**Erwartetes Ergebnis**: Erfolgreicher Login und Weiterleitung zur Hauptseite

### 3. Datenbank überprüfen

```bash
# Verbindung zur PostgreSQL-Datenbank
psql -h db -U goutservice -d goutdiary

# Tabellen anzeigen
\dt

# Benutzer anzeigen
SELECT id, email, username, is_admin FROM users;

# Verbindung beenden
\q
```

**Erwartetes Ergebnis**:
- Alle Tabellen sind vorhanden
- Admin-Benutzer ist vorhanden mit `is_admin = true`

### 4. SQLite-Fallback testen

1. PostgreSQL-Verbindung in `.env` deaktivieren:
   ```
   DB_HOST=disabled
   ```

2. Service neu starten:
   ```bash
   npm run dev
   ```

**Erwartetes Ergebnis**:
```
[INFO] Initializing database...
[WARN] PostgreSQL not available: getaddrinfo ENOTFOUND disabled
[INFO] PostgreSQL not available, using SQLite
[INFO] SQLite database initialized: ./data/harnsaeure.db
```

3. `.env` wieder korrigieren:
   ```
   DB_HOST=db
   ```

### 5. Migration rückgängig machen (Optional)

Wenn du die Migration testen möchtest:

```bash
# SQLite-Datenbank wiederherstellen
mv data/harnsaeure.db.migrated data/harnsaeure.db

# PostgreSQL-Datenbank leeren
psql -h db -U goutservice -d goutdiary -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO goutservice;"

# Service neu starten
npm run dev
```

**Erwartetes Ergebnis**: Migration läuft erneut

## Fehlersuche

### Problem: "PostgreSQL not available"

**Lösung 1**: Docker-Container prüfen
```bash
docker ps | grep postgres
```

**Lösung 2**: PostgreSQL-Service prüfen
```bash
systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS
```

**Lösung 3**: Verbindung testen
```bash
psql -h db -p 5432 -U goutservice -d goutdiary
```

### Problem: "permission denied for schema public"

**Lösung**:
```sql
GRANT ALL ON SCHEMA public TO goutservice;
GRANT ALL ON ALL TABLES IN SCHEMA public TO goutservice;
```

### Problem: "database goutdiary does not exist"

**Lösung**:
```bash
psql -h db -U postgres -c "CREATE DATABASE goutdiary OWNER goutservice;"
```

### Problem: "role goutservice does not exist"

**Lösung**:
```bash
psql -h db -U postgres -c "CREATE USER goutservice WITH PASSWORD 'tosh&123';"
```

## Produktiv-Start

Nach erfolgreichem Test im Production-Modus starten:

```bash
npm run prod
```

Oder mit PM2:

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

## Überwachung

### Logs anzeigen

```bash
# PM2 Logs
pm2 logs goutdiary

# Direct logs (wenn mit npm gestartet)
# Logs erscheinen direkt in der Console
```

### Datenbank-Status

```bash
# PostgreSQL
psql -h db -U goutservice -d goutdiary -c "SELECT COUNT(*) FROM users;"
psql -h db -U goutservice -d goutdiary -c "SELECT COUNT(*) FROM meals;"

# Oder via Service Health Check
curl https://dev.gout-diary.com:3001/health
```

## Checkliste

- [ ] PostgreSQL läuft und ist erreichbar
- [ ] `.env` ist korrekt konfiguriert
- [ ] Service startet ohne Fehler
- [ ] Login funktioniert mit Admin-Benutzer
- [ ] Daten sind in PostgreSQL vorhanden (falls migriert)
- [ ] SQLite-Datenbank wurde umbenannt (.migrated)
- [ ] API-Endpunkte funktionieren
- [ ] Fallback auf SQLite funktioniert (optional getestet)
