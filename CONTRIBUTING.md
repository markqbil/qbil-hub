# Contributing to Qbil Hub

Allereerst, bedankt dat je overweegt bij te dragen aan Qbil Hub! Het zijn mensen zoals jij die Qbil Hub tot een geweldig platform maken.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Code of Conduct

Dit project hanteert professionele en respectvolle communicatie. Wees respectvol naar andere contributors en gebruikers.

## How Can I Contribute?

### Reporting Bugs

Voordat je een bug report maakt:
- **Check de bestaande issues** om te zien of het probleem al gemeld is
- **Check de documentatie** om te zien of je het probleem kunt oplossen
- **Bepaal welke repository** het probleem betreft

Als je een bug report maakt:
- **Gebruik de bug report template** in GitHub Issues
- **Geef een duidelijke titel** die het probleem beschrijft
- **Beschrijf de exacte stappen** om het probleem te reproduceren
- **Geef verwacht en actueel gedrag** aan
- **Voeg screenshots toe** indien van toepassing
- **Vermeld je omgeving** (OS, Node.js versie, etc.)

### Suggesting Enhancements

Enhancement suggestions worden bijgehouden als GitHub issues. Gebruik de feature request template en zorg voor:
- **Clear use case** - Waarom is deze feature nuttig?
- **Detailed description** - Hoe zou het moeten werken?
- **Possible implementation** - Heb je ideeën over hoe te implementeren?

### Pull Requests

1. Fork de repository
2. Creëer een feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit je changes (`git commit -m 'Add some AmazingFeature'`)
4. Push naar de branch (`git push origin feature/AmazingFeature`)
5. Open een Pull Request

## Development Setup

### Prerequisites

- Node.js 18.0.0 of hoger
- npm 9.0.0 of hoger
- Git

### Setup Steps

```bash
# Clone je fork
git clone https://github.com/your-username/qbil-hub.git
cd qbil-hub

# Installeer dependencies
npm install

# Kopieer environment variables
cp .env.example .env

# Setup database
npm run setup

# Run tests om te verificeren
npm test

# Start development server
npm run dev
```

## Coding Standards

### JavaScript Style

- **ES6+** features gebruiken waar mogelijk
- **Async/await** gebruiken in plaats van callbacks
- **Arrow functions** voor korte functies
- **Destructuring** voor object parameters
- **Template literals** voor string interpolation

### Naming Conventions

```javascript
// Classes: PascalCase
class UserController { }

// Functions/Methods: camelCase
function getUserById() { }

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10485760;

// Private methods: camelCase met underscore prefix
_privateMethod() { }
```

### Code Organization

```javascript
// 1. Imports
const express = require('express');
const { query } = require('../utils/database');

// 2. Constants
const MAX_RETRIES = 3;

// 3. Class/Function definition
class MyClass {
    constructor() { }
    
    // Public methods first
    publicMethod() { }
    
    // Private methods last
    _privateMethod() { }
}

// 4. Export
module.exports = MyClass;
```

### Error Handling

```javascript
// Use try-catch voor async operations
try {
    const result = await someAsyncOperation();
    return result;
} catch (error) {
    logger.error('Operation failed', { error: error.message, context });
    throw error;
}

// Use logger in plaats van console.log
logger.info('User logged in', { userId, timestamp });
logger.error('Database error', { error: error.message });
```

### Database Queries

```javascript
// Use parameterized queries (ALWAYS!)
const user = await query(
    'SELECT * FROM users WHERE id = ?',
    [userId]
);

// NOT: String concatenation (SQL injection risk!)
// const user = await query(`SELECT * FROM users WHERE id = '${userId}'`);
```

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: Nieuwe feature
- **fix**: Bug fix
- **docs**: Documentatie wijzigingen
- **style**: Code formatting (geen functionaliteit wijziging)
- **refactor**: Code refactoring
- **perf**: Performance verbetering
- **test**: Tests toevoegen of wijzigen
- **chore**: Build process of dependencies updates

### Examples

```
feat(auth): add password reset functionality

Implemented password reset flow with email tokens.
Added forgot-password and reset-password endpoints.

Closes #123
```

```
fix(documents): prevent null pointer in file validation

Added null check before accessing file properties.
Fixes crash when empty file is uploaded.

Fixes #456
```

## Pull Request Process

### Before Submitting

- [ ] Code volgt de coding standards
- [ ] Alle tests passeren (`npm test`)
- [ ] Nieuwe tests zijn toegevoegd voor nieuwe features
- [ ] Documentatie is bijgewerkt
- [ ] Commit messages volgen de guidelines
- [ ] Branch is up-to-date met main

### PR Description

Gebruik de PR template en zorg voor:
- **Clear description** van wat er veranderd is
- **Type of change** (bug fix, feature, etc.)
- **How to test** de changes
- **Screenshots** indien van toepassing

### Review Process

1. **Automated checks** moeten slagen (CI/CD)
2. **Code review** door minimaal één maintainer
3. **Changes requested** moeten worden verwerkt
4. **Approval** van maintainer vereist voor merge

## Testing

### Running Tests

```bash
# Alle tests
npm test

# Met coverage
npm run test:coverage

# Specifieke test file
npm test -- tests/auth.test.js
```

### Writing Tests

```javascript
describe('User Authentication', () => {
    it('should login with valid credentials', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });
            
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('access_token');
    });
    
    it('should reject invalid credentials', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrong' });
            
        expect(response.status).toBe(401);
    });
});
```

### Test Coverage

- Streef naar **>80% code coverage**
- **Happy path** tests zijn verplicht
- **Error scenarios** moeten getest worden
- **Edge cases** moeten gedekt zijn

## Documentation

### Code Comments

```javascript
/**
 * Validates and uploads a document
 * @param {Object} file - Multer file object
 * @param {string} userId - ID of the user uploading
 * @returns {Promise<Object>} Document metadata
 * @throws {Error} If validation fails
 */
async function uploadDocument(file, userId) {
    // Implementation
}
```

### README Updates

- Update README.md als je publieke API wijzigt
- Update feature lijst voor nieuwe features
- Update installatie instructies als nodig

## Questions?

Heb je vragen? Voel je vrij om:
- Een issue te openen met het label "question"
- De bestaande documentatie te raadplegen
- De code comments te bekijken

Bedankt voor je bijdrage! 🚀
