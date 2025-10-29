const fs = require('fs');
const path = require('path');

// Test database setup
const testDbPath = './test_qbil_hub.db';
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

beforeAll(async () => {
  // Set test environment BEFORE requiring database module
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = testDbPath;
  
  // Disable rate limiting for tests
  process.env.RATE_LIMIT_WINDOW_MS = '999999999'; // Very long window
  process.env.RATE_LIMIT_MAX_REQUESTS = '999999'; // Very high limit
  
  // Clean up any existing test database
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
  
  // Now require database module (after env vars are set)
  const { execAsync, query } = require('../src/utils/database');
  
  // Create test database schema
  const schemaPath = path.join(__dirname, '../src/scripts/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    // Execute entire schema at once (SQLite supports this)
    await execAsync(schema);
  } catch (error) {
    // If that fails, try statement by statement
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && /CREATE|INSERT|ALTER/i.test(stmt));
      
    for (const statement of statements) {
      try {
        await execAsync(statement + ';');
      } catch (err) {
        // Ignore errors for existing objects
        if (!err.message.includes('already exists') && 
            !err.message.includes('UNIQUE constraint')) {
          console.warn('Schema statement failed:', err.message);
        }
      }
    }
  }

  // Remove seed data that may interfere with tests
  const seedBusinessIds = ['TCA001', 'TCB002', 'TCC003'];
  await query(
    `DELETE FROM users WHERE company_id IN (
       SELECT id FROM companies WHERE business_id IN (?, ?, ?)
     )`, seedBusinessIds
  );
  await query(
    `DELETE FROM companies WHERE business_id IN (?, ?, ?)`,
    seedBusinessIds
  );
}, 30000); // Increase timeout for slow systems

afterAll(async () => {
  // Close database connection
  const { close } = require('../src/utils/database');
  await close();
  
  // Wait a bit for the connection to fully close
  await new Promise(resolve => setTimeout(resolve, isCI ? 2000 : 500));
  
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
}, 10000);

// Helper function to create test user
global.createTestUser = async (userData = {}) => {
  const { query } = require('../src/utils/database');
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
  
  const result = await query(
    `INSERT INTO users (company_id, email, password_hash, first_name, last_name, is_admin)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id, email, first_name, last_name, is_admin, company_id`,
    [defaultUser.company_id, defaultUser.email, password_hash, 
     defaultUser.first_name, defaultUser.last_name, defaultUser.is_admin ? 1 : 0]
  );
  
  return result.rows[0];
};

// Helper function to create test company
global.createTestCompany = async (companyData = {}) => {
  const { query } = require('../src/utils/database');
  
  const defaultCompany = {
    name: 'Test Company',
    business_id: 'TEST123',
    email_domain: 'test.com',
    ...companyData
  };
  
  const result = await query(
    `INSERT INTO companies (name, business_id, email_domain)
     VALUES (?, ?, ?)
     RETURNING id, name, business_id, email_domain`,
    [defaultCompany.name, defaultCompany.business_id, defaultCompany.email_domain]
  );
  
  return result.rows[0];
};






