/**
 * Lightweight validation middleware factory.
 * Pass an object of { fieldName: validatorFn } pairs.
 * validatorFn receives the value and returns an error string or null.
 */
const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, validator] of Object.entries(schema)) {
      const value = req.body[field];
      const error = validator(value);
      if (error) {
        errors.push({ field, message: error });
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({ success: false, message: 'Validation failed.', errors });
    }

    next();
  };
};

// Common validators
const required = (label) => (val) =>
  val === undefined || val === null || String(val).trim() === ''
    ? `${label} is required.`
    : null;

const isEmail = (label) => (val) => {
  if (!val) return `${label} is required.`;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(val).toLowerCase()) ? null : `${label} must be a valid email address.`;
};

const minLength = (label, min) => (val) => {
  if (!val) return `${label} is required.`;
  return String(val).length >= min ? null : `${label} must be at least ${min} characters.`;
};

const isIn = (label, allowed) => (val) => {
  if (!val) return `${label} is required.`;
  return allowed.includes(val) ? null : `${label} must be one of: ${allowed.join(', ')}.`;
};

module.exports = { validate, required, isEmail, minLength, isIn };
