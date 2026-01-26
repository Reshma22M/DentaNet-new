const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Request timeout middleware (30 seconds)
app.use((req, res, next) => {
    req.setTimeout(30000, () => {
        console.log('Request timeout:', req.method, req.url);
        res.status(408).json({ error: 'Request timeout' });
    });
    res.setTimeout(30000, () => {
        console.log('Response timeout:', req.method, req.url);
    });
    next();
});

// Middleware
app.use(cors({
    origin: true, // allow any origin in dev (especially localhost random ports)
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"]
}));

app.options("*", cors()); // handle preflight
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Test database connection
const { pool } = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookingRoutes = require('./routes/bookings');
const submissionRoutes = require('./routes/submissions');
const evaluationRoutes = require('./routes/evaluations');
const materialRoutes = require('./routes/materials');
const notificationRoutes = require('./routes/notifications');
const passwordResetRoutes = require('./routes/password-reset');
const registrationRoutes = require('./routes/registration');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/registration', registrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'DentaNet API is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to DentaNet LMS API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            bookings: '/api/bookings',
            submissions: '/api/submissions',
            evaluations: '/api/evaluations',
            materials: '/api/materials',
            notifications: '/api/notifications'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Endpoint not found',
            status: 404
        }
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   🦷 DentaNet LMS API Server         ║
║   ✅ Server running on port ${PORT}      ║
║   🌐 http://localhost:${PORT}            ║
║   📚 Environment: ${process.env.NODE_ENV || 'development'}      ║
╚═══════════════════════════════════════╝
    `);
});

// Set keep-alive timeout (default is 5s, increase to 65s)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('\n🛑 Received shutdown signal, closing server gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        const { pool } = require('./config/database');
        pool.end(() => {
            console.log('✅ Database connection pool closed');
            process.exit(0);
        });
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end(() => {
        console.log('Database pool closed');
    });
});

module.exports = app;
