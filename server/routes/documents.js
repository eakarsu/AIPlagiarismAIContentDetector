const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter, parseAIJson } = require('../openrouter');
const multer = require('multer');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/plain', 'application/pdf'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.txt') || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .pdf files are allowed'));
    }
  },
});

// POST /api/documents/upload — file upload endpoint
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let content = '';
    const { originalname, mimetype, buffer } = req.file;

    if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
      content = buffer.toString('utf8');
    } else if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      // Fallback: try to extract readable text from PDF buffer
      content = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!content || content.length < 20) {
        content = `[PDF file: ${originalname}. Content extraction requires a PDF parser.]`;
      }
    } else {
      content = buffer.toString('utf8');
    }

    const title = req.body.title || originalname.replace(/\.[^.]+$/, '');
    const result = await pool.query(
      'INSERT INTO documents (title, content, author, source_type, submitted_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, req.body.author || null, 'upload', req.user.id]
    );

    res.json({ success: true, document: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents?page=1&limit=20
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM documents');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, author, source_type } = req.body;
    const result = await pool.query(
      'INSERT INTO documents (title, content, author, source_type, submitted_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, author, source_type || 'text', req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, author, source_type } = req.body;
    const result = await pool.query(
      'UPDATE documents SET title=$1, content=$2, author=$3, source_type=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [title, content, author, source_type, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/scan', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Analyze the following text for plagiarism. Respond ONLY with valid JSON in this exact format:
{
  "plagiarism_percentage": <number 0-100>,
  "similarity_score": <number 0-100>,
  "matched_sources": [{"url": "<source url or description>", "similarity": <number>, "excerpt": "<matching text>"}],
  "ai_generated_probability": <number 0-100>,
  "findings": ["<key finding>"],
  "flagged_passages": ["<suspicious passage>"],
  "confidence_level": "<low|medium|high>",
  "recommendations": ["<recommendation>"]
}

Text to analyze:
"""
${doc.rows[0].content}
"""`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are an expert plagiarism detection system. Respond ONLY with valid JSON, no markdown.');

    const parsed = parseAIJson(rawAnalysis);
    const plagiarismScore = parsed && typeof parsed.plagiarism_percentage === 'number'
      ? Math.round(parsed.plagiarism_percentage)
      : null;

    await pool.query(
      'UPDATE documents SET plagiarism_score = $1, last_scanned = NOW() WHERE id = $2',
      [plagiarismScore, req.params.id]
    );

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'plagiarism_scan', req.params.id, 'document', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({
      document_id: req.params.id,
      analysis: parsed || rawAnalysis,
      plagiarism_score: plagiarismScore,
      scanned_at: new Date(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
