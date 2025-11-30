# Dependencies Installation

Die folgenden Pakete müssen installiert werden:

```bash
npm install express-session passport passport-google-oauth20
```

Oder alle Dependencies aus package.json installieren:

```bash
npm install
```

## Auf Synology NAS (wenn der Service dort läuft)

1. SSH zum NAS verbinden
2. Zum Service-Verzeichnis wechseln:
   ```bash
   cd /volume1/nodejs/UricAcidService
   ```
3. Dependencies installieren:
   ```bash
   npm install
   ```

## Auf Windows (lokale Entwicklung)

1. Zum Service-Verzeichnis wechseln:
   ```bash
   cd W:\
   ```
2. Dependencies installieren:
   ```bash
   npm install
   ```

## Neue Dependencies

Die folgenden Pakete wurden zur `package.json` hinzugefügt:
- `express-session` - Session-Management
- `passport` - Authentifizierungs-Middleware
- `passport-google-oauth20` - Google OAuth 2.0 Strategy

Nach der Installation sollte der Service ohne Fehler starten.


