const express = require('express');
const router = express.Router();
const {
  uploadMaterial, getMaterials, getMaterialById, deleteMaterial, downloadMaterial,
} = require('../controllers/materialController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// POST /api/materials/upload  (teacher only)
router.post(
  '/upload',
  authenticate,
  authorize('teacher'),
  upload.single('file'),
  uploadMaterial
);

// GET /api/materials  (teacher and learner)
router.get('/', authenticate, authorize('teacher', 'learner'), getMaterials);

// GET /api/materials/:id
router.get('/:id', authenticate, authorize('teacher', 'learner'), getMaterialById);

// GET /api/materials/:id/download
router.get('/:id/download', authenticate, authorize('teacher', 'learner'), downloadMaterial);

// DELETE /api/materials/:id  (teacher only)
router.delete('/:id', authenticate, authorize('teacher'), deleteMaterial);

module.exports = router;
