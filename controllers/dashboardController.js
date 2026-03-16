const pool = require('../config/db');

// GET /api/dashboard/teacher
const teacherDashboard = async (req, res, next) => {
  try {
    const teacherId = req.user.id;

    const [classesRes, materialsRes, quizzesRes, homeworkRes, recentSubmissionsRes] =
      await Promise.all([
        pool.query('SELECT COUNT(*) FROM classes WHERE teacher_id = $1', [teacherId]),
        pool.query('SELECT COUNT(*) FROM materials WHERE teacher_id = $1', [teacherId]),
        pool.query('SELECT COUNT(*) FROM quizzes WHERE teacher_id = $1', [teacherId]),
        pool.query('SELECT COUNT(*) FROM homework WHERE teacher_id = $1', [teacherId]),
        pool.query(
          `SELECT hs.id, u.name AS learner_name, h.title AS homework_title, hs.submitted_at, hs.status
           FROM homework_submissions hs
           JOIN users u ON u.id = hs.learner_id
           JOIN homework h ON h.id = hs.homework_id
           WHERE h.teacher_id = $1
           ORDER BY hs.submitted_at DESC LIMIT 10`,
          [teacherId]
        ),
      ]);

    // Class average scores
    const avgScoresRes = await pool.query(
      `SELECT c.name AS class_name, ROUND(AVG(qs.percentage), 2) AS avg_score
       FROM quiz_submissions qs
       JOIN quizzes q ON q.id = qs.quiz_id
       JOIN classes c ON c.id = q.class_id
       WHERE q.teacher_id = $1
       GROUP BY c.name`,
      [teacherId]
    );

    res.json({
      success: true,
      data: {
        stats: {
          total_classes: parseInt(classesRes.rows[0].count),
          total_materials: parseInt(materialsRes.rows[0].count),
          total_quizzes: parseInt(quizzesRes.rows[0].count),
          total_homework: parseInt(homeworkRes.rows[0].count),
        },
        recent_submissions: recentSubmissionsRes.rows,
        class_averages: avgScoresRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/learner
const learnerDashboard = async (req, res, next) => {
  try {
    const learnerId = req.user.id;

    const [
      enrolledClassesRes,
      pendingHomeworkRes,
      quizResultsRes,
      upcomingQuizzesRes,
    ] = await Promise.all([
      pool.query(
        `SELECT c.id, c.name, c.subject, c.grade, u.name AS teacher_name
         FROM class_enrollments ce
         JOIN classes c ON c.id = ce.class_id
         JOIN users u ON u.id = c.teacher_id
         WHERE ce.learner_id = $1`,
        [learnerId]
      ),
      pool.query(
        `SELECT h.id, h.title, h.due_date, c.name AS class_name,
                CASE WHEN hs.id IS NOT NULL THEN TRUE ELSE FALSE END AS submitted
         FROM homework h
         JOIN classes c ON c.id = h.class_id
         JOIN class_enrollments ce ON ce.class_id = c.id AND ce.learner_id = $1
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.learner_id = $1
         WHERE hs.id IS NULL AND (h.due_date IS NULL OR h.due_date >= NOW())
         ORDER BY h.due_date ASC LIMIT 10`,
        [learnerId]
      ),
      pool.query(
        `SELECT qs.id, q.title AS quiz_title, qs.score, qs.total_marks, qs.percentage, qs.submitted_at
         FROM quiz_submissions qs
         JOIN quizzes q ON q.id = qs.quiz_id
         WHERE qs.learner_id = $1
         ORDER BY qs.submitted_at DESC LIMIT 10`,
        [learnerId]
      ),
      pool.query(
        `SELECT q.id, q.title, q.due_date, c.name AS class_name
         FROM quizzes q
         JOIN classes c ON c.id = q.class_id
         JOIN class_enrollments ce ON ce.class_id = c.id AND ce.learner_id = $1
         LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.learner_id = $1
         WHERE q.is_published = TRUE AND qs.id IS NULL
           AND (q.due_date IS NULL OR q.due_date >= NOW())
         ORDER BY q.due_date ASC LIMIT 5`,
        [learnerId]
      ),
    ]);

    const avgRes = await pool.query(
      `SELECT ROUND(AVG(percentage), 2) AS overall_average
       FROM quiz_submissions WHERE learner_id = $1`,
      [learnerId]
    );

    res.json({
      success: true,
      data: {
        enrolled_classes: enrolledClassesRes.rows,
        pending_homework: pendingHomeworkRes.rows,
        recent_quiz_results: quizResultsRes.rows,
        upcoming_quizzes: upcomingQuizzesRes.rows,
        overall_average: parseFloat(avgRes.rows[0].overall_average) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/parent
const parentDashboard = async (req, res, next) => {
  try {
    const parentId = req.user.id;

    // Get linked learners
    const learnersRes = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM parent_learner pl
       JOIN users u ON u.id = pl.learner_id
       WHERE pl.parent_id = $1`,
      [parentId]
    );

    const learners = learnersRes.rows;

    // For each learner, get summary
    const summaries = await Promise.all(
      learners.map(async (learner) => {
        const [quizRes, hwRes] = await Promise.all([
          pool.query(
            `SELECT ROUND(AVG(percentage), 2) AS avg_score, COUNT(*) AS quizzes_taken
             FROM quiz_submissions WHERE learner_id = $1`,
            [learner.id]
          ),
          pool.query(
            `SELECT COUNT(*) AS submitted
             FROM homework_submissions WHERE learner_id = $1`,
            [learner.id]
          ),
        ]);
        return {
          ...learner,
          avg_quiz_score: parseFloat(quizRes.rows[0].avg_score) || 0,
          quizzes_taken: parseInt(quizRes.rows[0].quizzes_taken),
          homework_submitted: parseInt(hwRes.rows[0].submitted),
        };
      })
    );

    res.json({ success: true, data: { learners: summaries } });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/admin
const adminDashboard = async (req, res, next) => {
  try {
    const [usersRes, classesRes, quizzesRes, materialsRes] = await Promise.all([
      pool.query(
        `SELECT role, COUNT(*) AS count FROM users WHERE is_active = TRUE GROUP BY role`
      ),
      pool.query('SELECT COUNT(*) FROM classes'),
      pool.query('SELECT COUNT(*) FROM quizzes'),
      pool.query('SELECT COUNT(*) FROM materials'),
    ]);

    const usersByRole = {};
    usersRes.rows.forEach((r) => (usersByRole[r.role] = parseInt(r.count)));

    res.json({
      success: true,
      data: {
        users_by_role: usersByRole,
        total_classes: parseInt(classesRes.rows[0].count),
        total_quizzes: parseInt(quizzesRes.rows[0].count),
        total_materials: parseInt(materialsRes.rows[0].count),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { teacherDashboard, learnerDashboard, parentDashboard, adminDashboard };
