const pool = require('../config/db');

// GET /api/analytics/class-performance  (teacher)
const classPerformance = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const { class_id } = req.query;

    let classFilter = '';
    const params = [teacherId];
    if (class_id) {
      classFilter = ' AND q.class_id = $2';
      params.push(class_id);
    }

    const quizStatsRes = await pool.query(
      `SELECT c.name AS class_name, q.title AS quiz_title,
              COUNT(qs.id) AS total_submissions,
              ROUND(AVG(qs.percentage), 2) AS avg_score,
              MAX(qs.percentage) AS highest,
              MIN(qs.percentage) AS lowest
       FROM quizzes q
       JOIN classes c ON c.id = q.class_id
       LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id
       WHERE q.teacher_id = $1${classFilter}
       GROUP BY c.name, q.id, q.title
       ORDER BY c.name, q.created_at DESC`,
      params
    );

    const hwStatsRes = await pool.query(
      `SELECT c.name AS class_name,
              COUNT(DISTINCT ce.learner_id) AS total_learners,
              COUNT(hs.id) AS total_submissions,
              COUNT(CASE WHEN hs.status = 'late' THEN 1 END) AS late_submissions
       FROM classes c
       JOIN class_enrollments ce ON ce.class_id = c.id
       LEFT JOIN homework h ON h.class_id = c.id AND h.teacher_id = $1
       LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
       WHERE c.teacher_id = $1${class_id ? ' AND c.id = $2' : ''}
       GROUP BY c.name
       ORDER BY c.name`,
      params
    );

    res.json({
      success: true,
      data: {
        quiz_performance: quizStatsRes.rows,
        homework_stats: hwStatsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/learner-performance  (teacher, parent, learner)
const learnerPerformance = async (req, res, next) => {
  try {
    let learnerId;

    if (req.user.role === 'learner') {
      learnerId = req.user.id;
    } else {
      learnerId = req.query.learner_id;
      if (!learnerId) {
        return res.status(400).json({ success: false, message: 'learner_id query param is required.' });
      }
    }

    const [learnerRes, quizRes, hwRes, progressRes] = await Promise.all([
      pool.query('SELECT id, name, email FROM users WHERE id = $1 AND role = $2', [learnerId, 'learner']),
      pool.query(
        `SELECT q.title, qs.score, qs.total_marks, qs.percentage, qs.submitted_at,
                c.name AS class_name
         FROM quiz_submissions qs
         JOIN quizzes q ON q.id = qs.quiz_id
         LEFT JOIN classes c ON c.id = q.class_id
         WHERE qs.learner_id = $1
         ORDER BY qs.submitted_at DESC`,
        [learnerId]
      ),
      pool.query(
        `SELECT h.title, hs.status, hs.grade, hs.feedback, hs.submitted_at,
                c.name AS class_name, h.due_date
         FROM homework_submissions hs
         JOIN homework h ON h.id = hs.homework_id
         LEFT JOIN classes c ON c.id = h.class_id
         WHERE hs.learner_id = $1
         ORDER BY hs.submitted_at DESC`,
        [learnerId]
      ),
      pool.query(
        `SELECT ROUND(AVG(percentage), 2) AS overall_avg,
                COUNT(*) AS total_quizzes,
                COUNT(CASE WHEN percentage >= 50 THEN 1 END) AS passed,
                COUNT(CASE WHEN percentage < 50 THEN 1 END) AS failed
         FROM quiz_submissions WHERE learner_id = $1`,
        [learnerId]
      ),
    ]);

    if (learnerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Learner not found.' });
    }

    res.json({
      success: true,
      data: {
        learner: learnerRes.rows[0],
        quiz_history: quizRes.rows,
        homework_history: hwRes.rows,
        summary: progressRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/leaderboard  (teacher)
const leaderboard = async (req, res, next) => {
  try {
    const { class_id } = req.query;
    let query = `
      SELECT u.id, u.name,
             COUNT(qs.id) AS quizzes_taken,
             ROUND(AVG(qs.percentage), 2) AS avg_score,
             SUM(qs.score) AS total_score
      FROM users u
      JOIN quiz_submissions qs ON qs.learner_id = u.id
      JOIN quizzes q ON q.id = qs.quiz_id`;

    const params = [];
    if (class_id) {
      query += ' WHERE q.class_id = $1';
      params.push(class_id);
    }

    query += ` GROUP BY u.id, u.name
               HAVING COUNT(qs.id) > 0
               ORDER BY avg_score DESC, total_score DESC
               LIMIT 20`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { classPerformance, learnerPerformance, leaderboard };
