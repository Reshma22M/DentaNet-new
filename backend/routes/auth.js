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

        console.log(`🔐 Login attempt for: ${email}`);
        console.log(`User ID: ${user.user_id}, Role: ${user.role}`);
        console.log(`Stored hash: ${user.password_hash.substring(0, 20)}...`);

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        console.log(`Password match result: ${passwordMatch}`);
        
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

        // Email format validation temporarily disabled - will enforce xxx@dental.pdn.ac.lk later
        // if (role === 'student') {
        //     const studentEmailRegex = /^[a-zA-Z0-9._%+-]+@dental\.pdn\.ac\.lk$/;
        //     if (!studentEmailRegex.test(email)) {
        //         return res.status(400).json({ 
        //             error: 'Student email must be in format: xxx@dental.pdn.ac.lk' 
        //         });
        //     }
        // }

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

        // Insert into users table
        const [result] = await promisePool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, phone) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [email, passwordHash, firstName, lastName, role, req.body.phone || null]
        );

        const userId = result.insertId;

        // Insert into role-specific table
        if (role === 'student') {
            if (!batchYear || !registrationNumber) {
                return res.status(400).json({ 
                    error: 'Students must provide batch year and registration number' 
                });
            }
            await promisePool.query(
                'INSERT INTO students (user_id, batch_year, registration_number) VALUES (?, ?, ?)',
                [userId, batchYear, registrationNumber]
            );
        } else if (role === 'lecturer') {
            await promisePool.query(
                'INSERT INTO lecturers (user_id, department, specialization) VALUES (?, ?, ?)',
                [userId, req.body.department || null, req.body.specialization || null]
            );
        } else if (role === 'admin') {
            await promisePool.query(
                'INSERT INTO admins (user_id, admin_level) VALUES (?, ?)',
                [userId, req.body.adminLevel || 'moderator']
            );
        }

        res.status(201).json({
            message: 'User registered successfully',
            userId: userId
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
