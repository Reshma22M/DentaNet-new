/**
 * Comprehensive Validation Middleware for DentaNet LMS
 * All validation rules as per requirements
 */

// ========================================
// 1. GENERAL VALIDATORS (All Users)
// ========================================

/**
 * Email Validation
 * - Valid email format
 * - Max 255 chars
 * - No spaces
 * - Stored in lowercase
 */
const validateEmail = (email) => {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim();
    
    if (trimmedEmail.length > 255) {
        return { valid: false, error: 'Email must not exceed 255 characters' };
    }

    if (trimmedEmail.includes(' ')) {
        return { valid: false, error: 'Email cannot contain spaces' };
    }

    // Standard email regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true, sanitized: trimmedEmail.toLowerCase() };
};

/**
 * Password Validation
 * - Minimum 8 characters
 * - At least 1 uppercase
 * - At least 1 lowercase
 * - At least 1 number
 * - At least 1 special character
 */
const validatePassword = (password, email = '', username = '') => {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    // Check for lowercase
    if (!/[a-z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }

    // Check for number
    if (!/\d/.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }

    // Check for special character
    if (!/[@$!%*?&]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one special character (@$!%*?&)' };
    }

    // Cannot be same as email or username
    if (email && password.toLowerCase() === email.toLowerCase()) {
        return { valid: false, error: 'Password cannot be the same as email' };
    }

    if (username && password.toLowerCase() === username.toLowerCase()) {
        return { valid: false, error: 'Password cannot be the same as username' };
    }

    return { valid: true };
};

/**
 * Full Name Validation
 * - Required
 * - Only letters + spaces
 * - Min 3 chars, Max 200
 */
const validateFullName = (fullName) => {
    if (!fullName) {
        return { valid: false, error: 'Full name is required' };
    }

    const trimmedName = fullName.trim();

    if (trimmedName.length < 3) {
        return { valid: false, error: 'Full name must be at least 3 characters' };
    }

    if (trimmedName.length > 200) {
        return { valid: false, error: 'Full name must not exceed 200 characters' };
    }

    // Only letters and spaces
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(trimmedName)) {
        return { valid: false, error: 'Full name can only contain letters and spaces' };
    }

    return { valid: true, sanitized: trimmedName };
};

/**
 * Profile Image Validation
 * - Optional
 * - Only jpg/png
 * - Max 2MB
 */
const validateProfileImage = (file) => {
    if (!file) {
        return { valid: true }; // Optional
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, error: 'Profile image must be JPG or PNG format' };
    }

    const maxSizeMB = 2;
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
        return { valid: false, error: `Profile image must not exceed ${maxSizeMB}MB` };
    }

    return { valid: true, sizeMB: fileSizeMB };
};

// ========================================
// 2. STUDENT-SPECIFIC VALIDATORS
// ========================================

/**
 * Student ID / Registration Number Validation
 * Format: DENT/YYYY/XXX
 * Example: DENT/2023/001
 * Year: 2000-2030
 * Number: 001-200
 */
const validateStudentRegistrationNumber = (regNumber) => {
    if (!regNumber) {
        return { valid: false, error: 'Registration number is required for students' };
    }

    const regNumberRegex = /^DENT\/\d{4}\/\d{3}$/;
    if (!regNumberRegex.test(regNumber)) {
        return { 
            valid: false, 
            error: 'Registration number must follow format: DENT/YYYY/XXX (e.g., DENT/2023/001)' 
        };
    }

    // Extract year and number parts
    const parts = regNumber.split('/');
    const year = parseInt(parts[1]);
    const num = parseInt(parts[2]);

    // Validate year range (2000-2030)
    if (year < 2000 || year > 2030) {
        return { 
            valid: false, 
            error: 'Registration number year must be between 2000-2030' 
        };
    }

    // Validate number range (001-200)
    if (num < 1 || num > 200) {
        return { 
            valid: false, 
            error: 'Registration number must be between 001-200' 
        };
    }

    return { valid: true, sanitized: regNumber.toUpperCase() };
};

/**
 * Batch Year Validation
 * - Required for students
 * - Between 2000-2030
 * - Integer only
 */
const validateBatchYear = (batchYear) => {
    if (!batchYear) {
        return { valid: false, error: 'Batch year is required for students' };
    }

    const year = parseInt(batchYear);
    if (isNaN(year)) {
        return { valid: false, error: 'Batch year must be a valid number' };
    }

    if (year < 2000 || year > 2030) {
        return { valid: false, error: 'Batch year must be between 2000 and 2030' };
    }

    return { valid: true, sanitized: year };
};

