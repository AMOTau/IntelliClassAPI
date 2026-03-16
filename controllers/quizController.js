const pool = require('../config/db');

// POST /api/quizzes/create
const createQuiz = async (req, res, next) => {
  try {
    const { title, description, class_id, material_id, time_limit_minutes, due_date, questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one question is required.' });
    }

    const quizRes = await pool.query(
      `INSERT INTO quizzes (title, description, teacher_id, class_id, material_id, time_limit_minutes, due_date, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING *`,
      [title.trim(), description?.trim() || null, req.user.id, class_id || null, material_id || null,
       time_limit_minutes || null, due_date || null]
    );

    const quiz = quizRes.rows[0];

    // Insert questions
    const insertedQuestions = [];
    for (const q of questions) {
      const qRes = await pool.query(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [quiz.id, q.question_text, q.option_a, q.option_b, q.option_c || null,
         q.option_d || null, q.correct_answer.toUpperCase(), q.marks || 1]
      );
      insertedQuestions.push(qRes.rows[0]);
    }

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully.',
      data: { ...quiz, questions: insertedQuestions },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/quizzes/:id/publish
const publishQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE quizzes SET is_published = TRUE, updated_at = NOW()
       WHERE id = $1 AND teacher_id = $2 RETURNING *`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Quiz published.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/quizzes
const getQuizzes = async (req, res, next) => {
  try {
    const { class_id } = req.query;
    let query, params;

    if (req.user.role === 'teacher') {
      query = `SELECT q.*, c.name AS class_name, COUNT(qs.id) AS submission_count
               FROM quizzes q
               LEFT JOIN classes c ON c.id = q.class_id
               LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id
               WHERE q.teacher_id = $1`;
      params = [req.user.id];
      if (class_id) { query += ' AND q.class_id = $2'; params.push(class_id); }
      query += ' GROUP BY q.id, c.name ORDER BY q.created_at DESC';
    } else {
      // Learner
      query = `SELECT q.*, c.name AS class_name,
                      CASE WHEN qs.id IS NOT NULL THEN TRUE ELSE FALSE END AS attempted,
                      qs.score, qs.percentage
               FROM quizzes q
               JOIN classes c ON c.id = q.class_id
               JOIN class_enrollments ce ON ce.class_id = c.id AND ce.learner_id = $1
               LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.learner_id = $1
               WHERE q.is_published = TRUE`;
      params = [req.user.id];
      if (class_id) { query += ' AND q.class_id = $2'; params.push(class_id); }
      query += ' ORDER BY q.created_at DESC';
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/quizzes/:id
const getQuizById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quizRes = await pool.query(
      `SELECT q.*, c.name AS class_name, u.name AS teacher_name
       FROM quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       JOIN users u ON u.id = q.teacher_id
       WHERE q.id = $1`,
      [id]
    );

    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const quiz = quizRes.rows[0];

    // For learners, hide correct answers
    let questionQuery;
    if (req.user.role === 'learner') {
      questionQuery = `SELECT id, question_text, option_a, option_b, option_c, option_d, marks
                       FROM questions WHERE quiz_id = $1 ORDER BY created_at`;
    } else {
      questionQuery = `SELECT * FROM questions WHERE quiz_id = $1 ORDER BY created_at`;
    }

    const questionsRes = await pool.query(questionQuery, [id]);
    res.json({ success: true, data: { ...quiz, questions: questionsRes.rows } });
  } catch (err) {
    next(err);
  }
};

// POST /api/quizzes/:id/submit
const submitQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // { "question_uuid": "A", ... }
    const learnerId = req.user.id;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, message: 'Answers object is required.' });
    }

    // Check quiz exists and is published
    const quizRes = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1 AND is_published = TRUE',
      [id]
    );
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found or not published.' });
    }

    // Prevent re-submission
    const existingRes = await pool.query(
      'SELECT id FROM quiz_submissions WHERE quiz_id = $1 AND learner_id = $2',
      [id, learnerId]
    );
    if (existingRes.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'You have already submitted this quiz.' });
    }

    // Grade the submission
    const questionsRes = await pool.query(
      'SELECT id, correct_answer, marks FROM questions WHERE quiz_id = $1',
      [id]
    );

    let score = 0;
    let totalMarks = 0;
    const gradedAnswers = {};

    for (const q of questionsRes.rows) {
      totalMarks += q.marks;
      const submitted = answers[q.id]?.toUpperCase();
      const correct = q.correct_answer;
      gradedAnswers[q.id] = {
        submitted: submitted || null,
        correct,
        is_correct: submitted === correct,
      };
      if (submitted === correct) score += q.marks;
    }

    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    const submissionRes = await pool.query(
      `INSERT INTO quiz_submissions (quiz_id, learner_id, answers, score, total_marks, percentage)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, learnerId, JSON.stringify(answers), score, totalMarks, percentage.toFixed(2)]
    );

    res.status(201).json({
      success: true,
      message: 'Quiz submitted and graded.',
      data: {
        submission: submissionRes.rows[0],
        score,
        total_marks: totalMarks,
        percentage: parseFloat(percentage.toFixed(2)),
        graded_answers: gradedAnswers,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/quizzes/:id/results  (teacher)
const getQuizResults = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT qs.id, u.name AS learner_name, qs.score, qs.total_marks, qs.percentage, qs.submitted_at
       FROM quiz_submissions qs
       JOIN users u ON u.id = qs.learner_id
       WHERE qs.quiz_id = $1
       ORDER BY qs.percentage DESC`,
      [id]
    );

    const stats = await pool.query(
      `SELECT ROUND(AVG(percentage), 2) AS avg, MAX(percentage) AS highest, MIN(percentage) AS lowest, COUNT(*) AS total
       FROM quiz_submissions WHERE quiz_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        submissions: result.rows,
        stats: stats.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/quizzes/:id
const deleteQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM quizzes WHERE id = $1 AND teacher_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Quiz deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createQuiz, publishQuiz, getQuizzes, getQuizById, submitQuiz, getQuizResults, deleteQuiz };
