const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all bookings
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT b.*, u.first_name, u.last_name, u.email, 
                   m.machine_code, m.lab_number
            FROM lab_bookings b
            JOIN users u ON b.user_id = u.user_id
            JOIN lab_machines m ON b.machine_id = m.machine_id
        `;
        
        const params = [];

        // Students can only see their own bookings
        if (req.user.role === 'student') {
            query += ' WHERE b.user_id = ?';
            params.push(req.user.userId);
        }

        query += ' ORDER BY b.booking_date DESC, b.start_time DESC';

        const [bookings] = await promisePool.query(query, params);

        res.json({ bookings });

    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Create booking with validations
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { machineId, bookingType, bookingDate, startTime, endTime, purpose } = req.body;
        const userId = req.user.userId;

        // Validate required fields
        if (!machineId || !bookingType || !bookingDate || !startTime || !endTime) {
            return res.status(400).json({ 
                error: 'Machine ID, booking type, date, start time, and end time are required' 
            });
        }

        // Validate booking type
        const allowedTypes = ['practice', 'exam'];
        if (!allowedTypes.includes(bookingType)) {
            return res.status(400).json({ 
                error: 'Booking type must be either "practice" or "exam"' 
            });
        }

        // Check if machine exists and is available
        const [machines] = await promisePool.query(
            'SELECT * FROM lab_machines WHERE machine_id = ?',
            [machineId]
        );

        if (machines.length === 0) {
            return res.status(404).json({ error: 'Machine not found' });
        }

        const machine = machines[0];

        if (machine.status !== 'ready') {
            return res.status(400).json({ 
                error: `Machine is not available. Current status: ${machine.status}` 
            });
        }

        // Check for overlapping bookings on the same machine
        const [overlapping] = await promisePool.query(
            `SELECT booking_id FROM lab_bookings 
             WHERE machine_id = ? 
             AND booking_date = ? 
             AND status NOT IN ('cancelled', 'declined')
             AND (
                 (start_time < ? AND end_time > ?) OR
                 (start_time < ? AND end_time > ?) OR
                 (start_time >= ? AND end_time <= ?)
             )`,
            [machineId, bookingDate, endTime, startTime, endTime, startTime, startTime, endTime]
        );

        if (overlapping.length > 0) {
            return res.status(409).json({ 
                error: 'This time slot is already booked for the selected machine. Please choose a different time or machine.' 
            });
        }

        // Calculate duration
        const start = new Date(`2000-01-01 ${startTime}`);
        const end = new Date(`2000-01-01 ${endTime}`);
        const durationHours = (end - start) / (1000 * 60 * 60);

        if (durationHours <= 0) {
            return res.status(400).json({ 
                error: 'End time must be after start time' 
            });
        }

        // Check max booking duration (e.g., 4 hours max)
        const maxDuration = 4;
        if (durationHours > maxDuration) {
            return res.status(400).json({ 
                error: `Booking duration cannot exceed ${maxDuration} hours` 
            });
        }

        const [result] = await promisePool.query(
            `INSERT INTO lab_bookings 
             (user_id, machine_id, booking_type, booking_date, start_time, end_time, duration_hours, purpose, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [userId, machineId, bookingType, bookingDate, startTime, endTime, durationHours, purpose || null]
        );

        console.log(`✅ Booking created: User ${userId}, Machine ${machineId}, Date ${bookingDate}`);

        res.status(201).json({ 
            message: 'Booking request submitted. Awaiting admin approval.',
            bookingId: result.insertId,
            status: 'pending'
        });

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Update booking status (admin/lecturer only)
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'student') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const bookingId = req.params.id;
        const { status } = req.body;

        await promisePool.query(
            `UPDATE lab_bookings 
             SET status = ?, approved_by = ?, approved_at = NOW()
             WHERE booking_id = ?`,
            [status, req.user.userId, bookingId]
        );

        res.json({ message: 'Booking status updated successfully' });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

// Cancel booking
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const bookingId = req.params.id;

        await promisePool.query(
            'UPDATE lab_bookings SET status = "cancelled" WHERE booking_id = ?',
            [bookingId]
        );

        res.json({ message: 'Booking cancelled successfully' });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

module.exports = router;
