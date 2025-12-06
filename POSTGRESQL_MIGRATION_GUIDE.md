# PostgreSQL Migration Guide

## Übersicht

Der Service unterstützt jetzt automatisch PostgreSQL als primäre Datenbank mit Fallback auf SQLite. Die Migration erfolgt automatisch beim Start.

## Funktionsweise

### Beim Start

1. **PostgreSQL-Verfügbarkeit prüfen**: Der Service versucht, eine Verbindung zur PostgreSQL-Datenbank herzustellen
2. **PostgreSQL verfügbar**:
   - Verwendet PostgreSQL als Datenbank
   - Erstellt automatisch das Schema (Tabellen, Indizes)
   - Prüft, ob eine SQLite-Datenbank existiert
   - Migriert alle Daten von SQLite nach PostgreSQL (falls vorhanden)
   - Benennt SQLite-Datenbank um nach `.migrated`
   - Erstellt Standard-Admin-Benutzer (falls keine Daten vorhanden)

3. **PostgreSQL nicht verfügbar**:
   - Fällt zurück auf SQLite
   - Verwendet bestehende SQLite-Datenbank

### Standard-Admin-Benutzer

Wenn PostgreSQL verwendet wird und noch keine Daten existieren (leere Datenbank), wird automatisch ein Admin-Benutzer erstellt:

- **Email**: `dunker.thorsten@gmail.com`
- **Username**: `thorsten.dunker`
- **Passwort**: `tosh&123`
- **Admin-Rechte**: Ja

## Konfiguration

Die PostgreSQL-Verbindungsparameter werden aus der `.env`-Datei gelesen:

```bash
# PostgreSQL
DB_HOST=db                    # Hostname des PostgreSQL-Servers
DB_PORT=5432                  # Port (Standard: 5432)
DB_NAME=goutdiary            # Datenbankname
DB_USER=goutservice          # Benutzername
DB_PASSWORD='tosh&123'       # Passwort

# SQLite (Fallback)
DB_PATH=./data/harnsaeure.db # Pfad zur SQLite-Datei
```

## Start-Modi

### Development-Modus
```bash
npm run dev
```
- Setzt `NODE_ENV=development`
- Aktiviert detailliertes Logging
- Verwendet PostgreSQL falls verfügbar, sonst SQLite

### Production-Modus
```bash
npm run prod
```
- Setzt `NODE_ENV=production`
- Reduziertes Logging
- Verwendet PostgreSQL falls verfügbar, sonst SQLite

### Standard
```bash
npm start
```
- Verwendet die aktuelle NODE_ENV-Einstellung
- Standard ist development

## Datenmigration

### Automatische Migration

Die Migration erfolgt automatisch beim ersten Start mit PostgreSQL:

1. Service prüft PostgreSQL-Verbindung
2. Erstellt Schema in PostgreSQL
3. Prüft auf existierende SQLite-Datenbank (`./data/harnsaeure.db`)
4. Wenn SQLite-Daten gefunden:
   - Migriert alle Tabellen nach PostgreSQL
   - Konvertiert SQLite INTEGER (0/1) zu PostgreSQL BOOLEAN
   - Konvertiert DATETIME zu TIMESTAMPTZ
   - Erstellt alle Foreign Keys und Constraints
5. Benennt SQLite-Datenbank um zu `harnsaeure.db.migrated`
6. Logs zeigen Details zur Migration

### Migrierte Tabellen

- `users` - Benutzer mit Authentifizierung
- `uric_acid_values` - Harnsäurewerte
- `meals` - Mahlzeiten
- `meal_components` - Mahlzeiten-Komponenten
- `food_items` - Benutzerdefinierte Lebensmittel
- `analysis_results` - Analyse-Ergebnisse
- `api_keys` - API-Schlüssel

### Rollback

Falls die Migration fehlschlägt:

1. PostgreSQL-Daten werden mit ROLLBACK zurückgesetzt
2. SQLite-Datenbank bleibt unverändert
3. Service verwendet weiterhin SQLite

Um manuell zur SQLite zurückzukehren:

```bash
# PostgreSQL-Verbindung in .env deaktivieren
# DB_HOST=db
DB_HOST=disabled

# Service neu starten
npm run dev
```

### Manuelle Migration zurücksetzen

