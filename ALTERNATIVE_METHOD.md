# Alternative Methode: Redirect URI über gcloud CLI hinzufügen

Falls du die Redirect URI nicht über die Web-UI hinzufügen kannst, kannst du es auch über die gcloud CLI machen.

## Schritt 1: Aktuelle OAuth Client Konfiguration anzeigen

```bash
gcloud auth application-default print-access-token
gcloud projects list  # Finde deine PROJECT_ID
```

## Schritt 2: OAuth Client ID finden

```bash
gcloud alpha iap oauth-clients list --project=DEINE-PROJECT-ID
```

Oder über die REST API:

```bash
# Hole die Liste der OAuth Clients
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://console.cloud.google.com/apis/credentials/oauthclient?project=DEINE-PROJECT-ID"
```

## Schritt 3: Redirect URI über REST API hinzufügen

Leider unterstützt gcloud CLI das direkte Bearbeiten von OAuth Clients nicht gut. Die beste Methode ist:

1. **Gehe zur Web-UI** (auch wenn es schwierig ist)
2. Oder **erstelle einen neuen OAuth Client** mit der richtigen Redirect URI

## Neue OAuth Client erstellen (mit gcloud)

```bash
# Erstelle einen neuen OAuth Client mit Redirect URI
gcloud alpha iap oauth-clients create \
  --display-name="Harnsaeure Tracker Service" \
  --project=DEINE-PROJECT-ID
```

**Aber:** Die gcloud CLI unterstützt das Setzen von Redirect URIs nicht direkt. Du musst es über die Web-UI machen.

## Empfehlung

Die einfachste Methode ist immer die Web-UI. Falls du Probleme hast:

1. **Versuche einen anderen Browser** (Chrome, Firefox, Edge)
2. **Lösche Browser-Cache** und Cookies für console.cloud.google.com
3. **Versuche Incognito/Private Mode**
4. **Prüfe ob du die richtigen Berechtigungen hast** (Owner oder Editor des Projekts)

## Direkter Link zu Credentials

Versuche diesen direkten Link (ersetze DEINE-PROJECT-ID):

```
https://console.cloud.google.com/apis/credentials?project=DEINE-PROJECT-ID
```

Dort solltest du alle Credentials sehen, inklusive OAuth 2.0 Client IDs.






