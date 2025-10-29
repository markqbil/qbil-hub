# Qbil Hub - Complete Setup Guide

Deze guide helpt je om Qbil Hub volledig werkend te krijgen op je lokale machine of server.

## 🚨 Veelvoorkomende Problemen en Oplossingen

### Probleem: "Ik zie alleen een statische pagina"
**Oorzaak**: Database niet geïnitialiseerd of geen `.env` bestand.
**Oplossing**: Volg de stappen hieronder vanaf het begin.

### Probleem: "GitHub CI faalt"
**Oorzaak**: Ontbrekende linter configuratie (nu opgelost).
**Oplossing**: De CI workflow is bijgewerkt en controleert nu of een linter aanwezig is.

### Probleem: "Authentication werkt niet"
**Oorzaak**: Scripts laden in verkeerde volgorde of geen database.
**Oplossing**: Index.html is nu bijgewerkt met de juiste script volgorde.

---

## 📋 Vereisten

Voordat je begint, zorg dat je het volgende hebt geïnstalleerd:

- **Node.js** 18.x of hoger
- **npm** (komt mee met Node.js)
- **Git** (optioneel, voor version control)

Controleer je versies:
```bash
node --version  # Moet >= 18.0.0 zijn
npm --version   # Moet >= 9.0.0 zijn
```

---

## 🔧 Installatie Stappen

### Stap 1: Clone of Download het Project

```bash
git clone <repository-url>
cd qbil-hub
```

### Stap 2: Installeer Dependencies

```bash
npm install
```

Als je een `package-lock.json` warning krijgt, negeer deze. Als je een error krijgt, probeer:
```bash
npm install --legacy-peer-deps
```

### Stap 3: Maak .env Bestand

Maak een `.env` bestand in de root directory met de volgende inhoud:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS (belangrijk voor lokale development)
CORS_ORIGIN=http://localhost:3000

# JWT Secret (verander dit in productie!)
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
```

**💡 TIP**: Kopieer de bovenstaande content exact. De JWT_SECRET mag voor development deze waarde hebben.

### Stap 4: Database Setup

**BELANGRIJK**: Dit is waar de meeste problemen ontstaan!

```bash
# Maak de database en tabellen aan
npm run migrate

# Voeg demo data toe (inclusief admin gebruiker)
npm run seed
```

Je zou de volgende output moeten zien:
```
✅ Database migrations completed successfully
✅ Demo data seeded successfully
```

Als je een foutmelding krijgt:
- Controleer of het bestand `src/scripts/migrate.js` bestaat
- Controleer of je schrijfrechten hebt in de directory
- Verwijder `qbil_hub.db` als het bestaat en probeer opnieuw

### Stap 5: Start de Applicatie

```bash
# Voor development (met auto-reload)
npm run dev

# Of voor productie
npm start
```

Je zou moeten zien:
```
🚀 Qbil Hub server running on port 3000
📅 Started at: 2024-01-01T12:00:00.000Z
Environment: development
```

### Stap 6: Open de Applicatie

Open je browser en ga naar: **http://localhost:3000/login.html**

**BELANGRIJK**: Ga naar `/login.html`, NIET naar `/` - anders zie je een redirect.

### Stap 7: Login met Demo Account

Gebruik de volgende credentials:
```
Email:    admin@companya.com
Password: admin123
```

Na succesvolle login word je automatisch doorgestuurd naar het dashboard.

---

## ✅ Verificatie Checklist

Loop deze checklist af om te verifiëren dat alles werkt:

- [ ] Server start zonder errors
- [ ] Je wordt naar `/login.html` gestuurd als je naar `/` gaat zonder login
- [ ] Je kunt inloggen met de demo credentials
- [ ] Na login zie je het dashboard met statistieken (kunnen 0 zijn)
- [ ] Je kunt navigeren tussen de verschillende pagina's
- [ ] Console toont geen JavaScript errors

---

## 🧪 Testing

Run de tests om te verifiëren dat alles correct werkt:

```bash
# Run alle tests
npm test

# Run tests met coverage
npm run test:coverage
```

Alle tests zouden moeten slagen.

---

## 🐛 Troubleshooting

### "Cannot find module" errors

**Oplossing**:
```bash
# Verwijder node_modules en installeer opnieuw
rm -rf node_modules package-lock.json
npm install
```

### "Database locked" errors

**Oplossing**:
```bash
# Stop alle Node processen
# Windows:
taskkill /F /IM node.exe

# macOS/Linux:
killall node

