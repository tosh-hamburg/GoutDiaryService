# API Dokumentation

## Base URL
```
http://192.168.4.59:3001
```

## Verfügbare Endpunkte

### 1. Root / Info
```
GET /
```
Zeigt alle verfügbaren Endpunkte an.

### 2. Health Check
```
GET /health
```
Prüft ob der Service läuft.

**Response:**
```json
{
  "status": "ok",
  "service": "harnsaeure-feasibility",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 123.45
}
```

### 3. Harnsäurewerte

#### Neuen Wert hinzufügen
```
POST /api/v1/uric-acid-values
Content-Type: application/json

{
  "userId": "user-123",
  "timestamp": "2024-01-15T10:00:00Z",
  "value": 6.5,
  "normal": false,
  "muchMeat": true,
  "muchSport": false,
  "muchSugar": false,
  "muchAlcohol": false,
  "fasten": false,
  "goutAttack": false,
  "notes": "Optional notes"
}
```

#### Alle Werte abrufen
```
GET /api/v1/uric-acid-values?userId=user-123&startDate=2024-01-01&endDate=2024-01-31&limit=100&offset=0
```

#### Statistiken abrufen
```
GET /api/v1/uric-acid-values/stats?userId=user-123&days=30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 25,
    "average": 6.2,
    "min": 4.5,
    "max": 8.1,
    "goutAttacks": 2
  }
}
```

### 4. Mahlzeiten

#### Neue Mahlzeit hinzufügen
```
POST /api/v1/meals
Content-Type: application/json

{
  "userId": "user-123",
  "timestamp": "2024-01-15T12:00:00Z",
  "mealType": "LUNCH",
  "name": "Gegrilltes Hähnchen",
  "totalPurin": 150,
  "totalUricAcid": 360,
  "totalCalories": 450,
  "totalProtein": 35.5,
  "photo": "data:image/jpeg;base64,..." (optional)
}
```

#### Alle Mahlzeiten abrufen
```
GET /api/v1/meals?userId=user-123&startDate=2024-01-01&endDate=2024-01-31
```

#### Ernährungsstatistiken
```
GET /api/v1/meals/stats?userId=user-123&days=30
```

### 5. Analyse

#### Analyse durchführen
```
POST /api/v1/analysis
Content-Type: application/json

{
  "userId": "user-123",
  "days": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_user-123_1234567890",
    "insights": {
      "dietary_factors": ["Fleischkonsum", "Alkohol"],
      "lifestyle_factors": ["Bewegungsmangel"],
      "correlations": [...],
      "patterns": [...]
    },
    "recommendations": {
      "dietary": [...],
      "lifestyle": [...],
      "immediate": [...]
    },
    "summary": "...",
    "confidenceScore": 0.8,
    "analysisDate": "2024-01-15T10:00:00.000Z"
  }
}
```

#### Letzte Analyse abrufen
```
GET /api/v1/analysis/latest?userId=user-123
```

## Beispiel-Aufrufe

### Mit curl

```bash
# Health Check
curl http://192.168.4.59:3001/health

# Harnsäurewert hinzufügen
curl -X POST http://192.168.4.59:3001/api/v1/uric-acid-values \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "value": 6.5,
    "muchMeat": true
  }'

# Werte abrufen
curl "http://192.168.4.59:3001/api/v1/uric-acid-values?userId=test-user"

# Analyse durchführen
curl -X POST http://192.168.4.59:3001/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "days": 30
  }'
```

### Mit JavaScript/Fetch

```javascript
// Health Check
fetch('http://192.168.4.59:3001/health')
  .then(res => res.json())
  .then(data => console.log(data));

// Harnsäurewert hinzufügen
fetch('http://192.168.4.59:3001/api/v1/uric-acid-values', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'test-user',
    value: 6.5,
    muchMeat: true,
    goutAttack: false
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Fehlerbehandlung

Alle Fehler werden im folgenden Format zurückgegeben:

```json
{
  "error": "Fehlermeldung",
  "stack": "..." // Nur im Development-Modus
}
```

HTTP Status Codes:
- `200` - Erfolg
- `201` - Erfolgreich erstellt
- `400` - Ungültige Anfrage
- `404` - Route nicht gefunden
- `500` - Server-Fehler


