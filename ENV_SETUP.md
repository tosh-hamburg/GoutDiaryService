# Umgebungsvariablen Setup

## Erforderliche Umgebungsvariablen

Erstelle eine `.env` Datei im Service-Verzeichnis (`/volume1/nodejs/UricAcidService/.env`) mit folgenden Variablen:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Session Secret (WICHTIG: Generiere einen zufälligen String!)
# Generiere mit: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=dein-generierter-session-secret-hier

# Google OAuth Configuration (ERFORDERLICH für Login!)
GOOGLE_CLIENT_ID=deine-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=dein-client-secret
GOOGLE_CALLBACK_URL=https://dev.gout-diary.com/auth/google/callback

# CORS Configuration
ALLOWED_ORIGINS=https://dev.gout-diary.com

# Database
DB_PATH=./data/harnsaeure.db
```

## Session Secret generieren

Führe diesen Befehl auf dem Server aus:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Kopiere den generierten String und verwende ihn als `SESSION_SECRET`.

## Google OAuth Credentials

Siehe `GOOGLE_OAUTH_SETUP.md` für die detaillierte Anleitung zur Einrichtung der Google OAuth Credentials.

## Wichtig

- **SESSION_SECRET**: Muss ein zufälliger, sicherer String sein (mindestens 32 Zeichen)
- **GOOGLE_CLIENT_ID** und **GOOGLE_CLIENT_SECRET**: Erforderlich für die Anmeldung
- Die `.env` Datei sollte **NICHT** in Git committed werden (sollte in `.gitignore` sein)

## Prüfen ob .env geladen wird

Der Service lädt die `.env` Datei automatisch beim Start. Prüfe die Logs beim Starten des Services, ob Warnungen über fehlende Credentials erscheinen.

