# Synology SSL-Zertifikat mit Reverse Proxy verknüpfen

## Problem: Zertifikat-Option fehlt im Reverse Proxy

Falls die Zertifikat-Option im Reverse Proxy nicht sichtbar ist, gibt es mehrere Lösungen:

## Lösung 1: Zertifikat direkt im Zertifikat-Menü dem Port zuweisen (Empfohlen)

1. Gehe zu **Systemsteuerung** → **Sicherheit** → **Zertifikat**
2. Wähle das erstellte Let's Encrypt-Zertifikat aus
3. Klicke auf **Bearbeiten** oder **Konfigurieren**
4. In den Zertifikat-Einstellungen findest du die Option **"Port"** oder **"Gilt für Port"**
5. Wähle den Port aus, den du für den Reverse Proxy verwenden möchtest (z.B. 443 oder 8443)
6. Klicke auf **Übernehmen**
7. Das Zertifikat wird nun automatisch für diesen Port verwendet

**Vorteil:** Diese Methode funktioniert unabhängig von der DSM-Version und ist die einfachste Lösung!

## Lösung 2: Zertifikat-Pfad finden und manuell konfigurieren

### Schritt 1: Zertifikat-Pfad finden

```bash
ssh adm_ssh@192.68.4.59

# Finde alle Zertifikate
sudo find /usr/syno/etc/certificate -name "fullchain.pem" -type f
sudo find /usr/syno/etc/certificate -name "privkey.pem" -type f

# Oder liste alle Zertifikate auf
sudo ls -la /usr/syno/etc/certificate/
```

Typische Pfade:
- Standard-Zertifikat: `/usr/syno/etc/certificate/system/default/`
- Reverse Proxy: `/usr/syno/etc/certificate/ReverseProxy/[name]/`
- Let's Encrypt: `/usr/syno/etc/certificate/_archive/[hash]/`

### Schritt 2: Nginx-Konfiguration direkt bearbeiten

Synology verwendet Nginx für den Reverse Proxy. Die Konfiguration liegt normalerweise in:
- `/etc/nginx/nginx.conf`
- `/etc/nginx/sites-enabled/` oder `/etc/nginx/conf.d/`

**WICHTIG:** Synology überschreibt Nginx-Konfigurationen bei Updates. Verwende stattdessen die Synology-Konfigurationsdateien:

```bash
# Synology Reverse Proxy Konfiguration
sudo nano /usr/syno/etc/nginx/sites-enabled/[deine-reverse-proxy-regel]
```

Oder bearbeite die Hauptkonfiguration:
```bash
sudo nano /etc/nginx/nginx.conf
```

Füge SSL-Konfiguration hinzu:
```nginx
server {
    listen 443 ssl;
    server_name deine-domain.de;
    
    ssl_certificate /usr/syno/etc/certificate/system/default/fullchain.pem;
    ssl_certificate_key /usr/syno/etc/certificate/system/default/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Lösung 3: DSM-Version prüfen und aktualisieren

Ältere DSM-Versionen haben möglicherweise nicht die Zertifikat-Option im Reverse Proxy:

1. Prüfe DSM-Version: **Systemsteuerung** → **Info-Center**
2. Falls veraltet, aktualisiere DSM
3. Nach Update sollte die Zertifikat-Option verfügbar sein

## Lösung 4: Zertifikat über Control Panel → Application Portal zuweisen

1. Gehe zu **Systemsteuerung** → **Anmeldungsportal**
2. Klicke auf **Erweitert**
3. Unter **"Anwendungsportal"** oder **"Standard-Zertifikat"** wähle das Let's Encrypt-Zertifikat
4. Dies wird für alle Reverse Proxy Regeln verwendet

## Lösung 5: Reverse Proxy über Web Station (falls installiert)

Falls Web Station installiert ist:

1. Öffne **Web Station**
2. Gehe zu **Virtual Host** → **Erstellen**
3. Wähle **Reverse Proxy**
4. Hier sollte die Zertifikat-Option verfügbar sein

## Lösung 6: Manuelles SSL über Docker (falls Node.js in Docker läuft)

Falls der Node.js Service in Docker läuft, kannst du SSL direkt im Container konfigurieren oder einen separaten Nginx-Container verwenden.

## Prüfung: Welche DSM-Version verwendest du?

Führe aus:
```bash
ssh adm_ssh@192.68.4.59
cat /etc.defaults/VERSION
```

Oder in DSM: **Systemsteuerung** → **Info-Center** → **DSM-Version**

## Empfohlene Vorgehensweise:

1. **Prüfe DSM-Version** - sollte DSM 7.0 oder neuer sein
2. **Prüfe ob Zertifikat erstellt wurde** - in **Systemsteuerung** → **Sicherheit** → **Zertifikat**
3. **Versuche Application Portal** - dort Zertifikat zuweisen
4. **Falls nichts funktioniert** - verwende manuelle Nginx-Konfiguration (siehe Lösung 2)

