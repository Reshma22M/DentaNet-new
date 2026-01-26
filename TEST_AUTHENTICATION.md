# 🧪 Authentication Testing Guide

## Quick Test Scenarios

### ✅ Scenario 1: New Student Registration

1. **Open Registration Page**
   - Go to: http://localhost:8080/signup.html

2. **Fill Student Information**
   ```
   Full Name: John Doe
   Email: john.doe@example.com
   Password: Student@123
   Confirm Password: Student@123
   Role: Student
   Batch Year: 2024
   Registration Number: DENT/2024/050
   ```

3. **Send OTP**
   - Click "Send OTP to Email"
   - Check email inbox (and spam)
   - Note: OTP is valid for 5 minutes

4. **Verify & Register**
   - Enter 6-digit OTP from email
   - Click "Verify OTP & Create Account"
   - Should redirect to login page

5. **Test Login**
   - Use email or registration number: `DENT/2024/050`
   - Password: `Student@123`
   - Should redirect to student dashboard

---

### ✅ Scenario 2: New Lecturer Registration

1. **Open Registration Page**
   - Go to: http://localhost:8080/signup.html

2. **Fill Lecturer Information**
   ```
   Full Name: Dr. Sarah Johnson
   Email: sarah.j@example.com
   Password: Lecturer@456
   Confirm Password: Lecturer@456
   Role: Lecturer
   Department: Prosthetic Dentistry
   Specialization: Crown & Bridge
   ```

3. **Send OTP & Verify**
   - Follow same OTP process as student

4. **Test Login**
   - Can login with email: `sarah.j@example.com`
   - Should redirect to lecturer dashboard

---

### ✅ Scenario 3: Login Attempts & Account Locking

1. **Navigate to Login**
   - Go to: http://localhost:8080/login.html

2. **Test Failed Attempts**
   ```
   Email: john.doe@example.com
   Password: WrongPassword123 (intentionally wrong)
   ```
   - Click Sign In
   - Should show error with remaining attempts

3. **Repeat 5 Times**
   - After 5th failed attempt, account should be locked
   - Error message: "Account is locked. Try again in 15 minutes."

4. **Unlock Account** (Optional - For Testing)
   ```sql
   UPDATE users 
   SET login_attempts = 0, locked_until = NULL 
   WHERE email = 'john.doe@example.com';
   ```

5. **Successful Login**
   - Now use correct password: `Student@123`
   - Should login successfully

---

### ✅ Scenario 4: Password Reset

1. **Request Password Reset**
   - Go to: http://localhost:8080/reset-password.html
   - Enter email: `john.doe@example.com`
   - Click "Send OTP"

2. **Check Email**
   - Open email inbox
   - Find OTP (valid for 2 minutes)
   - Example: `456789`

3. **Verify OTP**
   - Enter OTP code
   - Click "Verify OTP"
   - Should proceed to password reset step

4. **Set New Password**
   ```
   New Password: NewStudent@789
   Confirm Password: NewStudent@789
   ```
   - Click "Reset Password"
   - Should redirect to login

5. **Test New Password**
   - Login with new password: `NewStudent@789`
   - Should work!

---

### ✅ Scenario 5: Multiple Login Identifiers (Student)

**Test all login methods for same account:**

1. **Login with Email**
   ```
   Identifier: john.doe@example.com
   Password: Student@123
   ✅ Should work
   ```

2. **Login with Registration Number**
   ```
   Identifier: DENT/2024/050
   Password: Student@123
   ✅ Should work
   ```

3. **Login with Lowercase**
   ```
   Identifier: dent/2024/050
   Password: Student@123
   ✅ Should work (case-insensitive)
   ```

---

### ✅ Scenario 6: Validation Testing

#### Test Invalid Inputs:

1. **Invalid Email**
   ```
   Email: notanemail
   ❌ Should show: "Invalid email format"
   ```

2. **Weak Password**
   ```
   Password: 12345
   ❌ Should show: "Password must be at least 8 characters"
   ```

3. **Password Missing Requirements**
   ```
   Password: password123 (no uppercase)
   ❌ Should show: "Password must contain at least one uppercase letter"
   ```

4. **Invalid Registration Number**
   ```
   Reg Number: ABC123
   ❌ Should show: "Registration number must follow format: DENT/YYYY/XXX"
   ```

5. **Duplicate Email**
   - Try registering with existing email
   ❌ Should show: "User with this email already exists"

6. **Duplicate Registration Number**
   - Try registering student with existing reg number
   ❌ Should show: "Registration number already exists"

---

### ✅ Scenario 7: OTP Expiry Testing

1. **Registration OTP Expiry**
   - Start registration process
   - Send OTP
   - **Wait 6 minutes** (OTP expires in 5 minutes)
   - Try to verify with OTP
   ❌ Should show: "OTP expired. Please request a new OTP."

