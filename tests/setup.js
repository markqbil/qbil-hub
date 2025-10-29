const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Test database setup
const testDbPath = path.resolve(__dirname, '..', 'test_qbil_hub.db');
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Helper function to clean up WAL files
const cleanupWalFiles = (dbPath) => {
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  
  [walPath, shmPath].forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        // Ignore errors
      }
    }
  });
};

beforeAll(async () => {
  // Set test environment BEFORE requiring database module
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = testDbPath;
  
  // Disable rate limiting for tests
  process.env.RATE_LIMIT_WINDOW_MS = '999999999'; // Very long window
  process.env.RATE_LIMIT_MAX_REQUESTS = '999999'; // Very high limit
  
  // Clean up any existing test database and WAL files
  cleanupWalFiles(testDbPath);
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (err) {
      // If file is locked, wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        fs.unlinkSync(testDbPath);
      } catch (err2) {
        if (!isCI) {
          console.warn('Could not delete test database, continuing anyway:', err2.message);
        }
      }
    }
  }
  
  // Clear require cache to force reload of database module
  delete require.cache[require.resolve('../src/utils/database')];
  delete require.cache[require.resolve('../src/utils/logger')];
  
  // Create database directly using sqlite3, not via our database module
  // This ensures we have full control over initialization
  const testDb = new sqlite3.Database(testDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      throw new Error(`Failed to create test database: ${err.message}`);
    }
  });
  
  // Wait for database to be fully created
  await new Promise(resolve => setTimeout(resolve, isCI ? 2000 : 500));
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '../src/scripts/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split schema into statements, excluding seed data (INSERT statements)
  const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && /CREATE/i.test(stmt)); // Only CREATE statements, no INSERT
  
  // Execute schema using direct sqlite3
  for (const statement of statements) {
    await new Promise((resolve, reject) => {
      testDb.exec(statement + ';', (err) => {
        if (err && !err.message.includes('already exists')) {
          console.warn('Schema statement failed:', err.message);
        }
        resolve();
      });
    });
  }
  
  // Close the direct connection
  await new Promise(resolve => {
    testDb.close(() => resolve());
  });
  
  // Wait for database to be fully ready
  await new Promise(resolve => setTimeout(resolve, isCI ? 2000 : 500));
  
  // Now require the database module - it will connect to the already-created database
  require('../src/utils/database');
}, 60000); // Increase timeout for slow systems

afterAll(async () => {
  try {
    // Close database connection
    const { close } = require('../src/utils/database');
    await close();
    
    // Wait a bit for the connection to fully close
    await new Promise(resolve => setTimeout(resolve, isCI ? 2000 : 500));
    
    // Clean up WAL files first
    cleanupWalFiles(testDbPath);
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        if (!isCI) {
          console.warn('Could not delete test database:', err.message);
        }
      }
    }
  } catch (error) {
    if (!isCI) {
      console.warn('Error in afterAll cleanup:', error.message);
    }
  }
}, 15000);

// Helper function to create test user
global.createTestUser = async (userData = {}) => {
  const { runAsync, query } = require('../src/utils/database');
  const bcrypt = require('bcryptjs');
  
  const defaultUser = {
    email: 'test@example.com',
    password: 'testpassword123',
    first_name: 'Test',
    last_name: 'User',
    is_admin: false,
    company_id: 1,
    ...userData
  };
  
  const password_hash = await bcrypt.hash(defaultUser.password, 10);
  
  await runAsync(
    `INSERT INTO users (company_id, email, password_hash, first_name, last_name, is_admin)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [defaultUser.company_id, defaultUser.email, password_hash, 
     defaultUser.first_name, defaultUser.last_name, defaultUser.is_admin ? 1 : 0]
  );
  
  // Fetch the created user using email (which is unique)
  const user = await query(
    `SELECT id, email, first_name, last_name, is_admin, company_id FROM users WHERE email = ?`,
    [defaultUser.email]
  );
  
  return user.rows[0];
};

// Helper function to create test company
global.createTestCompany = async (companyData = {}) => {
  const { runAsync, query } = require('../src/utils/database');
  
  const defaultCompany = {
    name: 'Test Company',
    business_id: 'TEST123',
    email_domain: 'test.com',
    ...companyData
  };
  
  await runAsync(
    `INSERT INTO companies (name, business_id, email_domain)
     VALUES (?, ?, ?)`,
    [defaultCompany.name, defaultCompany.business_id, defaultCompany.email_domain]
  );
  
  // Fetch the created company using business_id (which is unique)
  const company = await query(
    `SELECT id, name, business_id, email_domain FROM companies WHERE business_id = ?`,
    [defaultCompany.business_id]
  );
  
  return company.rows[0];
};






