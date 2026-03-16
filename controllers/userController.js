const pool = require('../config/db');

// GET /api/users/profile
const getProfile = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar_url } = req.body;
    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url), updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, role, avatar_url, updated_at`,
      [name?.trim() || null, avatar_url || null, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/users  (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT id, name, email, role, is_active, created_at FROM users';
    const params = [];

    if (role) {
      query += ' WHERE role = $1';
      params.push(role);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM users' + (role ? ' WHERE role = $1' : ''),
      role ? [role] : []
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id/toggle-active  (admin only)
const toggleUserActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING id, name, email, is_active`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/learners  (teacher - get learners in teacher's classes)
const getLearners = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.created_at
       FROM users u
       JOIN class_enrollments ce ON ce.learner_id = u.id
       JOIN classes c ON c.id = ce.class_id
       WHERE c.teacher_id = $1
       ORDER BY u.name`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, getAllUsers, toggleUserActive, getLearners };
