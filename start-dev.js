#!/usr/bin/env node

/**
 * Smart Development Startup Script
 * Checks if setup is complete before starting the server
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, friendlyName) {
    if (!fs.existsSync(filePath)) {
        log(`✗ ${friendlyName} niet gevonden (${filePath})`, 'red');
        return false;
    }
    log(`✓ ${friendlyName} gevonden`, 'green');
    return true;
}

function checkSetup() {
    log('\n========================================', 'blue');
    log('  Qbil Hub - Setup Verificatie', 'blue');
    log('========================================\n', 'blue');

    let allChecksPass = true;

    // Check 1: .env file
    log('Controle 1/5: Environment configuratie...', 'blue');
    if (!checkFileExists('.env', '.env bestand')) {
        log('  → Maak een .env bestand aan. Zie SETUP.md voor instructies.', 'yellow');
        allChecksPass = false;
    }

    // Check 2: node_modules
    log('\nControle 2/5: Dependencies...', 'blue');
    if (!checkFileExists('node_modules', 'node_modules directory')) {
        log('  → Run: npm install', 'yellow');
        allChecksPass = false;
    }

    // Check 3: Database file
    log('\nControle 3/5: Database...', 'blue');
    const dbPath = process.env.DB_PATH || './qbil_hub.db';
    if (!checkFileExists(dbPath, 'Database bestand')) {
        log('  → Run: npm run migrate', 'yellow');
        allChecksPass = false;
    }

    // Check 4: Uploads directory
    log('\nControle 4/5: Upload directory...', 'blue');
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
        log(`  ⚠ Upload directory niet gevonden, aanmaken...`, 'yellow');
        try {
            fs.mkdirSync(uploadDir, { recursive: true });
            log(`  ✓ Upload directory aangemaakt`, 'green');
        } catch (error) {
            log(`  ✗ Kon upload directory niet aanmaken: ${error.message}`, 'red');
            allChecksPass = false;
        }
    } else {
        log(`✓ Upload directory gevonden`, 'green');
    }

    // Check 5: Logs directory
    log('\nControle 5/5: Logs directory...', 'blue');
    const logsDir = process.env.LOGS_DIR || 'logs';
    if (!fs.existsSync(logsDir)) {
        log(`  ⚠ Logs directory niet gevonden, aanmaken...`, 'yellow');
        try {
            fs.mkdirSync(logsDir, { recursive: true });
            log(`  ✓ Logs directory aangemaakt`, 'green');
        } catch (error) {
            log(`  ✗ Kon logs directory niet aanmaken: ${error.message}`, 'red');
            allChecksPass = false;
        }
    } else {
        log(`✓ Logs directory gevonden`, 'green');
    }

    return allChecksPass;
}

function showSetupHelp() {
    log('\n========================================', 'red');
    log('  ⚠ Setup Incompleet!', 'red');
    log('========================================\n', 'red');
    
    log('Voer de volgende stappen uit om de setup te voltooien:\n', 'yellow');
    
    log('Optie 1: Gebruik het quick-start script (aanbevolen)', 'blue');
    log('  macOS/Linux:  ./quick-start.sh', 'yellow');
    log('  Windows:      quick-start.bat\n', 'yellow');
    
    log('Optie 2: Handmatige setup', 'blue');
    log('  1. npm install', 'yellow');
    log('  2. Kopieer .env configuratie uit SETUP.md', 'yellow');
    log('  3. npm run migrate', 'yellow');
    log('  4. npm run seed', 'yellow');
    log('  5. npm run dev\n', 'yellow');
    
    log('📖 Zie SETUP.md voor gedetailleerde instructies', 'blue');
    log('');
}

function startServer() {
    log('\n========================================', 'green');
    log('  ✓ Setup Verificatie Geslaagd!', 'green');
    log('========================================\n', 'green');
    
    log('🚀 Server starten...\n', 'blue');
    log('Druk op CTRL+C om te stoppen\n', 'yellow');
    
    // Start the server using nodemon if in development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    try {
        if (isDevelopment) {
            // Check if nodemon is installed
            try {
                execSync('npx nodemon --version', { stdio: 'ignore' });
                log('Development mode: using nodemon for auto-reload\n', 'blue');
                execSync('npx nodemon server.js', { stdio: 'inherit' });
            } catch (error) {
                log('Nodemon niet gevonden, starten met normale node\n', 'yellow');
                execSync('node server.js', { stdio: 'inherit' });
            }
        } else {
            execSync('node server.js', { stdio: 'inherit' });
        }
    } catch (error) {
        // Error is already displayed by execSync with stdio: 'inherit'
        process.exit(1);
    }
}

// Main execution
try {
    // Load .env if it exists
    if (fs.existsSync('.env')) {
        require('dotenv').config();
    }
    
    const setupComplete = checkSetup();
    
    if (!setupComplete) {
        showSetupHelp();
        process.exit(1);
    }
    
    startServer();
} catch (error) {
    log(`\n✗ Onverwachte fout: ${error.message}`, 'red');
    log('Zie SETUP.md voor troubleshooting', 'yellow');
    process.exit(1);
}

