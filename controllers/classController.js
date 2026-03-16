const pool = require('../config/db');

// POST /api/classes
const createClass = async (req, res, next) => {
  try {
    const { name, subject, grade } = req.body;
    const result = await pool.query(
      `INSERT INTO classes (name, subject, grade, teacher_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), subject?.trim() || null, grade?.trim() || null, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/classes
const getClasses = async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'teacher') {
      result = await pool.query(
        `SELECT c.*, COUNT(ce.learner_id) AS learner_count
         FROM classes c
         LEFT JOIN class_enrollments ce ON ce.class_id = c.id
         WHERE c.teacher_id = $1
         GROUP BY c.id ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT c.*, u.name AS teacher_name
         FROM class_enrollments ce
         JOIN classes c ON c.id = ce.class_id
         JOIN users u ON u.id = c.teacher_id
         WHERE ce.learner_id = $1
         ORDER BY c.name`,
        [req.user.id]
      );
    }
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/classes/:id
const getClassById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const classRes = await pool.query(
      `SELECT c.*, u.name AS teacher_name FROM classes c
       JOIN users u ON u.id = c.teacher_id WHERE c.id = $1`,
      [id]
    );
    if (classRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }
    const learnersRes = await pool.query(
      `SELECT u.id, u.name, u.email FROM class_enrollments ce
       JOIN users u ON u.id = ce.learner_id WHERE ce.class_id = $1`,
      [id]
    );
    res.json({
      success: true,
      data: { ...classRes.rows[0], learners: learnersRes.rows },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/classes/:id/enroll
const enrollLearner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { learner_id } = req.body;

    // Verify the class belongs to this teacher
    const classRes = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [id, req.user.id]
    );
    if (classRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found or unauthorized.' });
    }

    await pool.query(
      'INSERT INTO class_enrollments (class_id, learner_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, learner_id]
    );
    res.json({ success: true, message: 'Learner enrolled successfully.' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/classes/:id/enroll/:learnerId
const removeEnrollment = async (req, res, next) => {
  try {
    const { id, learnerId } = req.params;
    await pool.query(
      'DELETE FROM class_enrollments WHERE class_id = $1 AND learner_id = $2',
      [id, learnerId]
    );
    res.json({ success: true, message: 'Learner removed from class.' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/classes/:id
const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM classes WHERE id = $1 AND teacher_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Class deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createClass, getClasses, getClassById, enrollLearner, removeEnrollment, deleteClass };
