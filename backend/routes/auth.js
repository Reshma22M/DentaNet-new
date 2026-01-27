const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { promisePool } = require("../config/database");

const {
  checkLoginAttempts,
  recordFailedLogin,
  recordSuccessfulLogin,
  getClientIP,
} = require("../middleware/loginAttempts");

// ================= LOGIN =================
router.post("/login", checkLoginAttempts, async (req, res) => {
  try {
    // Debug: print headers and parsed body only
    console.log("==== LOGIN DEBUG ====");
    console.log("Headers:", req.headers);
    console.log("LOGIN BODY:", req.body);
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Identifier and password are required" });
    }

    const id = identifier.trim();

    // Try to find user by email, registration number, or staff ID
    let query = `
      SELECT u.user_id, u.email, u.password_hash, u.full_name, u.first_name, u.last_name, 
             u.role, u.is_active, u.login_attempts, u.locked_until
      FROM users u
      LEFT JOIN students s ON u.user_id = s.user_id
      LEFT JOIN lecturers l ON u.user_id = l.user_id
      WHERE (u.email = ? OR s.registration_number = ? OR l.staff_id = ?)
      LIMIT 1
    `;

    const [users] = await promisePool.query(query, [id, id.toUpperCase(), id.toUpperCase()]);

    if (users.length === 0) {
      await recordFailedLogin(id, getClientIP(req));
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);
      return res.status(423).json({
        error: `Account is locked. Try again in ${lockRemaining} minutes.`,
        locked: true,
        lockRemaining,
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ error: "Account is deactivated. Contact admin." });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await recordFailedLogin(id, getClientIP(req));
      
      const [updatedUser] = await promisePool.query(
        "SELECT login_attempts FROM users WHERE user_id = ?",
        [user.user_id]
      );
      
      const remainingAttempts = 5 - (updatedUser[0]?.login_attempts || 0);
      
      return res.status(401).json({
        error: "Invalid credentials",
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    // Successful login
    await recordSuccessfulLogin(user.user_id, getClientIP(req));

    // Get role-specific data
    let roleData = {};
    if (user.role === "student") {
      const [students] = await promisePool.query(
        "SELECT batch_year, registration_number, department FROM students WHERE user_id = ?",
        [user.user_id]
      );
      roleData = students[0] || {};
    } else if (user.role === "lecturer") {
      const [lecturers] = await promisePool.query(
        "SELECT staff_id, department, designation, office_location FROM lecturers WHERE user_id = ?",
        [user.user_id]
      );
      roleData = lecturers[0] || {};
    } else if (user.role === "admin") {
      const [admins] = await promisePool.query(
        "SELECT admin_level, permissions FROM admins WHERE user_id = ?",
        [user.user_id]
      );
      roleData = admins[0] || {};
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key-change-this",
      { expiresIn: "24h" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        ...roleData,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// ================= VERIFY TOKEN =================
router.get("/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ valid: false, error: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await promisePool.query(
      `SELECT u.user_id, u.email, u.full_name, u.first_name, u.last_name, u.role, u.is_active
       FROM users u
       WHERE u.user_id = ? AND u.is_active = TRUE
       LIMIT 1`,
      [decoded.userId]
    );

    if (users.length === 0) return res.status(401).json({ valid: false, error: "User not found" });

    const user = users[0];

    // attach student/lecturer/admin info (optional)
    let extra = {};
    if (user.role === "student") {
      const [s] = await promisePool.query(
        "SELECT batch_year, registration_number, department FROM students WHERE user_id = ? LIMIT 1",
        [user.user_id]
      );
      extra.student = s[0] || null;
    } else if (user.role === "lecturer") {
      const [l] = await promisePool.query(
        "SELECT staff_id, department, designation, office_location FROM lecturers WHERE user_id = ? LIMIT 1",
        [user.user_id]
      );
      extra.lecturer = l[0] || null;
    } else if (user.role === "admin") {
      const [a] = await promisePool.query(
        "SELECT admin_level, permissions FROM admins WHERE user_id = ? LIMIT 1",
        [user.user_id]
      );
      extra.admin = a[0] || null;
    }

    return res.json({ valid: true, user: { ...user, ...extra } });
  } catch (error) {
    return res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

module.exports = router;
