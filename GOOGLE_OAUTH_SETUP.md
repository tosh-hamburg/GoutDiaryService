# Google OAuth Setup für Harnsäure Tracker Service

## 1. Google Cloud Console Setup

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes aus
3. Aktiviere die Google+ API:
   - Gehe zu "APIs & Services" > "Library"
   - Suche nach "Google+ API" und aktiviere sie

## 2. OAuth 2.0 Credentials erstellen

1. Gehe zu "APIs & Services" > "Credentials"
2. Klicke auf "Create Credentials" > "OAuth client ID"
3. Falls du noch keinen OAuth consent screen hast:
   - Klicke auf "Configure Consent Screen"
   - Wähle "External" (für Tests) oder "Internal" (für G Suite)
   - Fülle die erforderlichen Felder aus
   - Speichere und weiter

4. Erstelle OAuth Client ID:
   - Application type: "Web application"
   - Name: z.B. "Harnsäure Tracker Service"
   - Authorized JavaScript origins:
     - `https://dev.gout-diary.com` (für Entwicklung)
     - `https://deine-domain.de` (für Produktion)
     - `https://gichttagebuchservice-xxxxx-ew.a.run.app` (für Cloud Run - OHNE /auth/google/callback!)
   - Authorized redirect URIs:
     - `https://dev.gout-diary.com/auth/google/callback` (für Entwicklung)
     - `https://deine-domain.de/auth/google/callback` (für Produktion)
     - `https://gichttagebuchservice-xxxxx-ew.a.run.app/auth/google/callback` (für Cloud Run)
     - **WICHTIG**: Verwende die exakte URL aus der Fehlermeldung, falls du einen redirect_uri_mismatch Fehler bekommst!
   - Klicke auf "Create"
   
   **Hinweis für Cloud Run**: Die URL kann sich ändern. Prüfe immer die tatsächliche URL in der Fehlermeldung!

5. Kopiere die Client ID und Client Secret

## 3. Umgebungsvariablen konfigurieren

Erstelle eine `.env` Datei im Root-Verzeichnis des Services (W:\\):

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Session Secret (WICHTIG: Ändere dies in Produktion!)
SESSION_SECRET=dein-super-geheimer-session-schluessel

# Google OAuth Configuration
GOOGLE_CLIENT_ID=deine-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=dein-client-secret
GOOGLE_CALLBACK_URL=https://dev.gout-diary.com/auth/google/callback

# CORS Configuration
ALLOWED_ORIGINS=https://dev.gout-diary.com

# Database
DB_PATH=./data/harnsaeure.db
```

## 4. Dependencies installieren

```bash
cd W:\
npm install
```

## 5. Service starten

```bash
npm start
```

oder für Entwicklung mit Auto-Reload:

```bash
npm run dev
```

## 6. Erster Login

1. Öffne `https://dev.gout-diary.com` im Browser
2. Du wirst zur Login-Seite weitergeleitet
3. Klicke auf "Mit Google anmelden"
4. Der erste Benutzer, der sich anmeldet, wird automatisch zum **Super-Admin**

## Funktionsweise

- **Anmeldung**: Nur über Google-Account möglich
- **Erster Benutzer**: Wird automatisch zum Super-Admin
- **Session**: Bleibt 24 Stunden aktiv
- **Schutz**: Alle Seiten außer `/login.html` erfordern Anmeldung

## API-Endpunkte

- `GET /auth/google` - Startet Google OAuth Flow
- `GET /auth/google/callback` - Google OAuth Callback
- `GET /auth/me` - Gibt aktuellen Benutzer zurück
- `POST /auth/logout` - Meldet Benutzer ab

## Sicherheitshinweise

- **SESSION_SECRET**: Muss in Produktion geändert werden!
- **HTTPS**: In Produktion sollte HTTPS verwendet werden
- **Cookie Secure Flag**: Wird automatisch in Produktion gesetzt