2. **Reset Password OTP Expiry**
   - Request password reset
   - Send OTP
   - **Wait 3 minutes** (OTP expires in 2 minutes)
   - Try to verify
   ❌ Should show: "Invalid or expired OTP"

---

### ✅ Scenario 8: Role Verification

1. **Student Trying Admin Login**
   ```
   Role Selected: Administrator
   Identifier: DENT/2024/050
   Password: Student@123
   ❌ Should show: "You selected admin but your account is student"
   ```

2. **Correct Role Selection**
   ```
   Role Selected: Student
   Identifier: DENT/2024/050
   Password: Student@123
   ✅ Should login successfully
   ```

---

### ✅ Scenario 9: JWT Token Testing

1. **Login Successfully**
   - Login as any user
   - Open Browser DevTools (F12)
   - Go to: Application → Local Storage

2. **Verify Token Storage**
   ```javascript
   localStorage.getItem('token')
   // Should return: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   
   localStorage.getItem('user')
   // Should return: JSON object with user data
   ```

3. **Test Protected Route** (Future Implementation)
   - Try accessing dashboard without token
   - Should redirect to login

---

### ✅ Scenario 10: Dark Mode Testing

1. **Toggle Dark Mode**
   - Click moon/sun icon (bottom-right)
   - UI should switch between light and dark themes

2. **Test on All Pages**
   - Login page
   - Registration page
   - Password reset page
   - All should support dark mode

---

## 🔍 Database Verification Queries

### Check Registered Users:
```sql
SELECT 
    u.email, 
    u.full_name, 
    u.role,
    u.is_active,
    u.login_attempts,
    u.locked_until,
    s.registration_number,
    l.staff_id
FROM users u
LEFT JOIN students s ON u.user_id = s.user_id
LEFT JOIN lecturers l ON u.user_id = l.user_id
ORDER BY u.created_at DESC
LIMIT 10;
```

### Check Password Reset Tokens:
```sql
SELECT 
    prt.token_id,
    prt.email,
    prt.otp_code,
    prt.expires_at,
    prt.verified_at,
    prt.is_used,
    prt.created_at
FROM password_reset_tokens prt
ORDER BY prt.created_at DESC
LIMIT 10;
```

### Check Login Attempts:
```sql
SELECT 
    email,
    login_attempts,
    locked_until,
    last_login_at,
    last_login_ip
FROM users
WHERE login_attempts > 0 OR locked_until IS NOT NULL;
```

---

## 📋 Expected Behaviors Checklist

### Registration:
- [x] Email validation before OTP
- [x] OTP sent to email within seconds
- [x] OTP is 6 digits
- [x] OTP expires after 5 minutes
- [x] Password meets all requirements
- [x] Duplicate email rejected
- [x] Duplicate registration number rejected
- [x] User created in database
- [x] Role-specific table populated

### Login:
- [x] Accept email/registration/staff ID
- [x] Case-insensitive identifiers
- [x] Password verified with bcrypt
- [x] Failed attempts counted
- [x] Account locked after 5 failures
- [x] Lock expires after 15 minutes
- [x] IP address logged
- [x] JWT token generated
- [x] Correct dashboard redirect

### Password Reset:
- [x] OTP sent to registered email
- [x] OTP expires after 2 minutes
- [x] OTP verified before reset
- [x] Old tokens invalidated
- [x] Single-use OTP enforcement
- [x] Password updated in database
- [x] Can login with new password

---

## 🚨 Common Issues & Solutions

### Issue: OTP Not Received
**Solutions:**
1. Check spam/junk folder
2. Verify email in backend terminal logs
3. Check SMTP credentials in `.env`
4. Wait 30 seconds (email delivery delay)

### Issue: Database Connection Error
**Solutions:**
1. Verify MySQL is running
2. Check database credentials in `.env`
3. Ensure database `dentanet_lms` exists
4. Run schema.sql if tables missing

### Issue: Port Already in Use
**Solutions:**
```powershell
# Kill process on port 3000
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Kill process on port 8080
Get-NetTCPConnection -LocalPort 8080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Issue: CORS Error
**Solution:**
- Backend must have `FRONTEND_URL=http://localhost:8080` in `.env`
- Restart backend after changes

---

## ✨ Success Indicators

### When Everything is Working:

1. **Backend Terminal Shows:**
   ```
   ✅ Server running on port 3000
   ✅ Database connected successfully!
   ✅ Email server is ready to send messages
   ```

2. **Registration Flow:**
   - OTP email received ✅
   - Account created ✅
   - Redirects to login ✅

3. **Login Flow:**
   - Login successful ✅
   - Token stored ✅
   - Dashboard loads ✅

4. **Password Reset Flow:**
   - OTP received ✅
   - OTP verified ✅
   - Password changed ✅
   - Can login with new password ✅

---

**Testing Complete! 🎉**

All authentication features are working perfectly!
