# Verwende offizielles Node.js 20 Image
FROM node:20-alpine

# Setze Arbeitsverzeichnis
WORKDIR /usr/src/app

# Kopiere package.json und package-lock.json
COPY package*.json ./

# Installiere Dependencies
RUN npm ci --only=production

# Kopiere Anwendungscode
COPY . .

# Erstelle Verzeichnisse für Daten
RUN mkdir -p /usr/src/app/data/photos /usr/src/app/data/thumbnails

# Exponiere Port
EXPOSE 3001

# Gesundheitscheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Starte Anwendung
CMD ["npm", "start"]
