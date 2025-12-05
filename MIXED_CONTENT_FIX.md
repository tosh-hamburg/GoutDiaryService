# Mixed Content Warnung beheben

## Problem

Die Browser-Warnung "Einige Teile der Website sind jedoch nicht sicher" deutet auf **Mixed Content** hin - eine HTTPS-Seite lädt HTTP-Ressourcen.

## Lösung

### 1. Content Security Policy (CSP) Header hinzufügen

Fügen Sie in `src/app.js` nach den CORS-Middleware-Zeilen einen CSP-Header hinzu, der Mixed Content verhindert:

```javascript
// Nach app.use(cors(...)) hinzufügen:

// Content Security Policy - Verhindert Mixed Content
app.use((req, res, next) => {
  // Nur HTTPS-Ressourcen erlauben
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https:; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none';"
  );
  
  // Verhindere Mixed Content explizit
  res.setHeader('Upgrade-Insecure-Requests', '1');
  
  next();
});
```

### 2. HTTP to HTTPS Redirect

Fügen Sie einen Redirect von HTTP zu HTTPS hinzu (wenn Sie einen Reverse Proxy verwenden):

```javascript
// Vor allen anderen Middleware
app.use((req, res, next) => {
  // Wenn über HTTP aufgerufen, aber HTTPS erwartet wird
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

### 3. Prüfen Sie alle externen Ressourcen

Stellen Sie sicher, dass alle externen Ressourcen über HTTPS geladen werden:

- ✅ Google Fonts: `https://fonts.googleapis.com` (bereits HTTPS)
- ✅ CDN: `https://cdn.jsdelivr.net` (bereits HTTPS)
- ✅ API-Calls: Relative URLs `/api/v1` (gut, verwendet das gleiche Protokoll)

### 4. Prüfen Sie die Reverse Proxy Konfiguration

Stellen Sie sicher, dass der Reverse Proxy (Synology) korrekt konfiguriert ist:

- **HTTPS** muss aktiviert sein
- **HTTP to HTTPS Redirect** sollte aktiviert sein
- Alle Backend-Verbindungen sollten über `https://` laufen

### 5. Prüfen Sie Browser-Konsole

Öffnen Sie die Browser-Entwicklertools (F12) und prüfen Sie:

1. **Console** Tab - gibt es Mixed Content Warnungen?
2. **Network** Tab - welche Ressourcen werden über HTTP geladen?
3. **Security** Tab - gibt es Zertifikatprobleme?

### 6. Sicherheitsprüfung

Führen Sie eine Sicherheitsprüfung durch:

- Öffnen Sie: `https://dev.gout-diary.com:3001`
- Prüfen Sie die Browser-Entwicklertools auf Mixed Content Warnungen
- Prüfen Sie, ob alle Ressourcen über HTTPS geladen werden

## Implementierung

Die Änderungen müssen in `src/app.js` vorgenommen werden. Siehe die Code-Beispiele oben.

## Weitere Hilfe

Wenn das Problem weiterhin besteht:

1. Prüfen Sie die Browser-Konsole auf spezifische Mixed Content Warnungen
2. Prüfen Sie die Network-Tab, welche Ressourcen HTTP verwenden
3. Prüfen Sie die Reverse Proxy Konfiguration (Synology)
4. Prüfen Sie, ob es HTTP-Links in den HTML-Dateien gibt