/**
 * Department Validation (Student)
 * - Required for students
 * - Must be from predefined list
 */
const validateStudentDepartment = (department) => {
    const allowedDepartments = [
        'Basic Sciences',
        'Community Dental Health',
        'Oral Medicine & Periodontology',
        'Oral & Maxillofacial Surgery',
        'Oral Pathology',
        'Prosthetic Dentistry',
        'Restorative Dentistry'
    ];

    if (!department) {
        return { valid: true }; // Optional for students
    }

    if (!allowedDepartments.includes(department)) {
        return { 
            valid: false, 
            error: `Invalid department. Must be one of: ${allowedDepartments.join(', ')}` 
        };
    }

    return { valid: true, sanitized: department };
};

/**
 * Academic Status Validation
 * - Active / Suspended / Graduated
 */
const validateAcademicStatus = (status) => {
    const allowedStatuses = ['Active', 'Suspended', 'Graduated'];

    if (!status) {
        return { valid: true, sanitized: 'Active' }; // Default
    }

    if (!allowedStatuses.includes(status)) {
        return { 
            valid: false, 
            error: `Academic status must be one of: ${allowedStatuses.join(', ')}` 
        };
    }

    return { valid: true, sanitized: status };
};

// ========================================
// 3. LECTURER-SPECIFIC VALIDATORS
// ========================================

/**
 * Staff ID Validation
 * Format: LEC/XXX
 * Example: LEC/045
 */
const validateStaffID = (staffId) => {
    if (!staffId) {
        return { valid: true }; // Optional but recommended
    }

    const staffIdRegex = /^LEC\/\d{3}$/;
    if (!staffIdRegex.test(staffId)) {
        return { 
            valid: false, 
            error: 'Staff ID must follow format: LEC/XXX (e.g., LEC/045)' 
        };
    }

    return { valid: true, sanitized: staffId.toUpperCase() };
};

/**
 * Department Validation (Lecturer)
 * - Required for lecturers
 * - Must be from predefined list
 */
const validateLecturerDepartment = (department) => {
    const allowedDepartments = [
        'Basic Sciences',
        'Community Dental Health',
        'Oral Medicine & Periodontology',
        'Oral & Maxillofacial Surgery',
        'Oral Pathology',
        'Prosthetic Dentistry',
        'Restorative Dentistry'
    ];

    if (!department) {
        return { valid: false, error: 'Department is required for lecturers' };
    }

    if (!allowedDepartments.includes(department)) {
        return { 
            valid: false, 
            error: `Invalid department. Must be one of: ${allowedDepartments.join(', ')}` 
        };
    }

    return { valid: true, sanitized: department };
};

/**
 * Designation Validation
 * - Lecturer / Consultant / Demonstrator
 */
const validateDesignation = (designation) => {
    const allowedDesignations = ['Lecturer', 'Consultant', 'Demonstrator'];

    if (!designation) {
        return { valid: true, sanitized: 'Lecturer' }; // Default
    }

    if (!allowedDesignations.includes(designation)) {
        return { 
            valid: false, 
            error: `Designation must be one of: ${allowedDesignations.join(', ')}` 
        };
    }

    return { valid: true, sanitized: designation };
};

// ========================================
// 4. ADMIN VALIDATORS
// ========================================

/**
 * Admin Password Validation
 * - Minimum 12 characters (stronger than regular users)
 */
const validateAdminPassword = (password) => {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 12) {
        return { valid: false, error: 'Admin password must be at least 12 characters long' };
    }

    // Use regular password validation for other requirements
    return validatePassword(password);
};

// ========================================
// 5. EXAM SUBMISSION VALIDATORS
// ========================================

/**
 * Exam File Validation
 * - Max 100MB
 * - Allowed formats: jpg, png, pdf
 */
const validateExamFile = (file) => {
    if (!file) {
        return { valid: false, error: 'File is required for exam submission' };
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, error: 'File must be JPG, PNG, or PDF format' };
    }

    const maxSizeMB = 100;
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
        return { valid: false, error: `File must not exceed ${maxSizeMB}MB` };
    }

    return { valid: true, sizeMB: fileSizeMB };
};

/**
 * Check if exam deadline has passed (2 hours auto-lock)
 */
const isExamDeadlinePassed = (examDate, durationMinutes) => {
    const deadline = new Date(examDate);
    deadline.setMinutes(deadline.getMinutes() + durationMinutes + 120); // +2 hours buffer
    
    return new Date() > deadline;
};

// ========================================
// 6. MIDDLEWARE FUNCTIONS
// ========================================

/**
 * Middleware: Validate Student Registration
 */
