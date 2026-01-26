const express = require("express");
const router = express.Router();
const { promisePool } = require("../config/database");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// ================= REQUEST RESET OTP =================
router.post("/request", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const [users] = await promisePool.query(
      "SELECT user_id, first_name FROM users WHERE email = ? AND is_active = TRUE",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    const user = users[0];
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min

    // invalidate old
    await promisePool.query(
      "DELETE FROM password_reset_tokens WHERE user_id = ? AND is_used = FALSE",
      [user.user_id]
    );

    await promisePool.query(
      "INSERT INTO password_reset_tokens (user_id, otp_code, email, expires_at) VALUES (?, ?, ?, ?)",
      [user.user_id, otpCode, email, expiresAt]
    );

    await transporter.sendMail({
      from: `"DentaNet LMS" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Password Reset OTP - DentaNet LMS",
      html: `
        <div style="font-family: Arial; max-width:600px;margin:auto;">
          <h2 style="color:#1d76d2;">Password Reset OTP</h2>
          <p>Hello ${user.first_name}, your OTP is:</p>
          <div style="background:#f0f9ff;padding:18px;text-align:center;border-radius:10px;">
            <h1 style="letter-spacing:8px;margin:0;color:#1d76d2;">${otpCode}</h1>
          </div>
          <p><b>Expires in 2 minutes.</b></p>
        </div>
      `,
    });

    return res.json({ message: "OTP sent to your email.", expiresIn: "2 minutes" });
  } catch (error) {
    console.error("Reset request error:", error);
    return res.status(500).json({ error: "Failed to send reset code." });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp_code } = req.body;
    if (!email || !otp_code) return res.status(400).json({ error: "Email and OTP are required" });

    const otpStr = String(otp_code).trim(); // ✅ important

    const [tokens] = await promisePool.query(
      `SELECT token_id, user_id 
       FROM password_reset_tokens
       WHERE email = ? AND otp_code = ? AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, otpStr]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const token = tokens[0];

    await promisePool.query(
      "UPDATE password_reset_tokens SET verified_at = NOW() WHERE token_id = ?",
      [token.token_id]
    );

    return res.json({
      message: "OTP verified successfully. You can now set your new password.",
      token_id: token.token_id,
    });
  } catch (error) {
    console.error("OTP verify error:", error);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// ================= RESET PASSWORD =================
router.post("/reset", async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;
    if (!email || !otp_code || !new_password) {
      return res.status(400).json({ error: "Email, OTP, and new password are required" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const otpStr = String(otp_code).trim();

    const [tokens] = await promisePool.query(
      `SELECT token_id, user_id
       FROM password_reset_tokens
       WHERE email = ? AND otp_code = ? AND is_used = FALSE AND verified_at IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, otpStr]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ error: "OTP not verified or already used. Request a new OTP." });
    }

    const token = tokens[0];
    const password_hash = await bcrypt.hash(new_password, 10);

    await promisePool.query(
      "UPDATE users SET password_hash = ? WHERE user_id = ?",
      [password_hash, token.user_id]
    );

    await promisePool.query(
      "UPDATE password_reset_tokens SET is_used = TRUE WHERE token_id = ?",
      [token.token_id]
    );

    return res.json({ message: "Password reset successfully. You can now login." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

module.exports = router;
