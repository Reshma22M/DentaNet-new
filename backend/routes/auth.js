const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }

        // Find user
        const [users] = await promisePool.query(
            'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid credentials' 
            });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ 
                error: 'Invalid credentials' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.user_id,
                email: user.email,
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return user data (without password)
        const { password_hash, ...userWithoutPassword } = user;

        res.json({
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Login failed' 
        });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, batchYear, registrationNumber } = req.body;

        // Validate input
        if (!email || !password || !firstName || !lastName || !role) {
            return res.status(400).json({ 
                error: 'All required fields must be provided' 
            });
        }

        // Check if user already exists
        const [existingUsers] = await promisePool.query(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ 
                error: 'User with this email already exists' 
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await promisePool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, batch_year, registration_number) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, passwordHash, firstName, lastName, role, batchYear || null, registrationNumber || null]
        );

        res.status(201).json({
            message: 'User registered successfully',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Registration failed' 
        });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                error: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get fresh user data
        const [users] = await promisePool.query(
            'SELECT user_id, email, first_name, last_name, role, batch_year FROM users WHERE user_id = ? AND is_active = TRUE',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'User not found' 
            });
        }

        res.json({
            valid: true,
            user: users[0]
        });

    } catch (error) {
        res.status(401).json({ 
            error: 'Invalid token',
            valid: false 
        });
    }
});

module.exports = router;
