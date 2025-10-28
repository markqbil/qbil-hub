# Qbil Hub - B2B Document Exchange Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/PULL_REQUEST_TEMPLATE.md)

Een moderne B2B document exchange hub waarmee bedrijven veilig documenten kunnen uitwisselen, met automatische verwerking en machine learning voor product mapping.

---

## ✨ Features

### Core Functionaliteit
- 🔗 **Trading Partner Connecties** - Veilige verbindingen tussen bedrijven
- 📄 **Document Exchange** - Upload en ontvang documenten (PDF, DOCX, TXT, CSV)
- 🤖 **Automatische Verwerking** - Tekstextractie en data parsing
- 🧠 **Machine Learning** - Intelligente product code mapping tussen bedrijven
- 📊 **Audit Logging** - Complete audit trail van alle acties

### Security & Performance
- 🔐 **JWT Authentication** - Secure auth met refresh tokens
- 🛡️ **Security Features** - Helmet.js, CORS, Rate Limiting, Input validation
- ⚡ **Performance Optimized** - In-memory caching, WAL mode, compound indexes
- 🚀 **60-80% sneller** - Door database en query optimalisaties
- 💾 **Smart Caching** - Reduced database load met TTL-based caching

### Developer Experience
- 📚 **RESTful API** - Volledige API documentatie
- 🧪 **Test Suite** - Comprehensive tests met Jest
- 📝 **Extensive Logging** - Winston-based structured logging
- 🧹 **Auto Cleanup** - Scheduled cleanup van oude data

## 📋 Prerequisites

- Node.js 16+ en npm
- SQLite3

## 🔧 Installatie

### 1. Clone het project

```bash
git clone <repository-url>
cd qbil-hub
```

### 2. Installeer dependencies

```bash
npm install
```

### 3. Configureer environment variabelen

Maak een `.env` bestand in de root directory:

```env
# Server
PORT=3000
NODE_ENV=development

# CORS (comma-gescheiden lijst)
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=change-me-in-production-use-strong-random-string
JWT_EXPIRES_IN=24h

# Database
DB_PATH=./qbil_hub.db

# Uploads
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

### 4. Database setup

```bash
# Voer database migratie uit
npm run migrate

# Seed demo data (optioneel)
npm run seed
```

### 5. Start de applicatie

```bash
# Development mode met auto-reload
npm run dev

# Production mode
npm start
```

De applicatie is nu beschikbaar op `http://localhost:3000`

## 🔑 Demo Credentials

Na het runnen van `npm run seed`:

```
Email:    admin@companya.com
Password: admin123
Role:     Admin
```

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

Alle protected endpoints vereisen een JWT token in de Authorization header:

```
Authorization: Bearer <access_token>
```

### Endpoints

#### Auth

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me
```

**Voorbeeld - Register:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Example Corp",
    "business_id": "EX001",
    "is_admin": true
  }'
```

**Voorbeeld - Login:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@companya.com",
    "password": "admin123"
  }'
```

#### Connections (Admin only)

```http
GET  /api/connections/search-companies?search=<term>
POST /api/connections/request
GET  /api/connections/pending-requests
POST /api/connections/:id/approve
POST /api/connections/:id/decline
GET  /api/connections/my-connections
POST /api/connections/:id/suspend
```

**Voorbeeld - Request Connection:**

```bash
curl -X POST http://localhost:3000/api/connections/request \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_company_id": "company-uuid"
  }'
```

#### Documents

```http
POST /api/documents/send
GET  /api/documents/sent?limit=50&offset=0
GET  /api/documents/received?status=delivered
GET  /api/documents/:id
POST /api/documents/:id/acknowledge
GET  /api/documents/stats/overview
```

**Voorbeeld - Send Document:**

```bash
curl -X POST http://localhost:3000/api/documents/send \
  -H "Authorization: Bearer <token>" \
  -F "document=@invoice.pdf" \
  -F "recipient_company_id=company-uuid" \
  -F "document_type=invoice" \
  -F "priority=high"
