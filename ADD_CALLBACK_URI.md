# Callback-URL in Google Cloud Console hinzufügen

## Problem
Fehler: `redirect_uri_mismatch`
Die Callback-URL muss in der Google Cloud Console registriert werden.

## Exakte URL, die hinzugefügt werden muss:
```
https://gichttagebuchservice-936354735458.europe-west3.run.app/auth/google/callback
```

## Schritt-für-Schritt Anleitung:

### 1. Google Cloud Console öffnen
- Gehe zu: https://console.cloud.google.com/
- Stelle sicher, dass das richtige Projekt ausgewählt ist

### 2. Zu OAuth 2.0 Credentials navigieren
**Methode A (Direkter Link):**
- Gehe direkt zu: https://console.cloud.google.com/apis/credentials
- Oder: https://console.cloud.google.com/apis/credentials?project=freenas-261918

**Methode B (Über Menü):**
1. Klicke auf das **☰ (Hamburger-Menü)** oben links
2. Gehe zu **"APIs & Services"**
3. Klicke auf **"Credentials"** (oder "Anmeldedaten")

### 3. OAuth 2.0 Client ID finden und öffnen
1. Suche in der Liste nach **"OAuth 2.0 Client IDs"**
2. Du solltest eine oder mehrere Client IDs sehen
3. Klicke auf die **Web Client ID** (nicht die Android Client ID)
   - Der Name könnte sein: "HarnsaeureTracker Web Client" oder ähnlich
   - Der Typ sollte "Web application" sein

### 4. Authorized redirect URIs hinzufügen
1. Im geöffneten Dialog siehst du verschiedene Felder
2. Scrolle nach unten zu **"Authorized redirect URIs"**
3. Klicke auf **"+ ADD URI"** (oder "URI hinzufügen")
4. Füge diese exakte URL ein:
   ```
   https://gichttagebuchservice-936354735458.europe-west3.run.app/auth/google/callback
   ```
5. Klicke auf **"SAVE"** (oder "Speichern")

### 5. Warten und testen
- Die Änderungen können 1-2 Minuten dauern, bis sie aktiv sind
- Versuche dann erneut, dich anzumelden

## Wichtige Hinweise:

⚠️ **Exakte URL verwenden:**
- Die URL muss **genau** so sein, wie oben angegeben
- Keine Leerzeichen am Anfang oder Ende
- Keine zusätzlichen Slashes
- HTTPS muss verwendet werden (nicht HTTP)

⚠️ **Richtige Client ID:**
- Stelle sicher, dass du die **Web Client ID** bearbeitest (nicht die Android Client ID)
- Die Web Client ID wird für den Server verwendet

## Falls du die Stelle immer noch nicht findest:

### Alternative: Über die API-Seite
1. Gehe zu: https://console.cloud.google.com/apis/credentials
2. Klicke auf **"OAuth 2.0 Client IDs"** in der linken Seitenleiste (falls vorhanden)
3. Oder suche nach "OAuth" in der Suchleiste oben

### Screenshot-Hinweise:
- Suche nach einem Feld mit "Authorized redirect URIs" oder "Autorisierte Weiterleitungs-URIs"
- Es sollte eine Liste mit URLs sein (kann leer sein)
- Es gibt einen Button "ADD URI" oder "+ URI hinzufügen"

## Nach dem Hinzufügen:
1. Warte 1-2 Minuten
2. Versuche erneut, dich anzumelden
3. Der Fehler sollte verschwinden


