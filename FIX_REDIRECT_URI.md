# Redirect URI Fehler beheben

## Fehler: redirect_uri_mismatch

Die Redirect-URI `https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback` ist nicht in deinen Google OAuth Credentials registriert.

## Lösung: Redirect URI in Google Cloud Console hinzufügen

### Schritt 1: Google Cloud Console öffnen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Wähle dein Projekt aus
3. Navigiere zu **APIs & Services** > **Credentials**

### Schritt 2: OAuth 2.0 Client ID bearbeiten

1. Finde deinen **OAuth 2.0 Client ID** in der Liste
2. Klicke auf das **Stift-Icon** (Bearbeiten) oder auf den Namen

### Schritt 3: Authorized redirect URIs hinzufügen

1. Scrolle zu **"Authorized redirect URIs"**
2. Klicke auf **"+ URI HINZUFÜGEN"** (Add URI)
3. Füge diese URL hinzu:
   ```
   https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback
   ```
4. Klicke auf **"SPEICHERN"** (Save)

### Schritt 4: Warte auf Aktivierung

Die Änderungen können einige Minuten dauern, bis sie aktiv sind (normalerweise sofort, aber manchmal bis zu 5 Minuten).

## Wichtige Hinweise

### Alle möglichen URLs hinzufügen

Falls du mehrere Umgebungen hast, füge alle hinzu:

```
# Produktion (Cloud Run)
https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback

# Development-Umgebung
https://dev.gout-diary.com/auth/google/callback
```

### URL-Format prüfen

- ✅ **RICHTIG**: `https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback`
- ❌ **FALSCH**: `https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback/` (kein Slash am Ende!)
- ❌ **FALSCH**: `http://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback` (http statt https!)

### GOOGLE_CALLBACK_URL in Cloud Run prüfen

Stelle sicher, dass die `GOOGLE_CALLBACK_URL` Umgebungsvariable in Cloud Run korrekt gesetzt ist:

```bash
gcloud run services describe gichttagebuchservice \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep GOOGLE_CALLBACK_URL
```

Sollte zeigen:
```
GOOGLE_CALLBACK_URL=https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback
```

Falls nicht, setze es:
```bash
gcloud run services update gichttagebuchservice \
  --region europe-west1 \
  --update-env-vars GOOGLE_CALLBACK_URL=https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback
```

## Nach dem Hinzufügen

1. Warte 1-2 Minuten
2. Versuche dich erneut anzumelden
3. Der Fehler sollte verschwunden sein

## Troubleshooting

### Fehler bleibt bestehen?

1. **Prüfe die exakte URL**: Kopiere die URL aus der Fehlermeldung und füge sie genau so hinzu
2. **Prüfe http vs https**: Cloud Run verwendet immer HTTPS
3. **Prüfe die Region**: Die URL zeigt `europe-west1`, nicht `europe-west3` - stelle sicher, dass du die richtige URL verwendest
4. **Cache leeren**: Versuche einen anderen Browser oder Incognito-Modus

### Region-Unterschied

Deine ursprüngliche Deploy-Region war `europe-west3`, aber die tatsächliche URL ist `europe-west1`. Das ist normal - Google Cloud Run kann die URL automatisch anpassen. Verwende immer die URL, die in der Fehlermeldung steht!

