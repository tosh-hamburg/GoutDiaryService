#!/bin/bash

# Gout Diary - Docker Start Script
# Verwendung: ./docker-start.sh [build|start|stop|restart|logs|status]

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktionen
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Prüfe ob docker-compose verfügbar ist
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose ist nicht installiert"
    exit 1
fi

case "$1" in
    build)
        print_info "Baue Docker Image..."
        docker-compose build app
        print_success "Image erfolgreich gebaut"
        ;;

    start)
        print_info "Starte Container..."
        docker-compose up -d
        print_success "Container gestartet"

        print_info "Warte auf Health-Check..."
        sleep 5

        # Prüfe Status
        if docker-compose ps | grep -q "Up (healthy)"; then
            print_success "Alle Container sind gesund"
        else
            print_error "Einige Container sind nicht gesund"
            docker-compose ps
        fi
        ;;

    stop)
        print_info "Stoppe Container..."
        docker-compose down
        print_success "Container gestoppt"
        ;;

    restart)
        print_info "Starte Container neu..."
        docker-compose restart app
        print_success "Container neu gestartet"

        print_info "Warte auf Health-Check..."
        sleep 5
        docker-compose ps
        ;;

    logs)
        print_info "Zeige Logs (Ctrl+C zum Beenden)..."
        docker-compose logs -f app
        ;;

    status)
        print_info "Container Status:"
        docker-compose ps

        echo ""
        print_info "Health-Check:"
        curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null || echo "Service nicht erreichbar"
        ;;

    rebuild)
        print_info "Baue Image neu und starte Container..."
        docker-compose down
        docker-compose build app
        docker-compose up -d
        print_success "Rebuild abgeschlossen"

        print_info "Warte auf Health-Check..."
        sleep 5
        docker-compose ps
        ;;

    clean)
        print_info "Entferne alte Container und Images..."
        docker-compose down -v
        docker image prune -f
        print_success "Cleanup abgeschlossen"
        ;;

    backup)
        print_info "Erstelle Backup..."
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_DIR="./backups/$TIMESTAMP"
        mkdir -p "$BACKUP_DIR"

        # PostgreSQL Backup
        print_info "Erstelle PostgreSQL Backup..."
        docker exec gout_db_container pg_dump -U goutservice goutdiary > "$BACKUP_DIR/database.sql"

        # App-Daten Backup (falls lokal)
        if [ -d "./data" ]; then
            print_info "Erstelle Daten-Backup..."
            cp -r ./data "$BACKUP_DIR/"
        fi

        print_success "Backup erstellt in $BACKUP_DIR"
        ;;

    *)
        echo "Gout Diary - Docker Management"
        echo ""
        echo "Verwendung: $0 [BEFEHL]"
        echo ""
        echo "Befehle:"
        echo "  build      - Baut das Docker Image"
        echo "  start      - Startet alle Container"
        echo "  stop       - Stoppt alle Container"
        echo "  restart    - Startet App-Container neu"
        echo "  logs       - Zeigt App-Logs"
        echo "  status     - Zeigt Container-Status"
        echo "  rebuild    - Baut Image neu und startet Container"
        echo "  clean      - Entfernt alte Container und Images"
        echo "  backup     - Erstellt Backup von DB und Daten"
        echo ""
        echo "Beispiele:"
        echo "  $0 build       # Image bauen"
        echo "  $0 start       # Container starten"
        echo "  $0 logs        # Logs anzeigen"
        exit 1
        ;;
esac

exit 0
