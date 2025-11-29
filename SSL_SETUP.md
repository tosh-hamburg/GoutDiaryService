# SSL-Zertifikat Setup für Synology NAS

## Option 1: Synology Reverse Proxy mit Let's Encrypt (Empfohlen)

Synology hat ein integriertes Reverse Proxy System, das SSL-Zertifikate direkt verwaltet. Das ist die einfachste Lösung, da Port 80/443 bereits vom DSM verwendet werden.

### Voraussetzungen:
- Domäne zeigt auf deine Synology (DNS A-Record)
- Synology DSM ist erreichbar
- Admin-Zugriff auf DSM

### Schritt 1: Let's Encrypt Zertifikat in DSM erstellen

1. **Öffne DSM** (z.B. `https://192.68.4.59:5001`)
2. Gehe zu **Systemsteuerung** → **Sicherheit** → **Zertifikat**
3. Klicke auf **Hinzufügen** → **Neues Zertifikat hinzufügen**
4. Wähle **Zertifikat hinzufügen** → **Lass uns Encrypt-Zertifikat abrufen**
5. Fülle die Felder aus:
   - **Domänenname**: `deine-domain.de`
   - **E-Mail**: Deine E-Mail-Adresse
   - **Alternative Domänennamen**: `www.deine-domain.de` (optional)
6. Klicke auf **Übernehmen**

**Wichtig:** Synology benötigt Port 80 für die Let's Encrypt-Validierung. Falls Port 80 nicht erreichbar ist:
- Öffne Port 80 temporär für die Zertifikatserstellung
- Oder verwende DNS-Validierung (siehe unten)

### Schritt 2: Zertifikat dem Port zuweisen

1. Gehe zu **Systemsteuerung** → **Sicherheit** → **Zertifikat**
2. Wähle das erstellte Let's Encrypt-Zertifikat aus
3. Klicke auf **Bearbeiten** oder **Konfigurieren**
4. In den Zertifikat-Einstellungen findest du die Option **"Port"** oder **"Gilt für Port"**
5. Wähle den Port aus, den du für den Reverse Proxy verwenden möchtest:
   - **Port 443** (Standard HTTPS)
   - **Oder einen anderen Port** (z.B. 8443, falls 443 bereits belegt ist)
6. Klicke auf **Übernehmen**

**Wichtig:** Notiere dir den gewählten Port, du benötigst ihn für den Reverse Proxy!

### Schritt 3: Reverse Proxy konfigurieren

1. Gehe zu **Systemsteuerung** → **Anmeldungsportal** → **Erweitert** → **Reverse-Proxy**
2. Klicke auf **Erstellen**
3. Konfiguriere den Reverse Proxy:

   **Beschreibung:** `Harnsäure Tracker Service`
   
   **Quelle:**
   - **Protokoll:** HTTPS
   - **Hostname:** `deine-domain.de`
   - **Port:** `443` (oder den Port, den du im Zertifikat konfiguriert hast, z.B. `8443`)
   - **HSTS aktivieren:** ✅ (empfohlen)
   
   **Ziel:**
   - **Protokoll:** HTTP
   - **Hostname:** `localhost`
   - **Port:** `3001`

4. Klicke auf **Speichern**

**Hinweis:** Das Zertifikat wird automatisch für den konfigurierten Port verwendet, da du es bereits in Schritt 2 dem Port zugewiesen hast.

### Alternative: Manuelle Nginx-Konfiguration (falls Reverse Proxy keine Zertifikat-Option hat)

Falls die Zertifikat-Option im Reverse Proxy fehlt, kannst du Nginx direkt konfigurieren:

1. **SSH-Verbindung zum Server:**
   ```bash
   ssh adm_ssh@192.68.4.59
   ```

2. **Nginx-Konfiguration bearbeiten:**
   ```bash
   sudo nano /etc/nginx/sites-available/gichttagebuchservice
   ```

3. **Füge diese Konfiguration ein:**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name deine-domain.de www.deine-domain.de;

       # Synology Let's Encrypt Zertifikat-Pfad
       ssl_certificate /usr/syno/etc/certificate/system/default/fullchain.pem;
       ssl_certificate_key /usr/syno/etc/certificate/system/default/privkey.pem;
       
       # ODER falls du ein spezifisches Zertifikat erstellt hast:
       # ssl_certificate /usr/syno/etc/certificate/ReverseProxy/[dein-zertifikat-name]/fullchain.pem;
       # ssl_certificate_key /usr/syno/etc/certificate/ReverseProxy/[dein-zertifikat-name]/privkey.pem;
       
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   
   server {
       listen 80;
       server_name deine-domain.de www.deine-domain.de;
       return 301 https://$server_name$request_uri;
   }
   ```

4. **Zertifikat-Pfad finden:**
   ```bash
   # Finde das Let's Encrypt Zertifikat
   sudo find /usr/syno/etc/certificate -name "fullchain.pem" -type f
   sudo find /usr/syno/etc/certificate -name "privkey.pem" -type f
   ```

5. **Nginx-Konfiguration testen und neu laden:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   # ODER bei Synology:
   sudo /usr/syno/bin/synoservicecfg --restart nginx
   ```

### Schritt 4: HTTP zu HTTPS Redirect (optional)

Falls du auch HTTP (Port 80) unterstützen möchtest:

1. Erstelle einen zweiten Reverse Proxy:
   - **Quelle:** HTTP, Port 80
   - **Ziel:** HTTPS, Port 443 (oder dein gewählter HTTPS-Port)
   - **Typ:** Redirect

### Schritt 5: Port-Weiterleitung in Router (falls nötig)

