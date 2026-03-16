const express = require('express');
const router = express.Router();
const { register, login, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, required, isEmail, minLength, isIn } = require('../middleware/validate');

// POST /api/auth/register
router.post(
  '/register',
  validate({
    name: required('Name'),
    email: isEmail('Email'),
    password: minLength('Password', 6),
    role: isIn('Role', ['admin', 'teacher', 'learner', 'parent']),
  }),
  register
);

// POST /api/auth/login
router.post(
  '/login',
  validate({
    email: isEmail('Email'),
    password: required('Password'),
  }),
  login
);

// POST /api/auth/change-password  (protected)
router.post(
  '/change-password',
  authenticate,
  validate({
    currentPassword: required('Current password'),
    newPassword: minLength('New password', 6),
  }),
  changePassword
);

module.exports = router;
