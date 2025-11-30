#!/bin/bash
# Dependencies Installation Script
# Führe dieses Skript auf dem Server aus: bash install_dependencies.sh

cd /volume1/nodejs/UricAcidService

echo "Installiere Dependencies..."
npm install express-session passport passport-google-oauth20

echo "Installation abgeschlossen!"


