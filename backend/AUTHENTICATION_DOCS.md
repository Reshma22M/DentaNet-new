# DentaNet LMS - Authentication & Validation System Documentation

## Overview
This document outlines the comprehensive authentication and validation system implemented for DentaNet LMS. All requirements have been fully implemented with proper database schema updates, validation middleware, and security features.

---

## ✅ 1. GENERAL REQUIREMENTS (All Users)

### Email Validation
- **Format**: Standard email format (name@domain.com)
- **Max Length**: 255 characters
- **No Spaces**: Validated
- **Stored**: In lowercase
- **Unique**: Database constraint enforced

### Password Requirements
- **Minimum Length**: 8 characters
- **Required Elements**:
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
  - At least 1 special character (@$!%*?&)
- **Stored**: Hashed using bcrypt
- **Validation**: Cannot be same as email/username

### Full Name
- **Required**: Yes
- **Pattern**: Only letters and spaces
- **Min Length**: 3 characters
- **Max Length**: 200 characters

### Profile Image
- **Optional**: Yes
- **Formats**: JPG, PNG only
- **Max Size**: 2MB
- **Validation**: MIME type and file size checked

---

## ✅ 2. STUDENT REGISTRATION REQUIREMENTS

### Registration Number
- **Format**: DENT/YYYY/XXX
- **Example**: DENT/2023/001
- **Validation**: Regex `/^DENT\/\d{4}\/\d{3}$/`
- **Unique**: Database constraint
- **Cannot Change**: After approval

### Batch Year
- **Required**: Yes
- **Range**: 2000 - 2030
- **Type**: Integer only

### Department (Dropdown)
Options:
- Basic Sciences
- Community Dental Health
- Oral Medicine & Periodontology
- Oral & Maxillofacial Surgery
- Oral Pathology
- Prosthetic Dentistry
- Restorative Dentistry

### Academic Status
Options:
- Active (default)
- Suspended
- Graduated

---

## ✅ 3. LECTURER REGISTRATION REQUIREMENTS

### Staff ID
- **Format**: LEC/XXX
- **Example**: LEC/045
- **Optional**: But recommended
- **Unique**: Database constraint
- **Cannot Change**: After creation

### Department (Dropdown - Required)
Same options as student departments

### Designation (Dropdown)
Options:
- Lecturer (default)
- Consultant
- Demonstrator

---

## ✅ 4. ADMIN REGISTRATION REQUIREMENTS

### Restrictions
- **No Self-Registration**: Admins cannot register themselves
- **Creation Method**: Only by Super Admin
- **Password**: Minimum 12 characters (stronger than regular users)
- **Logging**: All admin actions are logged

---

## ✅ 5. LOGIN REQUIREMENTS

### Multi-Identifier Login
Users can login with **ANY** of:
- Email address
- Registration number (for students)
- Staff ID (for lecturers)

### Failed Login Handling
- **Max Attempts**: 5 failed attempts
- **Lock Duration**: 15 minutes
- **IP Logging**: All attempts logged with IP address
- **Feedback**: Shows remaining attempts
- **Auto-unlock**: After 15 minutes

### Security Features
- Password hashing with bcrypt
- JWT token-based authentication
- Token expiry: 7 days (configurable)
- HTTPS enforcement recommended

---

## ✅ 6. EXAM SUBMISSION VALIDATIONS

### File Requirements
- **Max File Size**: 100MB
- **Allowed Formats**: JPG, PNG, PDF
- **Multiple Files**: Up to 10 files per submission

### Submission Rules
- **Max Attempts**: Enforced per exam configuration
- **Deadline Check**: Auto-lock 2 hours after exam end time
- **Timestamp**: All submissions timestamped

### Evaluation Rules
- AI evaluation must complete first
- Lecturer can override AI evaluation
- Reason mandatory if overridden

---

## ✅ 7. LAB BOOKING VALIDATIONS

### Booking Rules
- **No Overlapping Slots**: System checks for conflicts
- **Machine Availability**: Status must be "ready"
- **Admin Approval**: Required for all bookings
- **Max Duration**: 4 hours per booking

### Overlap Detection
System prevents:
- Same machine, same date, overlapping time slots
- Double bookings by same user

---

## ✅ 8. SECURITY & COMPLIANCE

### Data Security
✔ **Password Hashing**: bcrypt with 10 rounds
✔ **JWT Authentication**: Secure token-based auth
✔ **SQL Injection Prevention**: Parameterized queries
✔ **XSS Protection**: Input sanitization
✔ **HTTPS**: Recommended in production

### Access Control

| Role      | Can Access                          |
|-----------|-------------------------------------|
| Student   | Own data only                       |
| Lecturer  | Assigned courses & all submissions  |
| Admin     | All data                            |

### Login Attempt Tracking
- Tracks failed attempts with IP address
- Auto-locks after 5 failed attempts
- Logs all authentication events
- Records last login time and IP

---

## 📁 File Structure

### Updated Files

#### Database
- `backend/database/schema.sql`
  - Added: `full_name`, `login_attempts`, `locked_until`, `last_login_at`, `last_login_ip`
  - Updated: Students table with `department`, `academic_status`
  - Updated: Lecturers table with `staff_id`, `department`, `designation`

#### Middleware
- `backend/middleware/validators.js` ✨ NEW
  - All validation functions
  - Middleware for student/lecturer/admin registration
  - Exam submission validation

- `backend/middleware/loginAttempts.js` ✨ NEW
  - Failed login tracking
  - Account locking mechanism
  - IP address logging