```bash
# SQLite-Datenbank wiederherstellen
mv data/harnsaeure.db.migrated data/harnsaeure.db

# PostgreSQL-Datenbank leeren (optional)
psql -h db -U goutservice -d goutdiary -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

## Unterschiede zwischen SQLite und PostgreSQL

### Datentypen

| SQLite | PostgreSQL |
|--------|-----------|
| INTEGER (0/1) für Booleans | BOOLEAN (true/false) |
| DATETIME | TIMESTAMPTZ |
| TEXT | TEXT |
| REAL | REAL |

### Query-Syntax

Der DatabaseAdapter in `src/db/adapter.js` konvertiert automatisch:
- Platzhalter: `?` → `$1, $2, ...`
- BOOLEAN-Werte: `INTEGER DEFAULT 0` → `BOOLEAN DEFAULT FALSE`
- Timestamps: `DATETIME` → `TIMESTAMPTZ`

## Logging

### PostgreSQL-Migration

```
[INFO] Initializing database...
[INFO] PostgreSQL is available, using PostgreSQL
[INFO] PostgreSQL connection established
[INFO] Creating PostgreSQL schema...
[INFO] PostgreSQL schema created successfully
[INFO] SQLite database found at ./data/harnsaeure.db, checking if migration needed
[INFO] Starting migration from SQLite to PostgreSQL...
[INFO] Migrating 5 users...
[INFO] Migrating 150 uric acid values...
[INFO] Migrating 80 meals...
[INFO] Migration completed successfully!
[INFO] SQLite database renamed to ./data/harnsaeure.db.migrated
```

### SQLite-Fallback

```
[INFO] Initializing database...
[WARN] PostgreSQL not available: connect ECONNREFUSED
[INFO] PostgreSQL not available, using SQLite
[INFO] SQLite database initialized: ./data/harnsaeure.db
```

## Fehlerbehebung

### PostgreSQL-Verbindung schlägt fehl

**Symptom**: Service nutzt SQLite statt PostgreSQL

**Lösungen**:
1. Prüfe ob PostgreSQL läuft: `docker ps` (falls Docker)
2. Prüfe Verbindungsparameter in `.env`
3. Teste Verbindung: `psql -h db -U goutservice -d goutdiary`
4. Prüfe Firewall/Netzwerk
5. Logs prüfen: Fehlerdetails in Console

### Migration schlägt fehl

**Symptom**: Fehler bei Datenmigration

**Lösungen**:
1. Prüfe PostgreSQL-Logs: `docker logs <container>`
2. Prüfe ob Schema existiert: `\dt` in psql
3. Prüfe Berechtigungen: `GRANT ALL ON DATABASE goutdiary TO goutservice;`
4. SQLite-Datenbank intakt?: `sqlite3 data/harnsaeure.db ".tables"`

### Admin-Benutzer existiert nicht

**Symptom**: Kann mich nicht anmelden

**Lösungen**:
1. Prüfe ob Migration erfolgt ist (dann sind alte Benutzer vorhanden)
2. Bei neuer Datenbank: Admin wird automatisch erstellt
3. Manuell erstellen (siehe unten)

### Manuell Admin-Benutzer erstellen

```bash
# In psql oder mit SQL-Client
psql -h db -U goutservice -d goutdiary

INSERT INTO users (id, guid, email, username, password_hash, is_admin, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  gen_random_uuid()::text,
  'dunker.thorsten@gmail.com',
  'thorsten.dunker',
  -- bcrypt hash für 'tosh&123'
  '$2b$10$xYzAbC123...',  -- Hash mit bcrypt generieren
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

## Performance

### PostgreSQL Vorteile

- Bessere Concurrency (gleichzeitige Zugriffe)
- ACID-Transaktionen
- Besseres Locking
- Skalierbarkeit
- Backup/Recovery-Tools
- Replikation

### SQLite Vorteile

- Keine separate Server-Installation
- Einzelne Datei
- Einfaches Backup (Datei kopieren)
- Geringer Overhead

## Backup

### PostgreSQL

```bash
# Komplettes Backup
pg_dump -h db -U goutservice goutdiary > backup.sql

# Nur Schema
pg_dump -h db -U goutservice --schema-only goutdiary > schema.sql

# Nur Daten
pg_dump -h db -U goutservice --data-only goutdiary > data.sql

# Restore
psql -h db -U goutservice goutdiary < backup.sql
```

### SQLite

```bash
# Backup
cp data/harnsaeure.db data/backup_$(date +%Y%m%d).db

# Restore
cp data/backup_20241206.db data/harnsaeure.db
```

## Support

Bei Fragen oder Problemen:
1. Logs prüfen
2. Verbindungsparameter in `.env` prüfen
3. PostgreSQL-Status prüfen
4. GitHub Issues erstellen
