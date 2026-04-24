const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM citations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM citations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, citation_style, references } = req.body;
    const result = await pool.query(
      'INSERT INTO citations (title, content, citation_style, references_text, submitted_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, citation_style || 'APA', references, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, citation_style, references } = req.body;
    const result = await pool.query(
      'UPDATE citations SET title=$1, content=$2, citation_style=$3, references_text=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [title, content, citation_style, references, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM citations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/verify', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM citations WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Verify citations in the following document:
Style: ${doc.rows[0].citation_style}
Content:
"""
${doc.rows[0].content}
"""
References:
"""
${doc.rows[0].references_text || 'None provided'}
"""

Check:
1. Citation format correctness
2. Missing citations for claims
3. Citation-reference matching
4. Proper attribution
5. Self-plagiarism indicators
6. Overall citation quality score (0-100)`;

    const analysis = await callOpenRouter(prompt, 'You are a citation and reference verification expert.');

    await pool.query('UPDATE citations SET verification_result = $1, status = $2, verified_at = NOW() WHERE id = $3',
      [analysis, 'completed', req.params.id]);

    res.json({ citation_id: req.params.id, analysis, verified_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
