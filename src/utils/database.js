const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const logger = require('./logger');

// Use SQLite for development/demo purposes
const dbPath = process.env.DB_PATH || './qbil_hub.db';

// Create SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('Error opening database', { error: err.message });
    } else {
        logger.info('Connected to SQLite database', { dbPath });
        
        // Enable WAL mode for better concurrent performance
        // But only if not in test mode (WAL can cause issues with test cleanup)
        if (process.env.NODE_ENV !== 'test') {
            db.run('PRAGMA journal_mode = WAL', (err) => {
                if (err) {
                    logger.warn('Failed to enable WAL mode', { error: err.message });
                } else {
                    logger.info('SQLite WAL mode enabled');
                }
            });
        }
        
        // Optimize SQLite settings for performance
        db.run('PRAGMA synchronous = NORMAL'); // Faster, still safe with WAL
        db.run('PRAGMA cache_size = -64000'); // 64MB cache
        db.run('PRAGMA temp_store = MEMORY'); // Use memory for temp tables
        
        if (process.env.NODE_ENV !== 'test') {
            db.run('PRAGMA mmap_size = 30000000000'); // 30GB memory mapping
        }
        
        db.run('PRAGMA page_size = 4096'); // Optimal page size
        
        logger.info('SQLite performance optimizations applied');
    }
});

// Helper function to promisify SQLite queries (returns rows)
const queryAsync = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve({ rows, rowCount: rows.length });
            }
        });
    });
};

// Helper function to promisify SQLite run queries
const runAsync = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

// Helper to execute multi-statement SQL scripts
const execAsync = (sql) => {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
};

// Query helper function (adapted for SQLite)
const query = async (text, params = []) => {
    const start = Date.now();
    try {
        const result = await queryAsync(text, params);
        const duration = Date.now() - start;
        
        if (duration > 1000) {
            logger.warn('Slow query detected', { text: text.substring(0, 100), duration, rows: result.rowCount });
        } else {
            logger.debug('Executed query', { duration, rows: result.rowCount });
        }
        
        return result;
    } catch (err) {
        logger.error('Database query error', { text: text.substring(0, 100), error: err.message, params });
        throw err;
    }
};

// Transaction helper: provides a minimal client with a query method bound to this DB connection
const transaction = async (callback) => {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            const begin = () => new Promise((res, rej) => db.run('BEGIN', (e) => e ? rej(e) : res()));
            const commit = () => new Promise((res, rej) => db.run('COMMIT', (e) => e ? rej(e) : res()));
            const rollback = () => new Promise((res) => db.run('ROLLBACK', () => res()));

            const client = {
                query: (text, params = []) => queryAsync(text, params),
                run: (text, params = []) => runAsync(text, params)
            };

            try {
                await begin();
                const result = await callback(client);
                await commit();
                resolve(result);
            } catch (err) {
                await rollback();
                reject(err);
            }
        });
    });
};

// Close database
const close = () => {
    return new Promise((resolve) => {
        db.close((err) => {
            if (err) {
                logger.error('Error closing database', { error: err.message });
            } else {
                logger.info('Database connection closed');
            }
            resolve();
        });
    });
};

module.exports = {
    db,
    query,
    runAsync,
    execAsync,
    transaction,
    close
};
