# Debugging .env Datei Probleme

## Häufige Probleme und Lösungen

### 1. .env Datei am falschen Ort

Die `.env` Datei muss im **Root-Verzeichnis des Service-Projekts** liegen, nicht im `src/` Verzeichnis.

**Korrekte Struktur:**
```
/volume1/nodejs/UricAcidService/
├── .env                    ← HIER!
├── package.json
├── src/
│   ├── app.js
│   └── ...
└── data/
```

### 2. Falsche Formatierung in .env

**FALSCH:**
```env
GOOGLE_CLIENT_ID = "123456.apps.googleusercontent.com"  ← Keine Leerzeichen, keine Anführungszeichen!
GOOGLE_CLIENT_SECRET = "geheim"
```

**RICHTIG:**
```env
GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=geheim
```

### 3. Leerzeichen am Ende

**FALSCH:**
```env
GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com 
GOOGLE_CLIENT_SECRET=geheim 
```

**RICHTIG:**
```env
GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=geheim
```

### 4. Prüfen ob .env geladen wird

Füge temporär in `src/app.js` nach `dotenv.config()` hinzu:

```javascript
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
```

### 5. Service neu starten

Nach Änderungen an der `.env` Datei **muss** der Service neu gestartet werden:

```bash
pm2 restart UricAcidService
# oder
pkill -f "node src/app.js"
node src/app.js
```

### 6. Prüfe .env Datei-Inhalt

```bash
cd /volume1/nodejs/UricAcidService
cat .env | grep GOOGLE
```

Sollte zeigen:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
```

### 7. Prüfe ob Datei existiert

```bash
cd /volume1/nodejs/UricAcidService
ls -la .env
```

### 8. Beispiel .env Datei

```env
PORT=3001
NODE_ENV=production
SESSION_SECRET=dein-session-secret-hier
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_CALLBACK_URL=http://192.68.4.59:3001/auth/google/callback
ALLOWED_ORIGINS=http://192.68.4.59:3001
DB_PATH=./data/harnsaeure.db
```

## Debug-Befehle

```bash
# Zeige alle Umgebungsvariablen (Vorsicht: zeigt auch Secrets!)
cd /volume1/nodejs/UricAcidService
node -e "require('dotenv').config(); console.log('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');"
```










