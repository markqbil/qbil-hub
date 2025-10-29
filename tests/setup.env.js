// Set environment variables BEFORE any modules are loaded
process.env.NODE_ENV = 'test';
process.env.DB_PATH = './test_qbil_hub.db';
process.env.RATE_LIMIT_WINDOW_MS = '999999999';
process.env.RATE_LIMIT_MAX_REQUESTS = '999999';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';


