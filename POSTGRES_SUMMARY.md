# PostgreSQL-Integration - Zusammenfassung

## Was wurde implementiert

Der Service wurde erweitert, um automatisch PostgreSQL zu unterstützen mit Fallback auf SQLite.

### Hauptfunktionen

1. **Automatische Datenbank-Erkennung**
   - Beim Start wird geprüft, ob PostgreSQL verfügbar ist
   - Falls ja → PostgreSQL wird verwendet
   - Falls nein → SQLite wird verwendet (Fallback)

2. **Automatische Schema-Erstellung**
   - PostgreSQL-Tabellen werden automatisch angelegt
   - Alle Indizes und Constraints werden erstellt
   - Kompatibel mit existierendem SQLite-Schema

3. **Automatische Migration**
   - SQLite-Daten werden automatisch nach PostgreSQL migriert
   - Erfolgt nur beim ersten Start mit PostgreSQL
   - Datentyp-Konvertierung (INTEGER→BOOLEAN, DATETIME→TIMESTAMPTZ)
   - SQLite-Datenbank wird umbenannt zu `.migrated`

4. **Standard-Admin-Benutzer**
   - Wird automatisch angelegt bei leerer PostgreSQL-Datenbank
   - Email: `dunker.thorsten@gmail.com`
   - Passwort: `tosh&123`

## Neue Dateien

### `/src/db/index.js`
Haupt-Datenbankmodul mit:
- PostgreSQL-Verbindungslogik
- Schema-Erstellung
- Migrations-Logik
- Standard-Admin-Erstellung

### `/src/db/adapter.js`
Datenbank-Adapter für einheitliche API:
- Konvertiert SQLite-Syntax zu PostgreSQL
- Abstrahiert Unterschiede zwischen beiden DBs
- Einheitliche Query-Schnittstelle

### Dokumentation
- `POSTGRESQL_MIGRATION_GUIDE.md` - Detaillierte Migrations-Anleitung
- `TESTING_POSTGRES.md` - Test-Anleitung
- `POSTGRES_SUMMARY.md` - Diese Datei

## Geänderte Dateien

### `/src/database.js`
- Wrapper um neues DB-System
- Fallback auf Legacy-SQLite
- Abwärtskompatibel

### `/src/app.js`
- `initDatabase()` ist jetzt async
- Unterstützt PostgreSQL-Initialisierung

### `/package.json`
- Neue Scripts: `npm run dev` und `npm run prod`
- Setzt NODE_ENV automatisch

### `/.env`
Neue PostgreSQL-Parameter bereits vorhanden:
```bash
DB_HOST=db
DB_PORT=5432
DB_NAME=goutdiary
DB_USER=goutservice
DB_PASSWORD='tosh&123'
```

## Datenbank-Schema

### Tabellen (identisch für SQLite und PostgreSQL)

1. **users**
   - Benutzer mit Authentifizierung
   - GUID für API-Zugriff
   - Admin-Status

2. **uric_acid_values**
   - Harnsäure-Messwerte
   - Lifestyle-Faktoren

3. **meals**
   - Mahlzeiten
   - Nährwertangaben

4. **meal_components**
   - Einzelne Lebensmittel in Mahlzeiten

5. **food_items**
   - Benutzerdefinierte Lebensmittel

6. **analysis_results**
   - Analyse-Ergebnisse

7. **api_keys**
   - API-Schlüssel mit Berechtigungen

## Start-Optionen

### Development (empfohlen für Test)
```bash
npm run dev
```
- Detailliertes Logging
- Automatischer Restart bei Dateiänderungen
- PostgreSQL-Prüfung und Migration

### Production
```bash
npm run prod
```
- Reduziertes Logging
- Keine Auto-Restart
- PostgreSQL-Prüfung und Migration

### Standard
```bash
npm start
```
- Verwendet aktuelle NODE_ENV

## Migrations-Workflow

```
Start
  ↓
PostgreSQL verfügbar?
  ├─ Nein → SQLite verwenden
  └─ Ja → PostgreSQL verwenden
         ↓
      Schema erstellen
         ↓
      SQLite-DB vorhanden?
         ├─ Nein → Admin-Benutzer erstellen
         └─ Ja → Daten vorhanden in PostgreSQL?
                ├─ Ja → Migration überspringen
                └─ Nein → Migration durchführen
                         ↓
                      SQLite umbenennen
```

