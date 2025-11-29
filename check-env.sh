#!/bin/bash
# Script zum Prüfen der .env Konfiguration

cd /volume1/nodejs/UricAcidService || exit 1

echo "=== Prüfe .env Konfiguration ==="
echo ""

if [ ! -f .env ]; then
    echo "❌ FEHLER: .env Datei nicht gefunden!"
    echo ""
    echo "Erstelle .env Datei mit folgendem Inhalt:"
    echo ""
    cat << 'EOF'
PORT=3001
NODE_ENV=development

# OpenAI API (für LLM-Analyse)
OPENAI_API_KEY=sk-your-api-key-here
LLM_MODEL=gpt-4-turbo-preview

# Database (SQLite - wird automatisch erstellt)
DB_PATH=./data/harnsaeure.db

# CORS
ALLOWED_ORIGINS=http://localhost:3000
EOF
    echo ""
    echo "Bitte erstelle die Datei mit: nano .env"
    exit 1
else
    echo "✓ .env Datei gefunden"
    echo ""
    echo "Aktuelle Konfiguration:"
    echo "----------------------"
    
    # Zeige Konfiguration (ohne API-Key vollständig anzuzeigen)
    while IFS= read -r line; do
        if [[ $line == *"OPENAI_API_KEY"* ]]; then
            key=$(echo "$line" | cut -d'=' -f1)
            value=$(echo "$line" | cut -d'=' -f2)
            if [ ${#value} -gt 10 ]; then
                echo "${key}=${value:0:10}...${value: -4}"
            else
                echo "$line"
            fi
        else
            echo "$line"
        fi
    done < .env
    
    echo ""
    echo "----------------------"
    
    # Prüfe ob API-Key gesetzt ist
    if grep -q "OPENAI_API_KEY=sk-" .env && ! grep -q "OPENAI_API_KEY=sk-your-api-key-here" .env; then
        echo "✓ OPENAI_API_KEY ist gesetzt"
    else
        echo "❌ WARNUNG: OPENAI_API_KEY ist nicht korrekt gesetzt!"
        echo "   Bitte trage deinen echten OpenAI API-Key in die .env Datei ein."
    fi
fi

echo ""
echo "=== Teste Umgebungsvariablen ==="
# Lade .env und teste
export $(grep -v '^#' .env | xargs)
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-api-key-here" ]; then
    echo "❌ OPENAI_API_KEY ist nicht gesetzt oder hat Platzhalter-Wert"
    exit 1
else
    echo "✓ OPENAI_API_KEY ist gesetzt (Länge: ${#OPENAI_API_KEY} Zeichen)"
fi


