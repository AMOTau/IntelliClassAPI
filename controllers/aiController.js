const pool = require('../config/db');
const aiService = require('../services/aiService');

// POST /api/ai/generate-quiz
const generateQuiz = async (req, res, next) => {
  try {
    const { material_id, num_questions = 5 } = req.body;

    if (!material_id) {
      return res.status(400).json({ success: false, message: 'material_id is required.' });
    }

    const materialRes = await pool.query(
      'SELECT * FROM materials WHERE id = $1 AND teacher_id = $2',
      [material_id, req.user.id]
    );

    if (materialRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found or unauthorized.' });
    }

    const material = materialRes.rows[0];

    if (!material.extracted_text || material.extracted_text.trim().length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Not enough extracted text from the material to generate a quiz. Please ensure the material contains readable text.',
      });
    }

    // Call AI service
    const questions = await aiService.generateQuizQuestions(
      material.extracted_text,
      parseInt(num_questions)
    );

    res.json({
      success: true,
      message: `${questions.length} question(s) generated. Review and publish to create the quiz.`,
      data: { material_id, material_title: material.title, questions },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { generateQuiz };
