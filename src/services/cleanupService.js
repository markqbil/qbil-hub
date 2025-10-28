const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { query } = require('../utils/database');
const logger = require('../utils/logger');

class CleanupService {
    constructor() {
        this.jobs = [];
    }

    /**
     * Start all scheduled cleanup jobs
     */
    start() {
        // Skip cleanup service in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.debug('Cleanup service disabled in test environment');
            return;
        }

        logger.info('Starting cleanup service...');

        // Daily cleanup at 2 AM
        const dailyCleanup = cron.schedule('0 2 * * *', async () => {
            logger.info('Running daily cleanup job');
            await this.cleanupOldDocuments();
            await this.cleanupOrphanedFiles();
            await this.cleanupOldAuditLogs();
        }, {
            scheduled: true,
            timezone: process.env.TIMEZONE || 'Europe/Amsterdam'
        });

        this.jobs.push(dailyCleanup);

        // Weekly cleanup on Sundays at 3 AM
        const weeklyCleanup = cron.schedule('0 3 * * 0', async () => {
            logger.info('Running weekly cleanup job');
            await this.vacuumDatabase();
        }, {
            scheduled: true,
            timezone: process.env.TIMEZONE || 'Europe/Amsterdam'
        });

        this.jobs.push(weeklyCleanup);

        logger.info(`Cleanup service started with ${this.jobs.length} scheduled jobs`);
    }

    /**
     * Stop all cleanup jobs
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        logger.info('Cleanup service stopped');
    }

    /**
     * Clean up old processed documents (configurable retention period)
     */
    async cleanupOldDocuments() {
        try {
            const retentionDays = parseInt(process.env.DOCUMENT_RETENTION_DAYS) || 90;
            
            logger.info(`Cleaning up documents older than ${retentionDays} days`);

            // Get documents to delete
            const result = await query(
                `SELECT id, file_path FROM documents 
                 WHERE status IN ('processed', 'failed') 
                 AND processed_at < datetime('now', '-${retentionDays} days')`,
                []
            );

            const documentsToDelete = result.rows;
            let deletedCount = 0;
            let fileDeletedCount = 0;

            for (const doc of documentsToDelete) {
                try {
                    // Delete physical file
                    if (doc.file_path && fs.existsSync(doc.file_path)) {
                        fs.unlinkSync(doc.file_path);
                        fileDeletedCount++;
                    }

                    // Delete document record and related data (cascade should handle this)
                    await query('DELETE FROM documents WHERE id = ?', [doc.id]);
                    deletedCount++;
                } catch (error) {
                    logger.error('Error deleting document', { 
                        documentId: doc.id, 
                        error: error.message 
                    });
                }
            }

            logger.info('Document cleanup completed', {
                documentsDeleted: deletedCount,
                filesDeleted: fileDeletedCount
            });

            return { documentsDeleted: deletedCount, filesDeleted: fileDeletedCount };
        } catch (error) {
            logger.error('Document cleanup failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Clean up orphaned files in uploads directory
     */
    async cleanupOrphanedFiles() {
        try {
            const uploadDir = process.env.UPLOAD_DIR || 'uploads';

            if (!fs.existsSync(uploadDir)) {
                logger.debug('Upload directory does not exist, skipping orphaned file cleanup');
                return { orphanedFilesDeleted: 0 };
            }

            logger.info('Cleaning up orphaned files in uploads directory');

            // Get all files in upload directory
            const files = fs.readdirSync(uploadDir);
            
            let orphanedCount = 0;

            for (const file of files) {
                const filePath = path.join(uploadDir, file);
                
                // Skip directories
                if (fs.statSync(filePath).isDirectory()) {
                    continue;
                }

                // Check if file is referenced in database
                const result = await query(
                    'SELECT id FROM documents WHERE file_path = ?',
                    [filePath]
                );

                // If not referenced and older than 7 days, delete
                if (result.rows.length === 0) {
                    const stats = fs.statSync(filePath);
                    const fileAge = Date.now() - stats.mtime.getTime();
                    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

                    if (fileAge > sevenDaysMs) {
                        try {
                            fs.unlinkSync(filePath);
                            orphanedCount++;
                            logger.debug('Deleted orphaned file', { filePath });
                        } catch (error) {
                            logger.error('Error deleting orphaned file', { 
                                filePath, 
                                error: error.message 
                            });
                        }
                    }
                }
            }

            logger.info('Orphaned file cleanup completed', { orphanedFilesDeleted: orphanedCount });
            return { orphanedFilesDeleted: orphanedCount };
        } catch (error) {
            logger.error('Orphaned file cleanup failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Clean up old audit logs (keep last 6 months by default)
     */
    async cleanupOldAuditLogs() {
        try {
            const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 180;
            
            logger.info(`Cleaning up audit logs older than ${retentionDays} days`);

            const result = await query(
                `DELETE FROM audit_log 
                 WHERE created_at < datetime('now', '-${retentionDays} days')`,
                []
            );

            // SQLite doesn't return affected rows in the same way, so we track differently
            logger.info('Audit log cleanup completed');
            return { logsDeleted: 'completed' };
        } catch (error) {
            logger.error('Audit log cleanup failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Vacuum SQLite database to reclaim space
     */
    async vacuumDatabase() {
        try {
            logger.info('Running database VACUUM to reclaim space');
            
            await query('VACUUM', []);
            
            logger.info('Database VACUUM completed successfully');
            return { success: true };
        } catch (error) {
            logger.error('Database VACUUM failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Run cleanup immediately (for testing or manual trigger)
     */
    async runNow() {
        logger.info('Running manual cleanup');
        
        const results = {
            documents: await this.cleanupOldDocuments(),
            orphanedFiles: await this.cleanupOrphanedFiles(),
            auditLogs: await this.cleanupOldAuditLogs()
        };

        logger.info('Manual cleanup completed', results);
        return results;
    }
}

// Export singleton instance
const cleanupService = new CleanupService();

module.exports = cleanupService;

