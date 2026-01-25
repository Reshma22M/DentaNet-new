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

// Request password reset - send OTP to email
router.post('/request', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists
        const [users] = await promisePool.query(
            'SELECT user_id, first_name FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        const user = users[0];

        // Generate NEW unique OTP
        const otpCode = generateOTP();
        
        // Set expiration time (2 minutes from now)
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        // Delete any existing unused tokens for this user (invalidate old OTPs)
        const [deleteResult] = await promisePool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = ? AND is_used = FALSE',
            [user.user_id]
        );
        
        if (deleteResult.affectedRows > 0) {
            console.log(`♻️  ${deleteResult.affectedRows} old password reset OTP(s) invalidated for user ${user.user_id}`);
        }

        // Store NEW OTP in database
        await promisePool.query(
            'INSERT INTO password_reset_tokens (user_id, otp_code, email, expires_at) VALUES (?, ?, ?, ?)',
            [user.user_id, otpCode, email, expiresAt]
        );
        
        console.log(`✨ New password reset OTP generated for ${email}: ${otpCode}`);

        // Send OTP via email
        const mailOptions = {
            from: `"DentaNet LMS" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset OTP - DentaNet LMS',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1d76d2;">Password Reset Request</h2>
                    <p>Hello ${user.first_name},</p>
                    <p>You requested to reset your password. Use the following OTP code to proceed:</p>
                    <div style="background-color: #f0f9ff; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #1d76d2; font-size: 36px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
                    </div>
                    <p><strong>This OTP will expire in 2 minutes.</strong></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    <p style="color: #64748b; font-size: 12px;">
                        DentaNet LMS - University of Peradeniya<br>
                        Faculty of Dental Sciences
                    </p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Password reset OTP sent successfully to ${email}`);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError.message);
            
            // In development, log OTP to console as fallback
            if (process.env.NODE_ENV === 'development') {
                console.log('\n' + '='.repeat(70));
                console.log('📧 DEVELOPMENT MODE - EMAIL FAILED');
                console.log('='.repeat(70));
                console.log(`Email: ${email}`);
                console.log(`OTP Code: ${otpCode}`);
                console.log(`Expires: ${expiresAt.toLocaleString()}`);
                console.log('='.repeat(70) + '\n');
            } else {
                // In production, fail the request if email can't be sent
                await promisePool.query(
                    'DELETE FROM password_reset_tokens WHERE user_id = ? AND otp_code = ?',
                    [user.user_id, otpCode]
                );
                throw new Error('Failed to send password reset email. Please try again later.');
            }
        }

        res.json({ 
            message: 'OTP sent to your email. Please check your inbox.',
            expiresIn: '2 minutes'
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: 'Failed to send reset code. Please try again.' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp_code } = req.body;

        if (!email || !otp_code) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        // Find valid OTP
        const [tokens] = await promisePool.query(
            `SELECT token_id, user_id, expires_at 
             FROM password_reset_tokens 
             WHERE email = ? AND otp_code = ? AND is_used = FALSE 
             AND expires_at > NOW()
             ORDER BY created_at DESC 
             LIMIT 1`,
            [email, otp_code]
        );

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const token = tokens[0];

        // Mark OTP as verified (extends time for password entry)
        await promisePool.query(
            'UPDATE password_reset_tokens SET verified_at = NOW() WHERE token_id = ?',
            [token.token_id]
        );

        console.log(`✅ OTP verified for user ${token.user_id}. User can now set new password.`);

        res.json({ 
            message: 'OTP verified successfully. You can now set your new password.',
            token_id: token.token_id 
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Reset password with verified OTP
router.post('/reset', async (req, res) => {
    try {
        const { email, otp_code, new_password } = req.body;

        if (!email || !otp_code || !new_password) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Find OTP that was verified (doesn't need to be within 2-min window anymore)
        const [tokens] = await promisePool.query(
            `SELECT token_id, user_id, verified_at 
             FROM password_reset_tokens 
             WHERE email = ? AND otp_code = ? AND is_used = FALSE 
             AND verified_at IS NOT NULL
             ORDER BY created_at DESC 
             LIMIT 1`,
            [email, otp_code]
        );

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'OTP not verified or already used. Please request a new OTP.' });
        }

        const token = tokens[0];

        // Hash new password
        const bcrypt = require('bcrypt');
        const password_hash = await bcrypt.hash(new_password, 10);

        console.log(`🔐 Resetting password for user_id: ${token.user_id}`);
        console.log(`New password hash: ${password_hash.substring(0, 20)}...`);

        // Update user password
        const [updateResult] = await promisePool.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [password_hash, token.user_id]
        );

        console.log(`✅ Password updated. Rows affected: ${updateResult.affectedRows}`);

        // Mark token as used
        await promisePool.query(
            'UPDATE password_reset_tokens SET is_used = TRUE WHERE token_id = ?',
            [token.token_id]
        );

        res.json({ message: 'Password reset successfully. You can now login with your new password.' });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
