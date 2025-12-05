# SSL-Zertifikat-Warnung beheben

## Problem

Browser zeigt Warnung: "Diese Website verfügt über ein gültiges Zertifikat... Einige Teile der Website sind jedoch nicht sicher."

Dies deutet auf **Mixed Content** hin - HTTPS-Seite lädt HTTP-Ressourcen.

## Lösung implementiert

### 1. Content Security Policy (CSP) hinzugefügt

Die CSP wurde in `src/app.js` hinzugefügt:
- Verhindert das Laden von HTTP-Ressourcen auf HTTPS-Seiten
- Erlaubt nur HTTPS-Ressourcen
- Upgrade-Insecure-Requests aktiviert (automatisches HTTP→HTTPS Upgrade)

### 2. Weitere Schritte

#### A. Reverse Proxy Konfiguration prüfen (Synology)

Stellen Sie sicher, dass:
1. **HTTPS aktiviert** ist
2. **HTTP zu HTTPS Redirect** aktiviert ist
3. **Alle Backend-Verbindungen** über HTTPS laufen

#### B. Browser-Konsole prüfen

1. Öffnen Sie die Website: `https://dev.gout-diary.com:3001`
2. Öffnen Sie Browser-Entwicklertools (F12)
3. Prüfen Sie:
   - **Console Tab**: Gibt es Mixed Content Warnungen?
   - **Network Tab**: Welche Ressourcen werden über HTTP geladen?
   - **Security Tab**: Gibt es Zertifikatprobleme?

#### C. Service neu starten

Nach den Änderungen muss der Service neu gestartet werden:

```bash
cd /volume1/nodejs/goutdiary
pm2 restart GoutDiaryService
```

## Ursachen für Mixed Content

Mögliche Ursachen:
1. **Externe Ressourcen über HTTP** (aber alle sind bereits HTTPS)
2. **API-Calls über HTTP** (aber verwenden relative URLs)
3. **Bilder über HTTP** (sollten über HTTPS sein)
4. **Reverse Proxy mischt HTTP/HTTPS** (häufigste Ursache)

## Zusätzliche Sicherheitsverbesserungen

### HTTP to HTTPS Redirect

Wenn Sie einen Reverse Proxy verwenden, aktivieren Sie dort:
- **HTTP zu HTTPS Redirect**
- **HSTS (HTTP Strict Transport Security)**

### Zertifikat prüfen

Stellen Sie sicher, dass:
- Das SSL-Zertifikat gültig ist
- Das Zertifikat für die richtige Domain ausgestellt wurde
- Der Chain ist vollständig

## Testen

1. **Service neu starten** (siehe oben)
2. **Website im Browser öffnen**
3. **Browser-Konsole prüfen** (F12)
4. **Sicherheitsprüfung**:
   - Keine Mixed Content Warnungen
   - Alle Ressourcen über HTTPS
   - Grünes Schloss-Symbol im Browser

## Troubleshooting

### Problem: Warnung bleibt bestehen

1. **Browser-Cache leeren**: Ctrl+Shift+Delete
2. **Hard Reload**: Ctrl+Shift+R
3. **Inkognito-Modus testen**: Um Cache zu umgehen
4. **Browser-Konsole prüfen**: Welche Ressource wird über HTTP geladen?

### Problem: Website lädt nicht mehr

1. **CSP zu restriktiv**: Prüfen Sie Browser-Konsole auf CSP-Fehler
2. **Service läuft nicht**: Prüfen Sie `pm2 status`
3. **Port falsch**: Prüfen Sie Reverse Proxy Konfiguration

## Weitere Hilfe

Wenn das Problem weiterhin besteht:
1. Screenshot der Browser-Konsole (F12 → Console Tab)
2. Screenshot der Network-Tab (F12 → Network Tab → Filter: "Mixed")
3. Service-Logs: `pm2 logs GoutDiaryService`