const validateStudentRegistration = (req, res, next) => {
    const { email, password, fullName, batchYear, registrationNumber, department, academicStatus } = req.body;

    // Email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
    }
    req.body.email = emailValidation.sanitized;

    // Password validation
    const passwordValidation = validatePassword(password, emailValidation.sanitized);
    if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
    }

    // Full name validation
    const nameValidation = validateFullName(fullName);
    if (!nameValidation.valid) {
        return res.status(400).json({ error: nameValidation.error });
    }
    req.body.fullName = nameValidation.sanitized;

    // Registration number validation
    const regNumberValidation = validateStudentRegistrationNumber(registrationNumber);
    if (!regNumberValidation.valid) {
        return res.status(400).json({ error: regNumberValidation.error });
    }
    req.body.registrationNumber = regNumberValidation.sanitized;

    // Batch year validation
    const batchYearValidation = validateBatchYear(batchYear);
    if (!batchYearValidation.valid) {
        return res.status(400).json({ error: batchYearValidation.error });
    }
    req.body.batchYear = batchYearValidation.sanitized;

    // Department validation (optional for students)
    if (department) {
        const deptValidation = validateStudentDepartment(department);
        if (!deptValidation.valid) {
            return res.status(400).json({ error: deptValidation.error });
        }
        req.body.department = deptValidation.sanitized;
    }

    // Academic status validation
    const statusValidation = validateAcademicStatus(academicStatus);
    if (!statusValidation.valid) {
        return res.status(400).json({ error: statusValidation.error });
    }
    req.body.academicStatus = statusValidation.sanitized;

    next();
};

/**
 * Middleware: Validate Lecturer Registration
 */
const validateLecturerRegistration = (req, res, next) => {
    const { email, password, fullName, staffId, department, designation } = req.body;

    // Email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
    }
    req.body.email = emailValidation.sanitized;

    // Password validation
    const passwordValidation = validatePassword(password, emailValidation.sanitized);
    if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
    }

    // Full name validation
    const nameValidation = validateFullName(fullName);
    if (!nameValidation.valid) {
        return res.status(400).json({ error: nameValidation.error });
    }
    req.body.fullName = nameValidation.sanitized;

    // Staff ID validation (optional)
    if (staffId) {
        const staffIdValidation = validateStaffID(staffId);
        if (!staffIdValidation.valid) {
            return res.status(400).json({ error: staffIdValidation.error });
        }
        req.body.staffId = staffIdValidation.sanitized;
    }

    // Department validation (required)
    const deptValidation = validateLecturerDepartment(department);
    if (!deptValidation.valid) {
        return res.status(400).json({ error: deptValidation.error });
    }
    req.body.department = deptValidation.sanitized;

    // Designation validation
    const designationValidation = validateDesignation(designation);
    if (!designationValidation.valid) {
        return res.status(400).json({ error: designationValidation.error });
    }
    req.body.designation = designationValidation.sanitized;

    next();
};

/**
 * Middleware: Validate Admin Registration (Restrict to Super Admin only)
 */
const validateAdminRegistration = (req, res, next) => {
    // Check if requester is super admin (this should be checked by auth middleware first)
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            error: 'Only administrators can create admin accounts' 
        });
    }

    const { email, password, fullName } = req.body;

    // Email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
    }
    req.body.email = emailValidation.sanitized;

    // Admin password validation (stricter - min 12 chars)
    const passwordValidation = validateAdminPassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
    }

    // Full name validation
    const nameValidation = validateFullName(fullName);
    if (!nameValidation.valid) {
        return res.status(400).json({ error: nameValidation.error });
    }
    req.body.fullName = nameValidation.sanitized;

    next();
};

/**
 * Middleware: Validate Exam Submission
 */
const validateExamSubmission = (req, res, next) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'File is required for exam submission' });
    }

    const fileValidation = validateExamFile(file);
    if (!fileValidation.valid) {
        return res.status(400).json({ error: fileValidation.error });
    }

    req.fileSizeMB = fileValidation.sizeMB;
    next();
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
    // General validators
    validateEmail,
    validatePassword,
    validateFullName,
    validateProfileImage,

    // Student validators
    validateStudentRegistrationNumber,
    validateBatchYear,
    validateStudentDepartment,
    validateAcademicStatus,

    // Lecturer validators
    validateStaffID,
    validateLecturerDepartment,
    validateDesignation,

    // Admin validators
    validateAdminPassword,

    // Exam validators
    validateExamFile,
    isExamDeadlinePassed,

    // Middleware
    validateStudentRegistration,
    validateLecturerRegistration,
    validateAdminRegistration,
    validateExamSubmission
};
