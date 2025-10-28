const fs = require('fs');
const path = require('path');
const { execAsync, close } = require('../utils/database');
const logger = require('../utils/logger');

async function migrate() {
    try {
        logger.info('Starting database migration...');

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        logger.info('Schema file loaded successfully');

        // Simple approach: execute the entire schema as one block
        // SQLite can handle multiple statements separated by semicolons
        try {
            await execAsync(schema);
            logger.info('Database schema executed successfully');
            
            console.log('\n✅ Migration completed successfully!');
            console.log('   All tables, indexes, and sample data created');

        } catch (error) {
            // If batch execution fails, fall back to statement-by-statement
            logger.warn('Batch execution failed, falling back to individual statements');
            
            // Clean split on semicolons, handling multi-line statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => {
                    // Filter out empty statements and comments
                    if (!stmt || stmt.length === 0) return false;
                    if (stmt.startsWith('--')) return false;
                    // Keep only lines that have actual SQL commands
                    return /CREATE|INSERT|ALTER|DROP/i.test(stmt);
                });

            logger.info(`Found ${statements.length} SQL statements to execute`);

            let executed = 0;
            let skipped = 0;

            for (const statement of statements) {
                try {
                    await execAsync(statement + ';');
                    executed++;
                    
                    // Log progress
                    if (statement.match(/CREATE TABLE/i)) {
                        const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
                        logger.info(`Created table: ${tableName}`);
                    } else if (statement.match(/CREATE INDEX/i)) {
                        const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1];
                        logger.info(`Created index: ${indexName}`);
                    }
                } catch (error) {
                    // Skip errors for objects that already exist
                    if (error.message.includes('already exists') || 
                        error.message.includes('UNIQUE constraint') ||
                        error.message.includes('duplicate')) {
                        skipped++;
                    } else {
                        logger.error('Migration statement failed', {
                            statement: statement.substring(0, 150),
                            error: error.message
                        });
                        throw error;
                    }
                }
            }

            logger.info('Database migration completed', { executed, skipped });
            console.log('\n✅ Migration completed!');
            console.log(`   Executed: ${executed} statements`);
            console.log(`   Skipped:  ${skipped} statements`);
        }

    } catch (error) {
        logger.error('Migration failed', { error: error.message, stack: error.stack });
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await close();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrate();
}

module.exports = migrate;