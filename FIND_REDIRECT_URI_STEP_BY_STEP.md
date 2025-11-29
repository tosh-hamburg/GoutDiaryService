# Authorized redirect URIs finden - Schritt für Schritt

## Schritt 1: Navigiere zu Credentials

1. Öffne [Google Cloud Console](https://console.cloud.google.com/)
2. Stelle sicher, dass das **richtige Projekt** ausgewählt ist (oben links)
3. Im linken Menü: **APIs & Services** > **Credentials**

## Schritt 2: OAuth 2.0 Client ID finden

Du solltest eine Liste mit Credentials sehen. Suche nach:
- **OAuth 2.0 Client IDs** (nicht API Keys oder Service Accounts!)

Falls du **KEINEN** OAuth 2.0 Client ID siehst:

### OAuth Client erstellen:

1. Klicke oben auf **"+ CREATE CREDENTIALS"** (Erstellen)
2. Wähle **"OAuth client ID"**
3. Falls du noch keinen OAuth consent screen hast:
   - Du wirst aufgefordert, den Consent Screen zu konfigurieren
   - Klicke auf **"CONFIGURE CONSENT SCREEN"**
   - Wähle **"External"** (für Tests) oder **"Internal"** (für G Suite)
   - Fülle die erforderlichen Felder aus:
     - App name: z.B. "Harnsäure Tracker Service"
     - User support email: deine Email
     - Developer contact: deine Email
   - Klicke auf **"SAVE AND CONTINUE"**
   - Scopes: Klicke auf **"SAVE AND CONTINUE"** (Standard-Scopes sind OK)
   - Test users: Klicke auf **"SAVE AND CONTINUE"** (kann leer bleiben)
   - Klicke auf **"BACK TO DASHBOARD"**

4. Jetzt kannst du OAuth Client ID erstellen:
   - Application type: **"Web application"**
   - Name: z.B. "Harnsäure Tracker Service"
   - **HIER siehst du jetzt die Felder:**
     - **Authorized JavaScript origins**
     - **Authorized redirect URIs** ← DAS IST ES!

## Schritt 3: Redirect URI hinzufügen

Im Feld **"Authorized redirect URIs"**:

1. Klicke auf **"+ ADD URI"** (oder das Plus-Symbol)
2. Füge diese URL ein:
   ```
   https://gichttagebuchservice-936354735458.europe-west1.run.app/auth/google/callback
   ```
3. Klicke auf **"CREATE"** (oder "SAVE" wenn du bearbeitest)

## Alternative: Wenn du bereits einen OAuth Client hast

1. In der Credentials-Liste finde deinen **OAuth 2.0 Client ID**
2. Klicke auf das **Stift-Icon** (Bearbeiten) rechts neben dem Namen
   - ODER klicke auf den **Namen** des Clients
3. Du siehst jetzt die Bearbeitungsansicht mit:
   - **Authorized JavaScript origins**
   - **Authorized redirect URIs** ← DAS IST ES!

## Falls du es immer noch nicht findest

### Prüfe die Ansicht:

- Stelle sicher, dass du **"OAuth 2.0 Client IDs"** siehst, nicht "API Keys"
- Die Liste sollte Einträge wie "Web client" oder ähnliches zeigen
- Klicke auf einen Eintrag, um die Details zu sehen

### Screenshot-Hilfe:

Die Felder sollten so aussehen:

```
┌─────────────────────────────────────────┐
│ OAuth 2.0 Client ID                      │
├─────────────────────────────────────────┤
│ Name: [Harnsäure Tracker Service]       │
│                                         │
│ Authorized JavaScript origins           │
│ ┌─────────────────────────────────────┐ │
│ │ https://example.com                  │ │
│ └─────────────────────────────────────┘ │
│ [+ ADD URI]                              │
│                                         │
│ Authorized redirect URIs  ← HIER!      │
│ ┌─────────────────────────────────────┐ │
│ │ https://dev.gout-diary.com/auth/... │ │
│ └─────────────────────────────────────┘ │
│ [+ ADD URI]  ← HIER KLICKEN!            │
└─────────────────────────────────────────┘
```

## Wichtig: Unterschiedliche UI-Versionen

Google Cloud Console hat manchmal unterschiedliche UI-Versionen. Falls du es nicht findest:

1. **Versuche die alte UI**: Oben rechts gibt es manchmal einen Toggle für "New/Classic UI"
2. **Suche nach "redirect"**: Verwende Strg+F (Windows) oder Cmd+F (Mac) und suche nach "redirect"
3. **Prüfe alle Tabs**: Manchmal gibt es Tabs wie "General", "Advanced", etc.

## Noch nicht gefunden?

Beschreibe mir bitte:
1. Was siehst du genau in der Credentials-Liste?
2. Welche Optionen siehst du, wenn du auf einen OAuth Client klickst?
3. Gibt es Tabs oder Untermenüs?

