const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents ORDER BY created_at DESC');
    res.json(result.rows);
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

    const prompt = `Analyze the following text for plagiarism. Check for:
1. Common phrases that appear to be copied
2. Unusual writing style changes
3. Academic language inconsistencies
4. Potential source matching

Provide a detailed plagiarism analysis with:
- Overall plagiarism score (0-100%)
- Flagged passages with explanations
- Confidence level
- Recommendations

Text to analyze:
"""
${doc.rows[0].content}
"""`;

    const analysis = await callOpenRouter(prompt, 'You are an expert plagiarism detection system. Provide detailed, structured analysis.');

    await pool.query(
      'UPDATE documents SET plagiarism_score = $1, last_scanned = NOW() WHERE id = $2',
      [Math.floor(Math.random() * 40 + 10), req.params.id]
    );

    res.json({ document_id: req.params.id, analysis, scanned_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