# Verwijder database en maak opnieuw aan
rm qbil_hub.db
npm run migrate
npm run seed
```

### "Port 3000 is already in use"

**Oplossing 1** - Gebruik een andere poort:
```bash
# In je .env bestand
PORT=3001
```

**Oplossing 2** - Stop het proces dat poort 3000 gebruikt:
```bash
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
```

### "CORS error" in browser console

**Oplossing**: Controleer dat in je `.env` bestand:
```env
CORS_ORIGIN=http://localhost:3000
```

Als je een andere poort gebruikt, pas dit aan.

### "Token validation failed" bij login

**Oplossing**: Dit betekent dat de database geen gebruiker heeft.
```bash
# Run seed opnieuw
npm run seed
```

### Browser toont "Cannot GET /api/..."

**Oplossing**: De server draait niet. Start de server opnieuw:
```bash
npm run dev
```

---

## 🚀 Productie Deployment

### Belangrijke Wijzigingen voor Productie

1. **Verander JWT Secret**:
   ```bash
   # Genereer een veilige random string
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Kopieer de output naar je `.env`:
   ```env
   JWT_SECRET=<de-gegenereerde-string>
   ```

2. **Update NODE_ENV**:
   ```env
   NODE_ENV=production
   ```

3. **Configureer CORS**:
   ```env
   CORS_ORIGIN=https://jouw-domein.com,https://www.jouw-domein.com
   ```

4. **Email Configuration** (optioneel):
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=jouw-email@gmail.com
   SMTP_PASS=jouw-app-wachtwoord
   EMAIL_FROM=noreply@jouw-domein.com
   ```

### Start in Productie

```bash
# Installeer dependencies (production only)
npm ci --production

# Run migrations
npm run migrate

# Start server
npm start
```

### Met PM2 (Aanbevolen)

```bash
# Installeer PM2 globally
npm install -g pm2

# Start applicatie
pm2 start server.js --name qbil-hub

# Auto-start bij reboot
pm2 startup
pm2 save
```

---

## 📊 Monitoring en Logs

Logs worden opgeslagen in de `logs/` directory:

- `combined.log` - Alle logs
- `error.log` - Alleen errors
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

Bekijk logs:
```bash
# Laatste 100 regels van combined log
tail -n 100 logs/combined.log

# Real-time logs volgen
tail -f logs/combined.log

# Alleen errors
tail -f logs/error.log
```

---

## 🔒 Security Checklist voor Productie

- [ ] JWT_SECRET is gewijzigd naar een sterke random string
- [ ] NODE_ENV is ingesteld op "production"
- [ ] CORS_ORIGIN bevat alleen jouw domein(en)
- [ ] Database backups zijn geconfigureerd
- [ ] HTTPS is ingeschakeld
- [ ] Firewall regels zijn ingesteld
- [ ] Rate limiting is geconfigureerd
- [ ] Logging is geconfigureerd
- [ ] Geen demo accounts in productie database

---

## 📞 Support

Als je problemen blijft ondervinden na het volgen van deze guide:

1. Controleer de logs in `logs/` directory
2. Controleer de browser console voor JavaScript errors
3. Controleer de network tab in DevTools voor API errors
4. Maak een GitHub issue met:
   - Je Node.js versie
   - Je OS (Windows/macOS/Linux)
   - Exacte error messages
   - Stappen om het probleem te reproduceren

---

## 🎯 Quick Start Script (Windows)

Maak een bestand `quick-start.bat`:
```batch
@echo off
echo Qbil Hub Quick Start
echo.

echo Stap 1: Installing dependencies...
call npm install
if errorlevel 1 goto error

echo.
echo Stap 2: Setting up database...
call npm run migrate
if errorlevel 1 goto error
call npm run seed
if errorlevel 1 goto error

echo.
echo Stap 3: Starting server...
call npm run dev

:error
echo.
echo Er is een fout opgetreden. Controleer de output hierboven.
pause
```

## 🎯 Quick Start Script (macOS/Linux)

Maak een bestand `quick-start.sh`:
```bash
#!/bin/bash
echo "Qbil Hub Quick Start"
echo ""

echo "Stap 1: Installing dependencies..."
npm install || exit 1

echo ""
echo "Stap 2: Setting up database..."
npm run migrate || exit 1
npm run seed || exit 1

echo ""
echo "Stap 3: Starting server..."
npm run dev
```

Maak het uitvoerbaar:
```bash
chmod +x quick-start.sh
./quick-start.sh
```

---

## 📚 Volgende Stappen

Na succesvolle setup, lees:

1. **README.md** - API documentatie en features
2. **CONTRIBUTING.md** - Bijdragen aan het project
3. **SECURITY.md** - Security best practices
4. **PROJECT_STATUS.md** - Huidige status en roadmap

---

**🎉 Gefeliciteerd! Je hebt Qbil Hub succesvol geïnstalleerd.**

Als je nog steeds problemen hebt, volg dan de troubleshooting sectie hierboven of open een issue op GitHub.

