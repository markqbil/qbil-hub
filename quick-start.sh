#!/bin/bash

# =============================================
# Qbil Hub - Quick Start Script (macOS/Linux)
# =============================================

set -e  # Exit on error

echo "========================================"
echo "  Qbil Hub - Quick Start Setup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is niet geïnstalleerd!${NC}"
    echo "Installeer Node.js 18+ van https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node --version) gevonden"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is niet geïnstalleerd!${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} npm $(npm --version) gevonden"
echo ""

# Step 1: Install dependencies
echo "Stap 1/5: Dependencies installeren..."
echo "----------------------------------------"
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Dependencies geïnstalleerd"
else
    echo -e "${RED}❌${NC} Fout bij installeren dependencies"
    exit 1
fi
echo ""

# Step 2: Create .env file if it doesn't exist
echo "Stap 2/5: Environment configuratie..."
echo "----------------------------------------"
if [ ! -f .env ]; then
    echo "Geen .env bestand gevonden. Aanmaken..."
    cat > .env << 'EOF'
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=ontwikkel-geheim-verander-dit-in-productie-gebruik-minimaal-32-karakters
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Database
DB_PATH=./qbil_hub.db

# File Uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
LOGS_DIR=logs

# Cleanup
DOCUMENT_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=180
TIMEZONE=Europe/Amsterdam
EOF
    echo -e "${GREEN}✓${NC} .env bestand aangemaakt"
else
    echo -e "${YELLOW}⚠${NC} .env bestand bestaat al, overslaan..."
fi
echo ""

# Step 3: Setup database
echo "Stap 3/5: Database initialiseren..."
echo "----------------------------------------"
npm run migrate
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Database migraties voltooid"
else
    echo -e "${RED}❌${NC} Fout bij database migraties"
    exit 1
fi
echo ""

# Step 4: Seed demo data
echo "Stap 4/5: Demo data toevoegen..."
echo "----------------------------------------"
npm run seed
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Demo data toegevoegd"
else
    echo -e "${RED}❌${NC} Fout bij toevoegen demo data"
    exit 1
fi
echo ""

# Step 5: All done
echo "========================================"
echo -e "${GREEN}✓ Setup succesvol voltooid!${NC}"
echo "========================================"
echo ""
echo "📝 Demo Login Credentials:"
echo "   Email:    admin@companya.com"
echo "   Password: admin123"
echo ""
echo "🚀 Start de server met:"
echo "   npm run dev"
echo ""
echo "🌐 Open daarna in je browser:"
echo "   http://localhost:3000/login.html"
echo ""
echo "📖 Voor meer informatie, zie SETUP.md"
echo ""

# Ask if user wants to start the server now
read -p "Wil je de server nu starten? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Server starten..."
    echo "Druk op CTRL+C om te stoppen"
    echo ""
    sleep 2
    npm run dev
fi

