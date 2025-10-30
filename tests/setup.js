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
  let testDb;
  let retries = 3;
  while (retries > 0) {
    try {
      testDb = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(testDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      });
      break; // Success, exit retry loop
    } catch (err) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to create test database after 3 attempts: ${err.message}`);
      }
      console.log(`Database creation failed, retrying... (${3 - retries}/3)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('Test database connection established');
  
  // Wait for database to be fully created and ready
  await new Promise(resolve => setTimeout(resolve, isCI ? 3000 : 500));
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '../src/scripts/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split schema into statements, excluding seed data (INSERT statements)
  const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => {
      if (stmt.length === 0) return false;
      // Only include CREATE statements (tables, indexes, triggers)
      return /CREATE\s+(TABLE|INDEX|TRIGGER)/i.test(stmt);
    });
  
  console.log(`Executing ${statements.length} CREATE statements...`);
  
  // Execute schema using direct sqlite3
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    await new Promise((resolve, reject) => {
      testDb.exec(statement + ';', (err) => {
        if (err) {
          if (err.message.includes('already exists')) {
            resolve(); // Skip if already exists
          } else {
            console.error(`Failed to execute statement ${i + 1}:`, statement.substring(0, 100));
            console.error('Error:', err.message);
            reject(err);
          }
        } else {
          // Log table creation
          const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`✓ Created table: ${match[1]}`);
          }
          resolve();
        }
      });
    });
  }
  
  console.log('Database schema created successfully');
  
  // Verify that tables were created
  await new Promise((resolve, reject) => {
    testDb.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
      if (err) {
        reject(err);
      } else {
        const tableNames = tables.map(t => t.name);
        console.log('Tables created:', tableNames.join(', '));
        
        // Verify essential tables exist
        const requiredTables = ['companies', 'users', 'connections', 'documents'];
        const missingTables = requiredTables.filter(t => !tableNames.includes(t));
        
        if (missingTables.length > 0) {
          reject(new Error(`Missing required tables: ${missingTables.join(', ')}`));
        } else {
          console.log('✓ All required tables verified');
          resolve();
        }
      }
    });
  });
  
  // Close the direct connection
  await new Promise((resolve, reject) => {
    testDb.close((err) => {
      if (err) {
        console.warn('Warning closing database:', err.message);
      }
      resolve();
    });
  });
  
  console.log('Direct database connection closed');
  
  // Wait for database to be fully ready - longer wait in CI environments
  await new Promise(resolve => setTimeout(resolve, isCI ? 3000 : 500));
  
  // Now require the database module - it will connect to the already-created database
  const db = require('../src/utils/database');
  
  // Wait a bit more for the connection to be established
  await new Promise(resolve => setTimeout(resolve, isCI ? 1000 : 200));
  
  console.log('Test database setup complete ✓');
}, 90000); // Increase timeout for CI environments

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






