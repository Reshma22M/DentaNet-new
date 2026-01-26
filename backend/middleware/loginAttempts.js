/**
 * Login Attempt Tracking Middleware
 * - Max 5 failed attempts
 * - Lock account for 15 minutes
 * - Log IP addresses
 */

const { promisePool } = require('../config/database');

/**
 * Check if account is locked
 */
const checkAccountLock = async (userId) => {
  const [users] = await promisePool.query(
    'SELECT locked_until, login_attempts FROM users WHERE user_id = ?',
    [userId]
  );

  if (users.length === 0) {
    return { locked: false };
  }

  const user = users[0];

  // Check if account is currently locked
  if (user.locked_until) {
    const lockTime = new Date(user.locked_until);
    const now = new Date();

    if (now < lockTime) {
      const minutesRemaining = Math.ceil((lockTime - now) / 60000);
      return {
        locked: true,
        message: `Account is locked. Try again in ${minutesRemaining} minute(s).`,
        remainingMinutes: minutesRemaining
      };
    } else {
      // Lock expired, reset attempts
      await promisePool.query(
        'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE user_id = ?',
        [userId]
      );
      return { locked: false };
    }
  }

  return { locked: false, attempts: user.login_attempts };
};

/**
 * Record failed login attempt
 */
const recordFailedLogin = async (identifier, ipAddress) => {
  try {
    const id = (identifier || '').trim();

    // Find user by email, registration number, or staff ID
    const [users] = await promisePool.query(
      `SELECT u.user_id, u.login_attempts, u.email
       FROM users u
       LEFT JOIN students s ON u.user_id = s.user_id
       LEFT JOIN lecturers l ON u.user_id = l.user_id
       WHERE u.email = ? OR s.registration_number = ? OR l.staff_id = ?
       LIMIT 1`,
      [id, id, id]
    );

    if (users.length === 0) {
      // User not found - don't reveal this to attacker
      return { locked: false };
    }

    const user = users[0];
    const newAttempts = user.login_attempts + 1;

    // Check if this will trigger a lock (5 failed attempts)
    if (newAttempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 15); // Lock for 15 minutes

      await promisePool.query(
        'UPDATE users SET login_attempts = ?, locked_until = ? WHERE user_id = ?',
        [newAttempts, lockUntil, user.user_id]
      );

      console.log(`🔒 Account locked: ${user.email} - IP: ${ipAddress} - Attempts: ${newAttempts}`);

      return {
        locked: true,
        message: 'Too many failed login attempts. Account locked for 15 minutes.'
      };
    } else {
      // Increment attempt counter
      await promisePool.query(
        'UPDATE users SET login_attempts = ? WHERE user_id = ?',
        [newAttempts, user.user_id]
      );

      console.log(`⚠️  Failed login: ${user.email} - IP: ${ipAddress} - Attempts: ${newAttempts}/5`);

      return {
        locked: false,
        attempts: newAttempts,
        remainingAttempts: 5 - newAttempts
      };
    }
  } catch (error) {
    console.error('Error recording failed login:', error);
    return { locked: false };
  }
};

/**
 * Record successful login
 */
const recordSuccessfulLogin = async (userId, ipAddress) => {
  try {
    await promisePool.query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE user_id = ?',
      [ipAddress, userId]
    );

    console.log(`Successful login - User ID: ${userId} - IP: ${ipAddress}`);
  } catch (error) {
    console.error('Error recording successful login:', error);
  }
};

/**
 * Get client IP address from request
 */
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Middleware: Check if user account is locked before login
 */
const checkLoginAttempts = async (req, res, next) => {
  try {
    // ✅ Accept identifier from frontend + also support old fields
    const { identifier, email, registrationNumber, staffId } = req.body;
    const id = (identifier || email || registrationNumber || staffId || '').trim();

    if (!id) {
      return res.status(400).json({
        error: 'Email, registration number, or staff ID is required'
      });
    }

    // Find user
    const [users] = await promisePool.query(
      `SELECT u.user_id, u.locked_until, u.login_attempts
       FROM users u
       LEFT JOIN students s ON u.user_id = s.user_id
       LEFT JOIN lecturers l ON u.user_id = l.user_id
       WHERE u.email = ? OR s.registration_number = ? OR l.staff_id = ?
       LIMIT 1`,
      [id, id, id]
    );

    if (users.length > 0) {
      const lockStatus = await checkAccountLock(users[0].user_id);
      if (lockStatus.locked) {
        return res.status(403).json({
          error: lockStatus.message,
          locked: true,
          remainingMinutes: lockStatus.remainingMinutes
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error checking login attempts:', error);
    next(); // Continue even if check fails
  }
};

module.exports = {
  checkAccountLock,
  recordFailedLogin,
  recordSuccessfulLogin,
  getClientIP,
  checkLoginAttempts
};
