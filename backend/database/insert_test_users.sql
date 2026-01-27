-- Insert Test Users for DentaNet LMS
-- Run this script to add test accounts for all roles

USE dentanet_lms;

-- ========== ADMIN USER ==========
-- Password: Admin@123
INSERT INTO users (email, password_hash, full_name, first_name, last_name, role, is_active)
VALUES (
    'admin@dentanet.lk',
    '$2b$10$KvKem9j4pstwvBLHy0ZgGuvFtrSeYUZVdKdVVKxqX2ZEDQ8ys7FGO',
    'System Administrator',
    'System',
    'Administrator',
    'admin',
    TRUE
) ON DUPLICATE KEY UPDATE email=email;

SET @admin_user_id = LAST_INSERT_ID();

INSERT INTO admins (user_id, admin_level, permissions)
VALUES (
    @admin_user_id,
    'super_admin',
    '{"all": true}'
) ON DUPLICATE KEY UPDATE user_id=user_id;

-- ========== TEST STUDENT ==========
-- Email: student@test.com
-- Password: Student@123
-- Registration: DENT/2024/001
INSERT INTO users (email, password_hash, full_name, first_name, last_name, role, is_active)
VALUES (
    'student@test.com',
    '$2b$10$abcdefghijklmnopqrstuvwxyz',
    'Test Student',
    'Test',
    'Student',
    'student',
    TRUE
) ON DUPLICATE KEY UPDATE email=email;

SET @student_user_id = LAST_INSERT_ID();

INSERT INTO students (user_id, batch_year, registration_number, department)
VALUES (
    @student_user_id,
    2024,
    'DENT/2024/001',
    'Restorative Dentistry'
) ON DUPLICATE KEY UPDATE user_id=user_id;

-- ========== TEST LECTURER ==========
-- Email: lecturer@test.com
-- Password: Lecturer@123
-- Staff ID: LEC/001
INSERT INTO users (email, password_hash, full_name, first_name, last_name, role, is_active)
VALUES (
    'lecturer@test.com',
    '$2b$10$abcdefghijklmnopqrstuvwxyz',
    'Dr. Test Lecturer',
    'Test',
    'Lecturer',
    'lecturer',
    TRUE
) ON DUPLICATE KEY UPDATE email=email;

SET @lecturer_user_id = LAST_INSERT_ID();

INSERT INTO lecturers (user_id, staff_id, department, designation, office_location)
VALUES (
    @lecturer_user_id,
    'LEC/001',
    'Restorative Dentistry',
    'Lecturer',
    'Building A, Room 201'
) ON DUPLICATE KEY UPDATE user_id=user_id;

-- ========== VERIFICATION ==========
SELECT 'Users created successfully!' as message;

SELECT 
    u.email,
    u.role,
    u.full_name,
    CASE 
        WHEN u.role = 'student' THEN s.registration_number
        WHEN u.role = 'lecturer' THEN l.staff_id
        ELSE 'N/A'
    END as identifier
FROM users u
LEFT JOIN students s ON u.user_id = s.user_id
LEFT JOIN lecturers l ON u.user_id = l.user_id
WHERE u.email IN ('admin@dentanet.lk', 'student@test.com', 'lecturer@test.com')
ORDER BY u.role;
