const { query } = require('./database');
const logger = require('./logger');

/**
 * Batch insert helper voor betere performance
 */
class BatchOperations {
    /**
     * Batch insert meerdere records in één query
     * @param {string} table - Table name
     * @param {Array} columns - Column names
     * @param {Array} records - Array of value arrays
     * @returns {Promise<number>} - Number of inserted records
     */
    static async batchInsert(table, columns, records) {
        if (!records || records.length === 0) {
            return 0;
        }

        const placeholders = records.map(() => 
            `(${columns.map(() => '?').join(', ')})`
        ).join(', ');

        const values = records.flat();
        const columnList = columns.join(', ');

        const sql = `INSERT INTO ${table} (${columnList}) VALUES ${placeholders}`;

        try {
            const result = await query(sql, values);
            logger.debug('Batch insert completed', { 
                table, 
                records: records.length,
                columns: columns.length 
            });
            return records.length;
        } catch (error) {
            logger.error('Batch insert failed', { 
                table, 
                error: error.message,
                recordCount: records.length 
            });
            throw error;
        }
    }

    /**
     * Batch update meerdere records
     * @param {string} table - Table name
     * @param {Array} updates - Array of {id, fields: {column: value}}
     * @param {string} idColumn - Primary key column name (default: 'id')
     */
    static async batchUpdate(table, updates, idColumn = 'id') {
        if (!updates || updates.length === 0) {
            return 0;
        }

        const promises = updates.map(update => {
            const columns = Object.keys(update.fields);
            const values = Object.values(update.fields);
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            
            return query(
                `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = ?`,
                [...values, update[idColumn]]
            );
        });

        try {
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            
            logger.debug('Batch update completed', { 
                table, 
                total: updates.length,
                successful 
            });
            
            return successful;
        } catch (error) {
            logger.error('Batch update failed', { table, error: error.message });
            throw error;
        }
    }

    /**
     * Batch delete meerdere records
     * @param {string} table - Table name
     * @param {Array} ids - Array of IDs to delete
     * @param {string} idColumn - Primary key column name (default: 'id')
     */
    static async batchDelete(table, ids, idColumn = 'id') {
        if (!ids || ids.length === 0) {
            return 0;
        }

        const placeholders = ids.map(() => '?').join(', ');
        const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${placeholders})`;

        try {
            const result = await query(sql, ids);
            logger.debug('Batch delete completed', { 
                table, 
                records: ids.length 
            });
            return ids.length;
        } catch (error) {
            logger.error('Batch delete failed', { 
                table, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Batch select voor multiple IDs met single query
     * @param {string} table - Table name
     * @param {Array} ids - Array of IDs
     * @param {string} idColumn - Primary key column name (default: 'id')
     * @param {string} columns - Columns to select (default: '*')
     */
    static async batchSelect(table, ids, idColumn = 'id', columns = '*') {
        if (!ids || ids.length === 0) {
            return [];
        }

        const placeholders = ids.map(() => '?').join(', ');
        const sql = `SELECT ${columns} FROM ${table} WHERE ${idColumn} IN (${placeholders})`;

        try {
            const result = await query(sql, ids);
            return result.rows;
        } catch (error) {
            logger.error('Batch select failed', { 
                table, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Chunked batch operations voor zeer grote datasets
     * @param {Function} operation - Batch operation function
     * @param {Array} data - Data to process
     * @param {number} chunkSize - Chunk size (default: 100)
     */
    static async chunkedBatch(operation, data, chunkSize = 100) {
        const results = [];
        
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const result = await operation(chunk);
            results.push(result);
        }
        
        return results;
    }
}

module.exports = BatchOperations;


