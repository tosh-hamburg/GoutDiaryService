# PostgreSQL Migration - Schnellstart

## Schritt 1: Abhängigkeiten installieren

```bash
npm install pg sqlite3 dotenv
```

## Schritt 2: PostgreSQL-Datenbank erstellen

```sql
-- Auf PostgreSQL-Server ausführen
CREATE DATABASE gout_diary;
CREATE USER gout_diary_user WITH PASSWORD 'sicheres_passwort';
GRANT ALL PRIVILEGES ON DATABASE gout_diary TO gout_diary_user;
```

## Schritt 3: Schema erstellen

```bash
psql -U postgres -d gout_diary -f scripts/create_schema.sql
```

## Schritt 4: Umgebungsvariablen setzen

Erstelle `.env` Datei:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gout_diary
DB_USER=gout_diary_user
DB_PASSWORD=sicheres_passwort
SQLITE_DB_PATH=W:\gout_diary.db
```

## Schritt 5: Migration ausführen

```bash
node scripts/migrate_sqlite_to_postgres.js
```

## Schritt 6: Datenbankmodul einrichten

Kopiere `config/database.js.example` nach `config/database.js` und passe an.

## Schritt 7: Backend-Code anpassen

Ersetze dein SQLite-Datenbankmodul durch das PostgreSQL-Modul:

```javascript
// Vorher (SQLite):
const db = require('./database');
const users = db.prepare('SELECT * FROM users').all();

// Nachher (PostgreSQL):
const { all } = require('./config/database');
const users = await all('SELECT * FROM gout_diary.users');
```

## Wichtige SQL-Unterschiede

- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `GROUP_CONCAT` → `STRING_AGG(column, ',')`
- `COUNT(*)` → gleich, aber `result.rowCount` statt `changes`
- Prepared Statements → `await query(sql, params)`

## Vollständige Dokumentation

Siehe `POSTGRESQL_MIGRATION.md` für detaillierte Informationen.

