// Set environment variables BEFORE any modules are loaded
process.env.NODE_ENV = 'test';
process.env.DB_PATH = './test_qbil_hub.db';
process.env.RATE_LIMIT_WINDOW_MS = '999999999';
process.env.RATE_LIMIT_MAX_REQUESTS = '999999';


