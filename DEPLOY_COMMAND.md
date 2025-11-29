# Deployment-Befehl

## ✅ RICHTIG - Verwende diesen Befehl:

```bash
gcloud run deploy gichttagebuchservice --source . --flags-file=env-vars.yaml
```

## ❌ FALSCH - Diese Befehle funktionieren NICHT:

```bash
# ❌ FALSCH - funktioniert nicht!
gcloud run deploy ... --update-env-vars env-vars.yaml

# ❌ FALSCH - funktioniert nicht!
gcloud run deploy ... --update-env-vars=env-vars.yaml
```

## Erklärung:

- `--flags-file=env-vars.yaml` lädt die gesamte YAML-Datei und wendet alle Flags darin an
- `--update-env-vars` erwartet direkt ein Dictionary (KEY=VALUE,KEY2=VALUE2), **nicht** einen Dateinamen

## Vollständiger Befehl:

```bash
gcloud run deploy gichttagebuchservice \
  --source . \
  --flags-file=env-vars.yaml
```

Die `env-vars.yaml` Datei enthält bereits:
- `--update-env-vars` mit allen Umgebungsvariablen
- `--region: europe-west1`
- `--allow-unauthenticated: true`
- `--port: 3001`

Daher reicht:
```bash
gcloud run deploy gichttagebuchservice --source . --flags-file=env-vars.yaml
```

