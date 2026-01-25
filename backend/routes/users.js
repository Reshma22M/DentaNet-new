const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [users] = await promisePool.query(
            `SELECT user_id, email, first_name, last_name, role, batch_year, 
                    registration_number, phone, is_active, created_at 
             FROM users 
             ORDER BY created_at DESC`
        );

        res.json({ users });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;

        // Users can only view their own data unless they're admin
        if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [users] = await promisePool.query(
            `SELECT user_id, email, first_name, last_name, role, batch_year, 
                    registration_number, phone, profile_image_url, is_active, created_at 
             FROM users 
             WHERE user_id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { firstName, lastName, phone, profileImageUrl } = req.body;

        // Users can only update their own data unless they're admin
        if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await promisePool.query(
            `UPDATE users 
             SET first_name = ?, last_name = ?, phone = ?, profile_image_url = ?
             WHERE user_id = ?`,
            [firstName, lastName, phone, profileImageUrl, userId]
        );

        res.json({ message: 'User updated successfully' });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;

        // Only admin can delete users
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await promisePool.query(
            'UPDATE users SET is_active = FALSE WHERE user_id = ?',
            [userId]
        );

        res.json({ message: 'User deactivated successfully' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
