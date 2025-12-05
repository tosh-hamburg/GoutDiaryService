# Admin-Benutzer Setup

## Problem: Admin-Benutzer wurde gelöscht

Wenn der Admin-Benutzer gelöscht wurde und Sie sich nicht mehr anmelden können, führen Sie das folgende Script aus:

## Lösung: Admin-Benutzer neu erstellen

### Windows (PowerShell):
```powershell
cd W:\
node scripts\createAdminUser.js
```

### Linux/Mac:
```bash
cd /path/to/service
node scripts/createAdminUser.js
```

## Standard-Anmeldedaten (Development)

Nach dem Ausführen des Scripts können Sie sich mit folgenden Daten anmelden:

- **Benutzername:** `admin`
- **Passwort:** `N6M6M:S3x$3-33R1LSsS`
- **Email:** `admin@dev.gout-diary.com`

## Hinweise

- Das Script erstellt den Admin-Benutzer nur, wenn er nicht bereits existiert
- Wenn der Benutzer existiert, aber kein Admin ist, wird der Admin-Status gesetzt
- Das Script funktioniert nur im Development-Modus

## Alternative: Manuell über Datenbank

Falls das Script nicht funktioniert, können Sie den Admin-Benutzer auch manuell in der Datenbank erstellen:

```sql
-- Passwort-Hash für "N6M6M:S3x$3-33R1LSsS" (bcrypt, 10 rounds)
-- Sie müssen den Hash mit bcrypt generieren
INSERT INTO users (id, guid, username, password_hash, is_admin, email)
VALUES (
  '<uuid>',
  '<uuid>',
  'admin',
  '<bcrypt-hash>',
  1,
  'admin@dev.gout-diary.com'
);
```

## Passwort ändern

Falls Sie das Passwort ändern möchten, können Sie es in der Datenbank aktualisieren:

```sql
-- Neues Passwort-Hash generieren (z.B. mit bcrypt)
UPDATE users 
SET password_hash = '<neuer-bcrypt-hash>' 
WHERE username = 'admin';
```








