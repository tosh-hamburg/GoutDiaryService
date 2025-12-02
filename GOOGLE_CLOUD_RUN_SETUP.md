# Google Cloud Run Setup

## Wichtig: .env Dateien werden NICHT verwendet!

Google Cloud Run verwendet **keine `.env` Dateien**. Stattdessen müssen Umgebungsvariablen direkt in Cloud Run konfiguriert werden.

## Umgebungsvariablen in Cloud Run setzen

### Option 1: Über Google Cloud Console (Web-UI)

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Navigiere zu **Cloud Run** > **gichttagebuchservice**
3. Klicke auf den Service-Namen
4. Klicke auf **"BEARBEITEN UND NEU DEPLOYEN"** (Edit & Deploy New Revision)
5. Scrolle zu **"Variablen und Geheimnisse"** (Variables & Secrets)
6. Klicke auf **"VARIABLE HINZUFÜGEN"** (Add Variable)
7. Füge jede Variable einzeln hinzu:

   - Name: `GOOGLE_CLIENT_ID`, Wert: `deine-client-id.apps.googleusercontent.com`
   - Name: `GOOGLE_CLIENT_SECRET`, Wert: `dein-client-secret`
   - Name: `GOOGLE_CALLBACK_URL`, Wert: `https://gichttagebuchservice-xxxxx-ew.a.run.app/auth/google/callback`
   - Name: `SESSION_SECRET`, Wert: `dein-session-secret`
   - Name: `PORT`, Wert: `3001`
   - Name: `NODE_ENV`, Wert: `production`
   - Name: `ALLOWED_ORIGINS`, Wert: `https://gichttagebuchservice-xxxxx-ew.a.run.app`
   - Name: `DB_PATH`, Wert: `/tmp/harnsaeure.db` (oder ein Cloud Storage Pfad)

8. Klicke auf **"DEPLOYEN"** (Deploy)

### Option 2: Über gcloud CLI

```bash
gcloud run services update gichttagebuchservice \
  --region europe-west3 \
  --update-env-vars \
    GOOGLE_CLIENT_ID=deine-client-id.apps.googleusercontent.com,\
    GOOGLE_CLIENT_SECRET=dein-client-secret,\
    GOOGLE_CALLBACK_URL=https://gichttagebuchservice-xxxxx-ew.a.run.app/auth/google/callback,\
    SESSION_SECRET=dein-session-secret,\
    PORT=3001,\
    NODE_ENV=production,\
    ALLOWED_ORIGINS=https://gichttagebuchservice-xxxxx-ew.a.run.app,\
    DB_PATH=/tmp/harnsaeure.db
```

### Option 3: Über YAML-Datei

Erstelle eine `cloud-run-config.yaml`:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: gichttagebuchservice
spec:
  template:
    spec:
      containers:
      - image: gcr.io/PROJECT-ID/gichttagebuchservice
        env:
        - name: GOOGLE_CLIENT_ID
          value: "deine-client-id.apps.googleusercontent.com"
        - name: GOOGLE_CLIENT_SECRET
          value: "dein-client-secret"
        - name: GOOGLE_CALLBACK_URL
          value: "https://gichttagebuchservice-xxxxx-ew.a.run.app/auth/google/callback"
        - name: SESSION_SECRET
          value: "dein-session-secret"
        - name: PORT
          value: "3001"
        - name: NODE_ENV
          value: "production"
        - name: ALLOWED_ORIGINS
          value: "https://gichttagebuchservice-xxxxx-ew.a.run.app"
        - name: DB_PATH
          value: "/tmp/harnsaeure.db"
```

Dann deployen:
```bash
gcloud run services replace cloud-run-config.yaml --region europe-west3
```

## Wichtige Hinweise

### 1. GOOGLE_CALLBACK_URL anpassen

Die `GOOGLE_CALLBACK_URL` muss auf deine Cloud Run URL zeigen:
```
https://gichttagebuchservice-xxxxx-ew.a.run.app/auth/google/callback
```

**Wichtig:** Diese URL muss auch in den Google OAuth Credentials in der Google Cloud Console als "Authorized redirect URI" eingetragen sein!

### 2. Datenbank-Persistenz

Cloud Run Container sind **stateless** - Dateien in `/tmp` werden beim Neustart gelöscht!

**Optionen für persistente Datenbank:**
- **Cloud SQL** (empfohlen für Produktion)
- **Cloud Storage** (für SQLite-Dateien)
- **Firestore** oder **Cloud Spanner**

Für Tests kannst du `/tmp` verwenden, aber Daten gehen bei jedem Neustart verloren.

### 3. Session Secret generieren

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Aktuelle Umgebungsvariablen anzeigen

```bash
gcloud run services describe gichttagebuchservice \
  --region europe-west3 \
  --format="value(spec.template.spec.containers[0].env)"
```

## Nach dem Setzen der Variablen

1. Service neu deployen (wird automatisch gemacht beim Update)
2. Prüfe die Logs:
```bash
gcloud run services logs read gichttagebuchservice \
  --region europe-west3 \
  --limit 50
```

Du solltest jetzt sehen:
```
GOOGLE_CLIENT_ID is SET
GOOGLE_CLIENT_SECRET is SET
```

## Sicherheit

- **NIEMALS** `.env` Dateien in Git committen!
- Verwende **Cloud Run Secrets** für sensible Daten (empfohlen):
```bash
# Secret erstellen
echo -n "dein-secret" | gcloud secrets create session-secret --data-file=-

# In Cloud Run verwenden
gcloud run services update gichttagebuchservice \
  --region europe-west3 \
  --update-secrets SESSION_SECRET=session-secret:latest
```










