const express = require("express");
const router = express.Router();
const { promisePool } = require("../config/database");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const {
  validateEmail,
  validatePassword,
  validateFullName,
  validateStudentRegistrationNumber,
  validateBatchYear,
} = require("../middleware/validators");

// ================= EMAIL TRANSPORTER =================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter (optional)
transporter.verify((err) => {
  if (err) console.error("❌ SMTP verify failed:", err.message);
  else console.log("✅ SMTP ready");
});

// ================= OTP HELPERS =================
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString(); // always string
}

// In-memory store (OK for dev/demo)
const pendingRegistrations = new Map();

// ================= SEND OTP =================
router.post("/send-otp", async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    const allowedRoles = ["student", "lecturer"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role. Admins cannot self-register." });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }
    const sanitizedEmail = emailValidation.sanitized;

    // Check if email already exists
    const [existing] = await promisePool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [sanitizedEmail]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    const otpCode = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min

    pendingRegistrations.set(sanitizedEmail, {
      otp: String(otpCode),
      expiresAt,
    });

    const mailOptions = {
      from: `"DentaNet LMS" <${process.env.SMTP_USER}>`,
      to: sanitizedEmail,
      subject: "Email Verification OTP - DentaNet LMS",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1d76d2;">DentaNet Registration OTP</h2>
          <p>Your OTP code is:</p>
          <div style="background:#f0f9ff;padding:18px;text-align:center;border-radius:10px;">
            <h1 style="letter-spacing:8px;margin:0;color:#1d76d2;">${otpCode}</h1>
          </div>
          <p><b>Expires in 5 minutes.</b></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      message: "OTP sent to your email.",
      expiresIn: "5 minutes",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// ================= VERIFY OTP + REGISTER =================
router.post("/verify-and-register", async (req, res) => {
  try {
    const {
      email,
      otp,
      password,
      fullName,
      firstName,
      lastName,
      role,

      // student
      batchYear,
      registrationNumber,
      department,
      academicStatus,

      // lecturer
      staffId,
      designation,
      officeLocation,
    } = req.body;

    if (!email || !otp || !password || !fullName || !role) {
      return res.status(400).json({
        error: "Email, OTP, password, full name, and role are required",
      });
    }

    // Validate role
    const allowedRoles = ["student", "lecturer"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) return res.status(400).json({ error: emailValidation.error });
    const sanitizedEmail = emailValidation.sanitized;

    // ✅ OTP FIX: normalize to string
    const otpStr = String(otp).trim();

    const pending = pendingRegistrations.get(sanitizedEmail);
    if (!pending) {
      return res.status(400).json({ error: "No OTP found. Please request a new OTP." });
    }

    if (Date.now() > pending.expiresAt) {
      pendingRegistrations.delete(sanitizedEmail);
      return res.status(400).json({ error: "OTP expired. Please request a new OTP." });
    }

    if (String(pending.otp) !== otpStr) {
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    // OTP verified
    pendingRegistrations.delete(sanitizedEmail);

    // Validate password + name
    const pwValidation = validatePassword(password, sanitizedEmail);
    if (!pwValidation.valid) return res.status(400).json({ error: pwValidation.error });

    const nameValidation = validateFullName(fullName);
    if (!nameValidation.valid) return res.status(400).json({ error: nameValidation.error });

    // Role-specific validation
    if (role === "student") {
      if (!batchYear || !registrationNumber) {
        return res.status(400).json({
          error: "Students must provide batch year and registration number",
        });
      }

      const by = validateBatchYear(batchYear);
      if (!by.valid) return res.status(400).json({ error: by.error });

      const rn = validateStudentRegistrationNumber(registrationNumber);
      if (!rn.valid) return res.status(400).json({ error: rn.error });
    }

    // Check email exists again (race condition safety)
    const [existing] = await promisePool.query("SELECT user_id FROM users WHERE email = ?", [
      sanitizedEmail,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    // Split name if needed
    let fName = firstName;
    let lName = lastName;
    if (!fName || !lName) {
      const parts = fullName.trim().split(/\s+/);
      fName = parts[0];
      lName = parts.slice(1).join(" ") || parts[0];
    }

    // Hash password
    const bcrypt = require("bcrypt");
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await promisePool.query(
      `INSERT INTO users (email, password_hash, full_name, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sanitizedEmail, passwordHash, fullName.trim(), fName, lName, role]
    );

    const userId = result.insertId;

    // Insert into role tables
    if (role === "student") {
      const regUpper = registrationNumber.toUpperCase();

      // duplicate reg check
      const [dup] = await promisePool.query(
        "SELECT student_id FROM students WHERE registration_number = ?",
        [regUpper]
      );
      if (dup.length > 0) {
        await promisePool.query("DELETE FROM users WHERE user_id = ?", [userId]);
        return res.status(409).json({ error: "Registration number already exists" });
      }

      await promisePool.query(
        `INSERT INTO students (user_id, batch_year, registration_number, department)
         VALUES (?, ?, ?, ?)`,
        [userId, batchYear, regUpper, department || null]
      );
    }

    if (role === "lecturer") {
      const staffUpper = staffId ? staffId.toUpperCase() : null;

      if (staffUpper) {
        const [dup] = await promisePool.query("SELECT lecturer_id FROM lecturers WHERE staff_id = ?", [
          staffUpper,
        ]);
        if (dup.length > 0) {
          await promisePool.query("DELETE FROM users WHERE user_id = ?", [userId]);
          return res.status(409).json({ error: "Staff ID already exists" });
        }
      }

      await promisePool.query(
        `INSERT INTO lecturers (user_id, staff_id, department, designation, office_location)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          staffUpper,
          department || "Restorative Dentistry",
          designation || "Lecturer",
          officeLocation || null,
        ]
      );
    }

    return res.status(201).json({
      message: "Registration successful! You can now login.",
      userId,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      if (String(error.sqlMessage).includes("email")) return res.status(409).json({ error: "Email already exists" });
      if (String(error.sqlMessage).includes("registration_number")) return res.status(409).json({ error: "Registration number already exists" });
      if (String(error.sqlMessage).includes("staff_id")) return res.status(409).json({ error: "Staff ID already exists" });
    }

    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

module.exports = router;
