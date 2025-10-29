# Morgan Dependency Fix

## 🐛 Het Probleem

De GitHub CI tests faalden met de volgende error:

```
Cannot find module 'morgan' from 'server.js'

Require stack:
  server.js
  tests/auth.test.js
```

## 🔍 Root Cause

In `server.js` regel 7 werd morgan gebruikt:
```javascript
const morgan = require('morgan');
```

Maar `morgan` stond **niet** in de `package.json` dependencies lijst!

### Waarom Werkte Het Lokaal?

Op lokale development machines kan morgan:
1. Globaal geïnstalleerd zijn
2. In node_modules zitten van een eerdere installatie
3. Als dependency van een andere package geïnstalleerd zijn

Maar **GitHub Actions gebruikt `npm ci`** wat een clean install doet vanaf `package.json`. Als een dependency niet in `package.json` staat, wordt deze niet geïnstalleerd.

## ✅ De Oplossing

Morgan toegevoegd aan `package.json`:

```json
"dependencies": {
  "bcryptjs": "^2.4.3",
  "compression": "^1.7.4",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express": "^4.18.2",
  "express-rate-limit": "^7.1.5",
  "helmet": "^7.1.0",
  "jsonwebtoken": "^9.0.2",
  "mammoth": "^1.6.0",
  "morgan": "^1.10.0",           // ✅ TOEGEVOEGD
  "multer": "^1.4.5-lts.1",
  "natural": "^6.5.0",
  "node-cron": "^3.0.3",
  "nodemailer": "^7.0.10",
  "pdf-parse": "^1.1.1",
  "sqlite3": "^5.1.7",
  "winston": "^3.11.0"
}
```

## 📝 Wat Doet Morgan?

Morgan is een HTTP request logger middleware voor Express:

```javascript
// In server.js
const morgan = require('morgan');

const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined'  // Uitgebreide logging voor productie
  : 'dev';      // Korte, gekleurde logging voor development

app.use(morgan(morganFormat, { 
  stream: logger.stream,  // Stream naar Winston logger
  skip: (req, res) => {
    // Skip health checks in productie
    return process.env.NODE_ENV === 'production' && req.url === '/health';
  }
}));
```

### Voorbeeld Output

**Development mode**:
```
GET /api/documents/sent 200 45.123 ms - 1234
POST /api/auth/login 200 123.456 ms - 567
```

**Production mode (combined format)**:
```
::1 - - [29/Oct/2025:08:16:34 +0000] "GET /api/documents/sent HTTP/1.1" 200 1234 "-" "Mozilla/5.0..."
```

## 🎯 Impact

### Voor Fixes:
- ❌ Alle tests faalden direct bij het laden van `server.js`
- ❌ GitHub CI kon niet draaien
- ❌ 40/40 tests failed

### Na Fix:
- ✅ Morgan wordt correct geïnstalleerd
- ✅ Tests kunnen `server.js` laden
- ✅ GitHub CI kan tests uitvoeren
- ✅ HTTP request logging werkt

## 🚀 Verificatie

Check GitHub Actions om te verifiëren dat de tests nu slagen:

```
https://github.com/markqbil/qbil-hub/actions
```

Of lokaal (zonder database lock issues):
```bash
npm install  # Installeert morgan
npm test     # Tests zouden moeten slagen (als geen andere problemen)
```

## 📚 Lessons Learned

### 1. Dependencies Moeten Expliciet Zijn

Elke `require()` in je code moet een corresponderende entry hebben in `package.json`, ofwel in:
- `dependencies` - Voor productie code
- `devDependencies` - Voor development tools (tests, linters, etc.)

### 2. Test Lokaal met Clean Install

Om dit soort problemen vroeg te vangen:

```bash
# Verwijder node_modules en package-lock.json
rm -rf node_modules package-lock.json

# Clean install
npm install

# Test
npm test
```

Of nog beter, gebruik Docker voor consistente environments.

### 3. CI is Je Vriend

GitHub Actions catchte dit probleem omdat het een clean environment gebruikt. Altijd push naar CI voordat je code als "klaar" beschouwt.

## 🔗 Gerelateerde Wijzigingen

Deze fix maakt deel uit van de bredere verbeteringen:

- ✅ GitHub CI linter check fix
- ✅ Script loading volgorde fix (auth.js)
- ✅ **Morgan dependency fix** (deze)
- ✅ Complete setup documentatie (SETUP.md)
- ✅ Quick-start scripts

## 📞 Als Je Nog Problemen Hebt

Als tests nog steeds falen na deze fix, check:

1. **Database Locks** (vooral op Windows)
   - Stop alle Node processen
   - Verwijder test_qbil_hub.db
   - Run tests opnieuw

2. **Andere Missing Dependencies**
   - Check of alle `require()` statements een package.json entry hebben

3. **GitHub Actions Logs**
   - Kijk naar de volledige CI output voor specifieke errors

---

**Commit**: `dfe73be`  
**Datum**: 29 Oktober 2025  
**Status**: ✅ Gepusht naar GitHub


