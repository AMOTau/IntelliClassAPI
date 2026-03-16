const pool = require('../config/db');

// POST /api/homework/create
const createHomework = async (req, res, next) => {
  try {
    const { title, description, class_id, due_date } = req.body;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.filename : null;

    const result = await pool.query(
      `INSERT INTO homework (title, description, teacher_id, class_id, due_date, file_path, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title.trim(), description?.trim() || null, req.user.id, class_id || null,
       due_date || null, filePath, fileName]
    );

    res.status(201).json({
      success: true,
      message: 'Homework created.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/homework
const getHomework = async (req, res, next) => {
  try {
    const { class_id } = req.query;
    let query, params;

    if (req.user.role === 'teacher') {
      query = `SELECT h.*, c.name AS class_name,
                      COUNT(hs.id) AS submission_count
               FROM homework h
               LEFT JOIN classes c ON c.id = h.class_id
               LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
               WHERE h.teacher_id = $1`;
      params = [req.user.id];
      if (class_id) { query += ' AND h.class_id = $2'; params.push(class_id); }
      query += ' GROUP BY h.id, c.name ORDER BY h.created_at DESC';
    } else {
      // Learner
      query = `SELECT h.*, c.name AS class_name, u.name AS teacher_name,
                      hs.id AS submission_id, hs.status, hs.submitted_at,
                      hs.grade, hs.feedback
               FROM homework h
               JOIN classes c ON c.id = h.class_id
               JOIN users u ON u.id = h.teacher_id
               JOIN class_enrollments ce ON ce.class_id = c.id AND ce.learner_id = $1
               LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.learner_id = $1`;
      params = [req.user.id];
      if (class_id) { query += ' WHERE h.class_id = $2'; params.push(class_id); }
      query += ' ORDER BY h.due_date ASC';
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/homework/:id
const getHomeworkById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT h.*, c.name AS class_name, u.name AS teacher_name
       FROM homework h
       LEFT JOIN classes c ON c.id = h.class_id
       JOIN users u ON u.id = h.teacher_id
       WHERE h.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Homework not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/homework/submit
const submitHomework = async (req, res, next) => {
  try {
    const { homework_id, notes } = req.body;
    const learnerId = req.user.id;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.filename : null;

    if (!homework_id) {
      return res.status(400).json({ success: false, message: 'homework_id is required.' });
    }

    // Check homework exists
    const hwRes = await pool.query('SELECT * FROM homework WHERE id = $1', [homework_id]);
    if (hwRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Homework not found.' });
    }

    const hw = hwRes.rows[0];
    const isLate = hw.due_date && new Date() > new Date(hw.due_date);
    const status = isLate ? 'late' : 'submitted';

    const result = await pool.query(
      `INSERT INTO homework_submissions (homework_id, learner_id, file_path, file_name, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (homework_id, learner_id) DO UPDATE
         SET file_path = EXCLUDED.file_path,
             file_name = EXCLUDED.file_name,
             notes = EXCLUDED.notes,
             status = EXCLUDED.status,
             submitted_at = NOW()
       RETURNING *`,
      [homework_id, learnerId, filePath, fileName, notes?.trim() || null, status]
    );

    res.status(201).json({
      success: true,
      message: isLate ? 'Homework submitted (late).' : 'Homework submitted successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/homework/:id/grade  (teacher)
const gradeSubmission = async (req, res, next) => {
  try {
    const { id } = req.params; // homework_id
    const { learner_id, grade, feedback } = req.body;

    const result = await pool.query(
      `UPDATE homework_submissions SET grade = $1, feedback = $2, status = 'graded'
       WHERE homework_id = $3 AND learner_id = $4
       RETURNING *`,
      [grade, feedback?.trim() || null, id, learner_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    res.json({ success: true, message: 'Submission graded.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/homework/:id/submissions  (teacher)
const getSubmissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT hs.*, u.name AS learner_name, u.email AS learner_email
       FROM homework_submissions hs
       JOIN users u ON u.id = hs.learner_id
       WHERE hs.homework_id = $1
       ORDER BY hs.submitted_at DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/homework/:id
const deleteHomework = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM homework WHERE id = $1 AND teacher_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Homework not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Homework deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createHomework, getHomework, getHomeworkById, submitHomework,
  gradeSubmission, getSubmissions, deleteHomework,
};