Falls du einen anderen Port als 443 verwendest (z.B. 8443), musst du im Router Port-Weiterleitung einrichten:
- **Externer Port:** 443 → **Interner Port:** 8443
- **Protokoll:** TCP
- **Ziel-IP:** 192.68.4.59

### Schritt 6: Google OAuth Callback-URL aktualisieren

1. Gehe zu: https://console.cloud.google.com/apis/credentials
2. Öffne deine OAuth 2.0 Client ID (Web application)
3. Unter "Authorized redirect URIs":
   - Entferne die alte URL mit `https://gichttagebuchservice-...run.app`
   - Füge die neue URL hinzu: `https://deine-domain.de/auth/google/callback`
     (oder `https://deine-domain.de:8443/auth/google/callback` falls anderer Port)
4. Speichere

5. Aktualisiere auch `GOOGLE_CALLBACK_URL` in der `env-vars.yaml`:
   ```yaml
   GOOGLE_CALLBACK_URL: "https://deine-domain.de/auth/google/callback"
   ```

### Alternative: DNS-Validierung (wenn Port 80 nicht erreichbar)

Falls Port 80 nicht erreichbar ist, kannst du DNS-Validierung verwenden:

1. In DSM: **Zertifikat hinzufügen** → **Lass uns Encrypt-Zertifikat abrufen**
2. Wähle **DNS-Validierung** statt HTTP-Validierung
3. Folge den Anweisungen, um TXT-Records in deinem DNS zu erstellen
4. Warte auf Validierung und klicke auf **Übernehmen**

## Option 2: Certbot mit anderem Port (Erweitert)

Falls du Certbot direkt verwenden möchtest, aber Port 80/443 nicht verfügbar sind:

### Schritt 1: Certbot installieren (via SSH)

```bash
ssh adm_ssh@192.68.4.59
sudo apt update
sudo apt install certbot
```

### Schritt 2: Zertifikat mit DNS-Validierung erstellen

```bash
sudo certbot certonly --manual --preferred-challenges dns -d deine-domain.de -d www.deine-domain.de
```

Folge den Anweisungen, um TXT-Records in deinem DNS zu erstellen.

### Schritt 3: Zertifikat in Synology importieren

1. Kopiere die Zertifikatsdateien:
   - `/etc/letsencrypt/live/deine-domain.de/fullchain.pem`
   - `/etc/letsencrypt/live/deine-domain.de/privkey.pem`

2. In DSM: **Systemsteuerung** → **Sicherheit** → **Zertifikat** → **Importieren**
3. Wähle die Dateien aus und importiere

### Schritt 4: Automatische Erneuerung einrichten

Erstelle ein Script für die automatische Erneuerung:

```bash
sudo nano /usr/local/bin/renew-cert.sh
```

Inhalt:
```bash
#!/bin/bash
certbot renew --quiet
# Kopiere Zertifikate nach Synology (anpassen nach Bedarf)
# Oder verwende Synology API für automatischen Import
```

Ausführbar machen:
```bash
sudo chmod +x /usr/local/bin/renew-cert.sh
```

Cron-Job einrichten:
```bash
sudo crontab -e
# Füge hinzu:
0 3 * * * /usr/local/bin/renew-cert.sh
```

## Option 3: Cloudflare (falls du Cloudflare verwendest)

Wenn du Cloudflare verwendest, kannst du auch Cloudflare SSL verwenden:

1. In Cloudflare Dashboard: **SSL/TLS** → **Overview**
2. Verschlüsselungsmodus auf **"Full"** oder **"Full (strict)"** setzen
3. Cloudflare generiert automatisch ein Zertifikat
4. Verwende Cloudflare als Reverse Proxy (Origin Certificate optional)

## Wichtige Hinweise für Synology:

1. **DNS-Konfiguration**: Stelle sicher, dass deine Domäne auf die IP deiner Synology zeigt
   ```bash
   dig deine-domain.de
   # Sollte 192.68.4.59 zurückgeben
   ```

2. **Port-Konfiguration**: 
   - Synology verwendet Port 80/443 für DSM
   - Verwende Reverse Proxy mit anderen Ports (z.B. 8443) oder
   - Nutze Synology Reverse Proxy (empfohlen)

3. **Automatische Erneuerung**: Synology erneuert Let's Encrypt-Zertifikate automatisch

4. **Google OAuth**: Vergiss nicht, die Callback-URL in Google Cloud Console zu aktualisieren!

5. **Node.js Service**: Stelle sicher, dass der Service auf `dev.gout-diary.com` erreichbar ist

## Troubleshooting:

**Zertifikat kann nicht erstellt werden:**
- Prüfe DNS: `dig deine-domain.de`
- Prüfe ob Port 80 temporär erreichbar ist (für Let's Encrypt-Validierung)
- Verwende DNS-Validierung als Alternative

**Reverse Proxy funktioniert nicht:**
- Prüfe ob Node.js Service auf Port 3001 läuft: `netstat -tuln | grep 3001`
- Prüfe Synology Logs: **Systemsteuerung** → **Info-Center** → **Protokoll**
- Teste Zugriff: `curl https://dev.gout-diary.com/health`

**SSL-Fehler:**
- Prüfe ob das Zertifikat in DSM aktiv ist
- Prüfe ob das richtige Zertifikat im Reverse Proxy ausgewählt ist
- Prüfe Zertifikatsablaufdatum in DSM

## Synology-spezifische Tipps:

- **Control Panel** → **Application Portal** → **Reverse Proxy** für Konfiguration
- **Control Panel** → **Security** → **Certificate** für Zertifikatsverwaltung
- Synology erneuert Let's Encrypt-Zertifikate automatisch (keine manuelle Konfiguration nötig)
- Reverse Proxy unterstützt automatisches HTTP→HTTPS Redirect

