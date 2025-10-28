require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import utilities and middleware
const { query } = require('./src/utils/database');
const logger = require('./src/utils/logger');
const cleanupService = require('./src/services/cleanupService');
const { etag, responseTime } = require('./src/middleware/responseOptimizer');
const cache = require('./src/utils/cache');

// Import routes
const authRoutes = require('./src/routes/auth');
const connectionRoutes = require('./src/routes/connections');
const documentRoutes = require('./src/routes/documents');
const processingRoutes = require('./src/routes/processing');
const learningRoutes = require('./src/routes/learning');
const auditRoutes = require('./src/routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Response optimization middleware
app.use(responseTime);
app.use(etag);

// CORS configuration
const parseAllowedOrigins = (value) => {
    if (!value) return ['http://localhost:3000'];
    return value.split(',').map(o => o.trim()).filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);

// Strict CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        // In production, enforce strict origin checking
        if (process.env.NODE_ENV === 'production') {
            // Don't allow requests with no origin in production
            if (!origin) {
                logger.warn('CORS: Request blocked - no origin header in production');
                return callback(new Error('Not allowed by CORS - origin required'));
            }
            
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            
            logger.warn('CORS: Origin not allowed', { origin, allowedOrigins });
            return callback(new Error('Not allowed by CORS'));
        }
        
        // In development, allow requests with no origin (for curl, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        logger.warn('CORS: Origin not allowed', { origin, allowedOrigins });
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600, // Cache preflight requests for 10 minutes
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Log CORS configuration on startup
logger.info('CORS configured', { 
    allowedOrigins, 
    environment: process.env.NODE_ENV || 'development',
    strictMode: process.env.NODE_ENV === 'production'
});

// Handle preflight
app.options('*', cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// HTTP request logging
const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' 
  : 'dev';

app.use(morgan(morganFormat, { 
  stream: logger.stream,
  skip: (req, res) => {
    // Skip logging for health checks in production
    return process.env.NODE_ENV === 'production' && req.url === '/health';
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Serve static frontend assets
app.use(express.static('public'));

// Frontend routes
app.get('/', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'login.html'));
});

app.get('/forgot-password', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'reset-password.html'));
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        cache: cache.getStats(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
        }
    };

    // Check database connectivity
    try {
        await query('SELECT 1 as health_check');
        healthCheck.database = 'connected';
    } catch (error) {
        healthCheck.database = 'disconnected';
        healthCheck.status = 'DEGRADED';
        logger.error('Health check: database connection failed', { error: error.message });
    }

    // Set appropriate status code
    const statusCode = healthCheck.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/audit', auditRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
    logger.logError(error, {
        method: req.method,
        url: req.url,
        userId: req.user?.id,
        companyId: req.user?.company_id
    });
    res.status(500).json({ error: 'Internal server error' });
});

// Start server (only if not in test mode)
let server;

if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        logger.info(`🚀 Qbil Hub server running on port ${PORT}`);
        logger.info(`📅 Started at: ${new Date().toISOString()}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        
        // Start cleanup service
        cleanupService.start();
    });

    // Graceful shutdown handler
    const gracefulShutdown = (signal) => {
        logger.info(`${signal} received, shutting down gracefully`);
        
        // Stop accepting new connections
        server.close(async () => {
            try {
                // Stop cleanup service
                cleanupService.stop();
                
                // Shutdown cache
                cache.shutdown();
                
                // Close database connection
                const { close } = require('./src/utils/database');
                await close();
                
                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown', { error: error.message });
                process.exit(1);
            }
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
            logger.warn('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