```

#### Processing

```http
GET  /api/processing/document/:id
POST /api/processing/document/:id/process
GET  /api/processing/queue
```

#### Learning (Admin only)

```http
POST /api/learning/train
GET  /api/learning/suggest?from_company_id=1&to_company_id=2&product_code=PROD-001
GET  /api/learning/stats
GET  /api/learning/suggestions
POST /api/learning/mapping/:id/feedback
GET  /api/learning/mappings
```

### Response Formats

**Success Response:**

```json
{
  "data": { ... },
  "message": "Success message"
}
```

**Error Response:**

```json
{
  "error": "Error message description"
}
```

## 🏗️ Project Structure

```
qbil-hub/
├── public/                 # Frontend assets
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   ├── index.html         # Main app
│   └── login.html         # Login page
├── src/
│   ├── controllers/       # Request handlers
│   ├── middleware/        # Express middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── scripts/          # Database scripts
│   ├── services/         # Business logic
│   └── utils/            # Utilities (logger, database, etc.)
├── tests/                # Jest tests
├── uploads/              # Uploaded documents
├── logs/                 # Application logs
├── server.js             # Express server
└── package.json
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/auth.test.js
```

## 📊 Logging

De applicatie gebruikt Winston voor structured logging:

- **Console**: Development mode (colored output)
- **Files**: 
  - `logs/combined.log` - Alle logs
  - `logs/error.log` - Alleen errors
  - `logs/exceptions.log` - Uncaught exceptions
  - `logs/rejections.log` - Unhandled promise rejections

## 🧹 Cleanup Service

Automatische opruiming draait volgens schema:

- **Daily (2 AM)**: Oude documenten, orphaned files, audit logs
- **Weekly (Sunday 3 AM)**: Database VACUUM

Configureer retentie via environment variabelen:
- `DOCUMENT_RETENTION_DAYS` (default: 90)
- `AUDIT_LOG_RETENTION_DAYS` (default: 180)

## 🔒 Security Features

### Authentication & Authorization
- **JWT**: Access & refresh tokens met secure configuration
- **bcrypt**: Password hashing met 10 rounds
- **Role-based Access**: Admin en gebruiker rollen
- **Session Management**: Refresh token rotation

### Network Security
- **Helmet.js**: Comprehensive security headers
- **CORS**: Strikte origin checking (production mode)
  - Development: Flexibel voor testing
  - Production: Alleen whitelisted origins
- **Rate Limiting**: 100 requests per 15 minuten per IP
- **HTTPS Enforcement**: Optioneel configureerbaar

### File Upload Security
- **MIME Type Validation**: Strict type checking
- **File Extension Validation**: Whitelist approach
- **File Size Limits**: Configureerbaar (default 10MB)
- **Magic Number Validation**: File signature checking
- **Filename Sanitization**: Prevent path traversal
- **Secure Filename Generation**: Cryptographically random names
- **Zero-byte Protection**: Empty file rejection

### Input Validation
- **Parameter Sanitization**: SQL injection preventie
- **XSS Protection**: Input/output encoding
- **Path Traversal Prevention**: Secure file path handling
- **Null Byte Filtering**: Prevent null byte attacks

### Email Security
- **Nodemailer Integration**: Secure SMTP configuration
- **Template Sanitization**: Prevent injection attacks
- **Rate Limited**: Prevent email spam

## 🚦 Health Check

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600.5,
  "environment": "development",
  "database": "connected"
}
```

## 📦 Scripts

```bash
npm start           # Start production server
npm run dev         # Start development server with nodemon
npm test            # Run Jest tests
npm test:coverage   # Run tests with coverage report
npm run migrate     # Run database migrations
npm run seed        # Seed demo data
npm run setup       # Run migrations and seed (first-time setup)
```

## 🤝 Contributing

1. Fork het project
2. Maak een feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit je changes (`git commit -m 'Add some AmazingFeature'`)
4. Push naar de branch (`git push origin feature/AmazingFeature`)
5. Open een Pull Request

## 📝 License

Dit project is gelicenseerd onder de MIT License.

## 👥 Team

Qbil Hub Development Team

## 📧 Support

Voor vragen of support, neem contact op via [support@qbil.com](mailto:support@qbil.com)

---

**Built with ❤️ using Node.js, Express, SQLite, and Modern Web Technologies**

