# Deployment mit Umgebungsvariablen

## Schritt 1: JSON-Datei aus .env erstellen

Führe das Skript aus, um die .env Datei in JSON zu konvertieren:

```bash
node create-env-json.js
```

Dies erstellt die Datei `env-vars.json` mit allen Umgebungsvariablen.

## Schritt 2: Service mit Umgebungsvariablen deployen

### Option A: Mit JSON-Datei (Empfohlen)

```bash
gcloud run deploy gichttagebuchservice \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3001 \
  --update-env-vars-from-file env-vars.json
```

### Option B: Einzelne Variablen setzen

```bash
gcloud run deploy gichttagebuchservice \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3001 \
  --set-env-vars "GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,SESSION_SECRET=..."
```

### Option C: Über Google Cloud Console

1. Gehe zu: https://console.cloud.google.com/run
2. Wähle den Service `gichttagebuchservice`
3. Klicke auf "BEARBEITEN UND NEU DEPLOYEN"
4. Scrolle zu "Container, Variablen, Secrets, Verbindungen"
5. Klicke auf "VARIABLEN UND SECRETS"
6. Füge alle Variablen aus `env-vars.json` hinzu
7. Klicke auf "DEPLOYEN"

## Wichtige Umgebungsvariablen

- `GOOGLE_CLIENT_ID`: OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 Client Secret
- `GOOGLE_CALLBACK_URL`: Callback URL (z.B. `https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback`)
- `SESSION_SECRET`: Geheimer Schlüssel für Sessions
- `NODE_ENV`: `production` für Produktion
- `PORT`: Port (normalerweise 3001)

## Hinweis

Die `env-vars.json` Datei enthält sensible Daten. Stelle sicher, dass sie:
- ✅ In `.gitignore` ist
- ✅ Nicht in Git committed wird
- ✅ Nach dem Deploy sicher aufbewahrt wird











