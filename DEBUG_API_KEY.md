# API-Key Debugging im Docker-Container

## Skript im Container ausführen

Der Service läuft im Docker-Container `gout_node_app`. Um das Debug-Skript auszuführen, müssen Sie es im Container starten:

```bash
# Skript im Container ausführen
docker exec -it gout_node_app node debug-api-key.js <API_KEY>

# Beispiel:
docker exec -it gout_node_app node debug-api-key.js hst_ca15e942af879cd4e74d9298ac5ce852
```

## Alternative: Interaktive Shell im Container

Falls Sie mehrere Befehle ausführen möchten:

```bash
# Öffne eine interaktive Shell im Container
docker exec -it gout_node_app sh

# Dann können Sie Befehle ausführen:
cd /usr/src/app
node debug-api-key.js <API_KEY>
```

## Test-Skript im Container ausführen

Um das Test-Skript (`test-service.js`) auszuführen:

```bash
docker exec -it gout_node_app node test-service.js <API_KEY> <USER_GUID> [BASE_URL]

# Beispiel:
docker exec -it gout_node_app node test-service.js hst_ca15e942af879cd4e74d9298ac5ce852 test-user-guid-123 http://localhost:3001
```

## Container-Status prüfen

```bash
# Zeige laufende Container
docker ps

# Zeige Logs des App-Containers
docker logs gout_node_app

# Zeige Logs in Echtzeit
docker logs -f gout_node_app
```

## Wichtige Hinweise

1. **Datenbankverbindung**: Der Container verwendet PostgreSQL (nicht SQLite)
2. **Umgebungsvariablen**: Werden aus `docker-compose.yml` geladen
3. **Code-Änderungen**: Werden durch Volume-Mounting sofort übernommen (Development-Modus)

