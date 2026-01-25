const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Configure email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Generate 6-digit OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Store for temporary registration data (in production, use Redis)
const pendingRegistrations = new Map();

// Send registration OTP
router.post('/send-otp', async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
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

        // Check if email already exists
        const [existingUsers] = await promisePool.query(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ 
                error: 'User with this email already exists' 
            });
        }

        // Generate NEW unique OTP (invalidates any previous OTP for this email)
        const otpCode = generateOTP();
        
        // Set expiration time (5 minutes from now)
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Check if there was a previous OTP attempt
        const hadPreviousOTP = pendingRegistrations.has(email);
        
        // Store OTP temporarily (replaces any existing OTP)
        pendingRegistrations.set(email, {
            otp: otpCode,
            expiresAt: expiresAt
        });
        
        if (hadPreviousOTP) {
            console.log(`♻️  Previous OTP for ${email} invalidated - New OTP generated: ${otpCode}`);
        } else {
            console.log(`✨ First OTP generated for ${email}: ${otpCode}`);
        }

        // Send OTP via email
        const mailOptions = {
            from: `"DentaNet LMS" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Email Verification - DentaNet LMS Registration',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1d76d2;">Welcome to DentaNet LMS!</h2>
                    <p>Thank you for registering. To complete your registration, please verify your email address.</p>
                    <div style="background-color: #f0f9ff; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #1d76d2; font-size: 36px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
                    </div>
                    <p><strong>This OTP will expire in 5 minutes.</strong></p>
                    <p>If you didn't request this registration, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    <p style="color: #64748b; font-size: 12px;">
                        DentaNet LMS - University of Peradeniya<br>
                        Faculty of Dental Sciences
                    </p>
                </div>
            `
        };

        // Send email - fail if unable to send
        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ OTP email sent successfully to ${email}`);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError.message);
            
            // In development, log OTP to console as fallback
            if (process.env.NODE_ENV === 'development') {
                console.log('\n' + '='.repeat(70));
                console.log('📧 DEVELOPMENT MODE - EMAIL FAILED');
                console.log('='.repeat(70));
                console.log(`Email: ${email}`);
                console.log(`OTP Code: ${otpCode}`);
                console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
                console.log('='.repeat(70) + '\n');
            } else {
                // In production, fail the request if email can't be sent
                pendingRegistrations.delete(email); // Clean up
                throw new Error('Failed to send verification email. Please check your email address or try again later.');
            }
        }

        res.json({ 
            message: 'OTP sent to your email. Please check your inbox.',
            expiresIn: '5 minutes'
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

// Verify OTP and complete registration
router.post('/verify-and-register', async (req, res) => {
    try {
        const { 
            email, 
            otp, 
            password, 
            firstName, 
            lastName, 
            role, 
            phone,
            batchYear,
            registrationNumber,
            department,
            specialization
        } = req.body;

        // Validate required fields
        if (!email || !otp || !password || !firstName || !lastName || !role) {
            return res.status(400).json({ 
                error: 'All required fields must be provided' 
            });
        }

        // Verify OTP
        const pending = pendingRegistrations.get(email);
        
        if (!pending) {
            return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
        }

        if (Date.now() > pending.expiresAt) {
            pendingRegistrations.delete(email);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        if (pending.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        // OTP verified - delete from pending
        pendingRegistrations.delete(email);

        // Hash password
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert into users table
        const [result] = await promisePool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, phone) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [email, passwordHash, firstName, lastName, role, phone || null]
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
                [userId, department || null, specialization || null]
            );
        } else if (role === 'admin') {
            await promisePool.query(
                'INSERT INTO admins (user_id, admin_level) VALUES (?, ?)',
                [userId, 'moderator']
            );
        }

        res.status(201).json({
            message: 'Registration successful! You can now login.',
            userId: userId
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Check for duplicate registration number
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('registration_number')) {
                return res.status(409).json({ error: 'Registration number already exists' });
            }
        }
        
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

module.exports = router;
