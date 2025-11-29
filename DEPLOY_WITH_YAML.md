# Deployment mit YAML-Flags-Datei

## Schritt 1: YAML-Datei aus .env erstellen

Führe das Skript aus, um die .env Datei in YAML zu konvertieren:

```bash
node create-env-yaml.js
```

Dies erstellt die Datei `env-vars.yaml` mit allen Umgebungsvariablen im Format für `--flags-file`.

## Schritt 2: Service mit YAML-Flags-Datei deployen

### Mit --flags-file (Empfohlen)

**WICHTIG:** Verwende `--flags-file`, NICHT `--update-env-vars` mit Dateinamen!

```bash
gcloud run deploy gichttagebuchservice --source . --flags-file=env-vars.yaml
```

**FALSCH (wird nicht funktionieren):**
```bash
# ❌ FALSCH - funktioniert nicht!
gcloud run deploy ... --update-env-vars env-vars.yaml
```

Die YAML-Datei enthält bereits:
- `--update-env-vars`: Alle Umgebungsvariablen als Dictionary
- `--region`: europe-west1
- `--allow-unauthenticated`: true
- `--port`: 3001

### Alternative: Nur Umgebungsvariablen aus YAML

Falls du andere Flags manuell setzen möchtest:

```bash
gcloud run deploy gichttagebuchservice \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3001 \
  --flags-file=env-vars.yaml
```

## YAML-Format

Die YAML-Datei verwendet das Format für `--flags-file` laut [Google Cloud Dokumentation](https://docs.cloud.google.com/sdk/gcloud/reference/topic/flags-file):

```yaml
--update-env-vars:
  KEY1: VALUE1
  KEY2: VALUE2
  KEY3: "VALUE WITH SPACES"
--region: europe-west1
--allow-unauthenticated: true
--port: 3001
```

**Wichtig:** `--update-env-vars` erwartet ein Dictionary (Key-Value-Paare), nicht einen String!

## Wichtige Umgebungsvariablen

- `GOOGLE_CLIENT_ID`: OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 Client Secret
- `GOOGLE_CALLBACK_URL`: Callback URL (z.B. `https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback`)
- `SESSION_SECRET`: Geheimer Schlüssel für Sessions
- `NODE_ENV`: `production` für Produktion
- `PORT`: Port (normalerweise 3001)

## Hinweis

Die `env-vars.yaml` Datei enthält sensible Daten. Stelle sicher, dass sie:
- ✅ In `.gitignore` ist
- ✅ Nicht in Git committed wird
- ✅ Nach dem Deploy sicher aufbewahrt wird

## Referenz

Siehe: https://docs.cloud.google.com/sdk/gcloud/reference/topic/flags-file

