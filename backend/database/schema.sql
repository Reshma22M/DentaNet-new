-- DentaNet LMS Database Schema
-- MySQL Database Creation Script

-- Create Database
CREATE DATABASE IF NOT EXISTS dentanet_lms;
USE dentanet_lms;

-- 1. Users Table (Base table for all users)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'lecturer', 'admin') NOT NULL,
    phone VARCHAR(20),
    profile_image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- 1a. Students Table (Student-specific data)
CREATE TABLE students (
    student_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    batch_year INT NOT NULL,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_batch (batch_year),
    INDEX idx_reg_number (registration_number)
);

-- 1b. Lecturers Table (Lecturer-specific data)
CREATE TABLE lecturers (
    lecturer_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    department VARCHAR(100),
    specialization VARCHAR(100),
    office_location VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 1c. Admins Table (Admin-specific data)
CREATE TABLE admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    admin_level ENUM('super_admin', 'lab_assistant', 'moderator') DEFAULT 'moderator',
    permissions JSON,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 2. Password Reset Tokens Table
CREATE TABLE password_reset_tokens (
    token_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_email (email),
    INDEX idx_otp (otp_code),
    INDEX idx_expires (expires_at)
);

-- 3. Lab Machines Table
CREATE TABLE lab_machines (
    machine_id INT PRIMARY KEY AUTO_INCREMENT,
    machine_code VARCHAR(20) UNIQUE NOT NULL,
    lab_number VARCHAR(20) NOT NULL,
    status ENUM('ready', 'maintenance', 'repair', 'unavailable') DEFAULT 'ready',
    last_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
);

-- 3. Lab Slot Bookings Table
CREATE TABLE lab_bookings (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    machine_id INT NOT NULL,
    booking_type ENUM('practice', 'exam') NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours DECIMAL(3,1),
    status ENUM('pending', 'approved', 'declined', 'completed', 'cancelled') DEFAULT 'pending',
    purpose VARCHAR(255),
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES lab_machines(machine_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_date (booking_date),
    INDEX idx_status (status),
    INDEX idx_type (booking_type)
);

-- 4. Courses Table
CREATE TABLE courses (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    description TEXT,
    credits INT,
    semester INT,
    year_level INT,
    lecturer_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lecturer_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_lecturer (lecturer_id)
);

-- 5. Exams Table
CREATE TABLE exams (
    exam_id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    exam_type ENUM('practical', 'theory', 'viva') NOT NULL,
    exam_date DATE,
    duration_minutes INT,
    max_attempts INT DEFAULT 1,
    passing_grade DECIMAL(5,2),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_course (course_id),
    INDEX idx_date (exam_date)
);

-- 6. Student Exam Submissions Table
CREATE TABLE exam_submissions (
    submission_id INT PRIMARY KEY AUTO_INCREMENT,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    attempt_number INT DEFAULT 1,
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    case_description TEXT,
    status ENUM('pending', 'evaluating', 'evaluated', 'graded') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_exam_attempt (exam_id, student_id, attempt_number),
    INDEX idx_student (student_id),
    INDEX idx_status (status)
);

-- 7. Submission Images Table
CREATE TABLE submission_images (
    image_id INT PRIMARY KEY AUTO_INCREMENT,
    submission_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_type VARCHAR(50),
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES exam_submissions(submission_id) ON DELETE CASCADE,
    INDEX idx_submission (submission_id)
);

-- 8. AI Evaluations Table
CREATE TABLE ai_evaluations (
    ai_evaluation_id INT PRIMARY KEY AUTO_INCREMENT,
    submission_id INT NOT NULL,
    final_grade DECIMAL(5,2) NOT NULL,
    ai_comment TEXT,
    smooth_outline_status ENUM('acceptable', 'non-acceptable') NOT NULL,
    flat_floor_status ENUM('acceptable', 'non-acceptable') NOT NULL,
    depth_status ENUM('acceptable', 'non-acceptable') NOT NULL,
    undercut_status ENUM('acceptable', 'non-acceptable') NOT NULL,
    processing_time_seconds DECIMAL(6,2),
    evaluation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES exam_submissions(submission_id) ON DELETE CASCADE,
    INDEX idx_submission (submission_id)
);

-- 9. Lecturer Evaluations Table
CREATE TABLE lecturer_evaluations (
    evaluation_id INT PRIMARY KEY AUTO_INCREMENT,
    submission_id INT NOT NULL,
    lecturer_id INT NOT NULL,
    final_grade DECIMAL(5,2) NOT NULL,
    lecturer_feedback TEXT,
    evaluation_status ENUM('pass', 'fail', 'retake') NOT NULL,
    override_reason TEXT,
    evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES exam_submissions(submission_id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_submission (submission_id),
    INDEX idx_lecturer (lecturer_id)
);

-- 10. Study Materials Table
CREATE TABLE study_materials (
    material_id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT,
    uploaded_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    material_type ENUM('pdf', 'video', 'youtube', 'link', 'document') NOT NULL,
    file_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    category VARCHAR(100),
    duration VARCHAR(20),
    file_size_mb DECIMAL(10,2),
    views_count INT DEFAULT 0,
    downloads_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_course (course_id),
    INDEX idx_type (material_type)
);

-- 11. Notifications Table
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type ENUM('evaluation', 'booking', 'material', 'system', 'announcement') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_entity_type VARCHAR(50),
    related_entity_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
);

-- 12. Practice Sessions Table (for AI grading feedback)
CREATE TABLE practice_sessions (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    machine_id INT,
    session_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_type VARCHAR(100),
    duration_minutes INT,
    ai_grade VARCHAR(5),
    accuracy_percentage DECIMAL(5,2),
    feedback TEXT,
    completed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES lab_machines(machine_id) ON DELETE SET NULL,
    INDEX idx_student (student_id),
    INDEX idx_date (session_date)
);

-- 13. API Logs Table (for monitoring)
CREATE TABLE api_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INT,
    response_time_ms INT,
    request_body TEXT,
    response_body TEXT,
    error_message TEXT,
    user_id INT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_endpoint (endpoint),
    INDEX idx_created (created_at),
    INDEX idx_status (status_code)
);

-- 14. System Settings Table
CREATE TABLE system_settings (
    setting_id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50),
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert Sample Data

-- Insert Sample Users
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
('admin@dental.pdn.ac.lk', '$2b$10$JUUsqHXqj1evwH8mFBwPweDI4106gGX4bdrLd7QzuA4TG1vhH0zTi', 'Admin', 'User', 'admin'),
('lecturer@dental.pdn.ac.lk', '$2b$10$JUUsqHXqj1evwH8mFBwPweDI4106gGX4bdrLd7QzuA4TG1vhH0zTi', 'John', 'Smith', 'lecturer'),
('student@dental.pdn.ac.lk', '$2b$10$JUUsqHXqj1evwH8mFBwPweDI4106gGX4bdrLd7QzuA4TG1vhH0zTi', 'Jane', 'Doe', 'student');

-- Insert Admin Data
INSERT INTO admins (user_id, admin_level) VALUES (1, 'super_admin');

-- Insert Lecturer Data
INSERT INTO lecturers (user_id, department, specialization) VALUES 
(2, 'Operative Dentistry', 'Cavity Preparation');

-- Insert Student Data
INSERT INTO students (user_id, batch_year, registration_number) VALUES 
(3, 2023, 'DENT/2023/001');

-- Insert Lab Machines
INSERT INTO lab_machines (machine_code, lab_number, status) VALUES
('M-001', 'Lab 001', 'ready'),
('M-002', 'Lab 002', 'maintenance'),
('M-003', 'Lab 001', 'ready'),
('M-004', 'Lab 001', 'ready');

-- Insert Sample Courses
INSERT INTO courses (course_code, course_name, semester, year_level) VALUES
('DENT301', 'Operative Dentistry', 1, 3),
('DENT302', 'Oral Surgery', 1, 3),
('DENT401', 'Advanced Cavity Preparation', 2, 4);

-- Insert System Settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('max_booking_hours', '2', 'Maximum hours per booking'),
('api_endpoint', 'https://api.dentanet.com', 'AI Evaluation API endpoint'),
('email_notifications', 'true', 'Enable email notifications');
