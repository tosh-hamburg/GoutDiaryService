# Benutzer zum Super-Admin machen

## Option 1: Über gcloud CLI (Empfohlen)

### Schritt 1: Service-Name und Region finden
```bash
gcloud run services list
```

### Schritt 2: In den Container einloggen (falls möglich)
```bash
gcloud run services proxy gichttagebuchservice --region europe-west1 --port 8080
```

**Hinweis:** Cloud Run Container sind stateless und ephemeral. Direkter Zugriff auf den Container ist normalerweise nicht möglich.

## Option 2: Skript lokal ausführen (wenn Datenbank lokal zugänglich)

Falls du die Datenbank lokal hast oder über einen Volume zugreifen kannst:

```bash
cd /path/to/service
node scripts/makeUserAdmin.js dunker.thorsten@gmail.com
```

oder für den ersten User:

```bash
node scripts/makeUserAdmin.js --all-first
```

## Option 3: Über Cloud Run Job (Empfohlen für Cloud Run)

### Schritt 1: Cloud Run Job erstellen

Erstelle eine Datei `job.js`:

```javascript
const { getDatabase } = require('./src/database');
const User = require('./src/models/User');

async function main() {
  const db = getDatabase();
  const user = User.findByEmail('dunker.thorsten@gmail.com');
  
  if (user) {
    const updateStmt = db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
    updateStmt.run(user.id);
    console.log('User wurde zum Admin gemacht');
  }
}

main();
```

### Schritt 2: Job deployen und ausführen
```bash
gcloud run jobs create make-user-admin \
  --source . \
  --region europe-west1 \
  --command node \
  --args job.js
```

## Option 4: Temporäres Endpoint hinzufügen (Schnellste Lösung)

Füge einen temporären Admin-Endpoint hinzu, der nur einmal verwendet werden sollte:

1. Endpoint in `src/routes/api.js` hinzufügen:
```javascript
router.post('/admin/make-admin', (req, res) => {
  // Nur wenn aktueller User Admin ist ODER wenn noch kein Admin existiert
  const db = require('../database').getDatabase();
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get().count;
  
  if (adminCount === 0 || (req.user && req.user.isAdmin)) {
    const { email } = req.body;
    const user = User.findByEmail(email);
    if (user) {
      const updateStmt = db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
      updateStmt.run(user.id);
      res.json({ success: true, message: 'User wurde zum Admin gemacht' });
    } else {
      res.status(404).json({ success: false, error: 'User nicht gefunden' });
    }
  } else {
    res.status(403).json({ success: false, error: 'Nicht autorisiert' });
  }
});
```

2. Service deployen
3. Endpoint aufrufen:
```bash
curl -X POST https://gichttagebuchservice-936354735458.europe-west1.run.app/api/v1/admin/make-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"dunker.thorsten@gmail.com"}'
```

4. Endpoint wieder entfernen (Sicherheit!)

## Option 5: SQL direkt ausführen (wenn Datenbank-Datei zugänglich)

Falls du Zugriff auf die SQLite-Datei hast:

```sql
UPDATE users SET is_admin = 1 WHERE email = 'dunker.thorsten@gmail.com';
```

Die Datenbank-Datei befindet sich normalerweise in `/tmp` im Container (ephemeral) oder in einem Volume.