## Wichtige Hinweise

### Für Development

1. **PostgreSQL muss NICHT laufen**
   - Service funktioniert weiterhin mit SQLite
   - Keine Änderungen am bestehenden Workflow nötig

2. **Migration ist einmalig**
   - Erfolgt nur beim ersten PostgreSQL-Start
   - SQLite-Datenbank wird umbenannt, nicht gelöscht
   - Bei Problemen einfach `.migrated` entfernen

3. **Admin-Benutzer**
   - Bei Migration: Alle existierenden Benutzer bleiben erhalten
   - Bei leerer DB: Neuer Admin wird automatisch erstellt
   - Email: `dunker.thorsten@gmail.com`
   - Passwort: `tosh&123`

### Für Production

1. **PostgreSQL empfohlen**
   - Bessere Performance bei vielen Nutzern
   - Besseres Concurrency-Handling
   - Enterprise-Features (Backup, Replikation)

2. **Backup-Strategie**
   - PostgreSQL: `pg_dump` verwenden
   - SQLite: Datei-Backup

3. **Monitoring**
   - Logs überwachen auf "PostgreSQL is available"
   - Prüfen ob Migration erfolgreich war
   - Bei Problemen: Service stoppt mit Fehler

## Rollback

Falls PostgreSQL-Migration fehlschlägt oder rückgängig gemacht werden soll:

```bash
# 1. Service stoppen
pm2 stop goutdiary  # oder Ctrl+C

# 2. SQLite wiederherstellen
mv data/harnsaeure.db.migrated data/harnsaeure.db

# 3. PostgreSQL deaktivieren (optional)
# In .env: DB_HOST=disabled

# 4. Service neu starten
npm run dev
```

## Performance-Vergleich

| Merkmal | SQLite | PostgreSQL |
|---------|--------|-----------|
| Setup | ✅ Einfach | ⚠️ Komplex |
| Concurrent Users | ⚠️ Begrenzt | ✅ Skaliert |
| Transactions | ✅ Ja | ✅ Ja + ACID |
| Backup | ✅ Datei kopieren | ⚠️ pg_dump |
| Replikation | ❌ Nein | ✅ Ja |
| Resource Usage | ✅ Minimal | ⚠️ Moderat |
| Production-Ready | ⚠️ Small Scale | ✅ Enterprise |

## Nächste Schritte

### Zum Testen

1. PostgreSQL-Container/Service starten
2. `.env` Verbindungsparameter prüfen
3. `npm run dev` ausführen
4. Logs prüfen
5. Login testen mit Admin-Benutzer
6. Datenbank-Inhalt prüfen

### Für Deployment

1. PostgreSQL-Datenbank bereitstellen
2. Credentials in `.env` eintragen
3. Service starten
4. Migration überwachen
5. Tests durchführen
6. SQLite-Backup aufbewahren

## Support & Debugging

### Logs wichtige Stellen

**PostgreSQL verbunden**:
```
[INFO] PostgreSQL is available, using PostgreSQL
[INFO] PostgreSQL connection established
```

**Migration läuft**:
```
[INFO] Starting migration from SQLite to PostgreSQL...
[INFO] Migrating X users...
[INFO] Migration completed successfully!
```

**SQLite Fallback**:
```
[WARN] PostgreSQL not available: <Fehlergrund>
[INFO] PostgreSQL not available, using SQLite
```

### Häufige Probleme

1. **"Connection refused"**
   - PostgreSQL läuft nicht
   - Firewall blockiert Port 5432
   - Falscher Hostname in DB_HOST

2. **"Authentication failed"**
   - Falsches Passwort in .env
   - User existiert nicht
   - pg_hba.conf nicht korrekt

3. **"Database does not exist"**
   - Datenbank `goutdiary` nicht erstellt
   - Mit `CREATE DATABASE` erstellen

4. **Migration schlägt fehl**
   - Foreign Keys in falscher Reihenfolge
   - Duplikate in Daten
   - Constraint-Verletzungen
   - Logs prüfen für Details

## Kontakt

Bei Fragen oder Problemen:
- Logs prüfen
- Dokumentation lesen
- GitHub Issues erstellen