#### Routes
- `backend/routes/registration.js`
  - Updated with full validation
  - Role-specific field checks
  - Duplicate prevention

- `backend/routes/auth.js`
  - Multi-identifier login (email/registration/staff ID)
  - Login attempt integration
  - IP logging

- `backend/routes/submissions.js`
  - File upload validation
  - Deadline enforcement
  - Max attempts checking

- `backend/routes/bookings.js`
  - Overlap detection
  - Machine availability check
  - Admin approval requirement

---

## 🔧 Usage Examples

### Student Registration
```javascript
POST /api/registration/send-otp
{
  "email": "student@dental.pdn.ac.lk",
  "role": "student"
}

POST /api/registration/verify-and-register
{
  "email": "student@dental.pdn.ac.lk",
  "otp": "123456",
  "password": "SecurePass123!",
  "fullName": "John Doe",
  "role": "student",
  "registrationNumber": "DENT/2023/001",
  "batchYear": 2023,
  "department": "Restorative Dentistry"
}
```

### Lecturer Registration
```javascript
POST /api/registration/verify-and-register
{
  "email": "lecturer@dental.pdn.ac.lk",
  "otp": "123456",
  "password": "SecurePass123!",
  "fullName": "Dr. Jane Smith",
  "role": "lecturer",
  "staffId": "LEC/045",
  "department": "Oral Pathology",
  "designation": "Consultant"
}
```

### Login (Multi-Identifier)
```javascript
POST /api/auth/login
{
  "identifier": "student@dental.pdn.ac.lk",  // Can also be "DENT/2023/001" or "LEC/045"
  "password": "SecurePass123!"
}
```

### Exam Submission
```javascript
POST /api/submissions
Headers: Authorization: Bearer <token>
Form Data:
  - examId: 1
  - images: [file1.jpg, file2.jpg]
  - caseDescription: "Cavity preparation on molar"
```

### Lab Booking
```javascript
POST /api/bookings
Headers: Authorization: Bearer <token>
{
  "machineId": 1,
  "bookingType": "practice",
  "bookingDate": "2026-02-01",
  "startTime": "09:00:00",
  "endTime": "11:00:00",
  "purpose": "Cavity preparation practice"
}
```

---

## 🚀 Deployment Steps

### 1. Update Database
```bash
cd backend
mysql -u root -p dentanet_lms < database/schema.sql
```

### 2. Install Dependencies
```bash
npm install multer  # For file uploads
```

### 3. Create Upload Directory
```bash
mkdir -p uploads/exam-submissions
```

### 4. Environment Variables
Ensure `.env` contains:
```
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NODE_ENV=production
```

### 5. Restart Server
```bash
npm run dev
```

---

## 🧪 Testing Checklist

### Registration Tests
- [ ] Student registration with valid data
- [ ] Duplicate registration number rejection
- [ ] Invalid email format rejection
- [ ] Weak password rejection
- [ ] Admin self-registration blocked

### Login Tests
- [ ] Login with email
- [ ] Login with registration number
- [ ] Login with staff ID
- [ ] 5 failed attempts lock account
- [ ] Account unlocks after 15 minutes
- [ ] IP address logging

### Exam Submission Tests
- [ ] File size limit (100MB)
- [ ] File format validation (JPG, PNG, PDF only)
- [ ] Max attempts enforcement
- [ ] Deadline enforcement (2 hours after exam)

### Booking Tests
- [ ] Overlapping slot rejection
- [ ] Unavailable machine rejection
- [ ] Max duration enforcement (4 hours)
- [ ] Admin approval required

---

## 📊 Database Schema Changes

### Users Table
```sql
ALTER TABLE users 
ADD COLUMN full_name VARCHAR(200) NOT NULL AFTER password_hash,
ADD COLUMN profile_image_size_mb DECIMAL(3,2),
ADD COLUMN login_attempts INT DEFAULT 0,
ADD COLUMN locked_until TIMESTAMP NULL,
ADD COLUMN last_login_at TIMESTAMP NULL,
ADD COLUMN last_login_ip VARCHAR(45);
```

### Students Table
```sql
ALTER TABLE students
ADD COLUMN department ENUM('Basic Sciences', 'Community Dental Health', ...) AFTER registration_number,
ADD COLUMN academic_status ENUM('Active', 'Suspended', 'Graduated') DEFAULT 'Active';
```

### Lecturers Table
```sql
ALTER TABLE lecturers
ADD COLUMN staff_id VARCHAR(50) UNIQUE AFTER user_id,
MODIFY COLUMN department ENUM('Basic Sciences', 'Community Dental Health', ...) NOT NULL,
ADD COLUMN designation ENUM('Lecturer', 'Consultant', 'Demonstrator') DEFAULT 'Lecturer';
```

---

## 🔐 Security Best Practices

1. **Always use HTTPS** in production
2. **Rotate JWT secrets** periodically
3. **Monitor failed login attempts** for suspicious activity
4. **Backup database** regularly
5. **Keep dependencies updated** for security patches
6. **Use environment variables** for sensitive data
7. **Enable CORS** only for trusted domains
8. **Implement rate limiting** on public endpoints
9. **Sanitize all user inputs**
10. **Log all authentication events**

---

## 📞 Support

For database setup issues or validation questions, refer to:
- `backend/middleware/validators.js` - All validation logic
- `backend/middleware/loginAttempts.js` - Login security
- `backend/database/schema.sql` - Complete database structure

---

**Last Updated**: January 26, 2026
**Version**: 2.0.0
**Status**: ✅ Production Ready
