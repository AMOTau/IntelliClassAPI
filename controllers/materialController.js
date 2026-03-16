const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// POST /api/materials/upload
const uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { title, description, class_id } = req.body;
    const filePath = req.file.path;
    const fileName = req.file.filename;
    const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    let extractedText = null;

    // Extract text from PDF
    if (fileType === 'pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text?.trim() || null;
      } catch (pdfErr) {
        console.warn('PDF text extraction failed:', pdfErr.message);
      }
    }

    // Extract text from plain text files
    if (fileType === 'txt') {
      try {
        extractedText = fs.readFileSync(filePath, 'utf8').trim();
      } catch (_) {}
    }

    const result = await pool.query(
      `INSERT INTO materials (title, description, file_path, file_name, file_type, extracted_text, teacher_id, class_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, file_name, file_type, class_id, created_at`,
      [
        title?.trim(),
        description?.trim() || null,
        filePath,
        fileName,
        fileType,
        extractedText,
        req.user.id,
        class_id || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Material uploaded successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/materials
const getMaterials = async (req, res, next) => {
  try {
    const { class_id } = req.query;
    let query, params;

    if (req.user.role === 'teacher') {
      query = `SELECT m.id, m.title, m.description, m.file_name, m.file_type, m.class_id,
                      c.name AS class_name, m.created_at
               FROM materials m
               LEFT JOIN classes c ON c.id = m.class_id
               WHERE m.teacher_id = $1`;
      params = [req.user.id];

      if (class_id) {
        query += ' AND m.class_id = $2';
        params.push(class_id);
      }
    } else {
      // Learner: only materials from enrolled classes
      query = `SELECT m.id, m.title, m.description, m.file_name, m.file_type, m.class_id,
                      c.name AS class_name, m.created_at
               FROM materials m
               JOIN classes c ON c.id = m.class_id
               JOIN class_enrollments ce ON ce.class_id = c.id
               WHERE ce.learner_id = $1`;
      params = [req.user.id];

      if (class_id) {
        query += ' AND m.class_id = $2';
        params.push(class_id);
      }
    }

    query += ' ORDER BY m.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/materials/:id
const getMaterialById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT m.*, c.name AS class_name, u.name AS teacher_name
       FROM materials m
       LEFT JOIN classes c ON c.id = m.class_id
       LEFT JOIN users u ON u.id = m.teacher_id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    // Learners can only access materials from their enrolled classes
    const material = result.rows[0];
    if (req.user.role === 'learner' && material.class_id) {
      const enrollment = await pool.query(
        'SELECT 1 FROM class_enrollments WHERE class_id = $1 AND learner_id = $2',
        [material.class_id, req.user.id]
      );
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    res.json({ success: true, data: material });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/materials/:id
const deleteMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM materials WHERE id = $1 AND teacher_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found or unauthorized.' });
    }

    const material = result.rows[0];

    // Delete physical file
    if (material.file_path && fs.existsSync(material.file_path)) {
      fs.unlinkSync(material.file_path);
    }

    await pool.query('DELETE FROM materials WHERE id = $1', [id]);
    res.json({ success: true, message: 'Material deleted.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/materials/:id/download
const downloadMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const material = result.rows[0];

    if (!material.file_path || !fs.existsSync(material.file_path)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    res.download(material.file_path, material.file_name);
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadMaterial, getMaterials, getMaterialById, deleteMaterial, downloadMaterial };
