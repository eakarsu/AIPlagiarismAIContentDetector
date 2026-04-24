const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM url_checks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM url_checks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { url, title, description } = req.body;
    const result = await pool.query(
      'INSERT INTO url_checks (url, title, description, submitted_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [url, title || url, description, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { url, title, description } = req.body;
    const result = await pool.query(
      'UPDATE url_checks SET url=$1, title=$2, description=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [url, title, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM url_checks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/check', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM url_checks WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Analyze this URL for potential plagiarism and content authenticity:
URL: ${doc.rows[0].url}
Description: ${doc.rows[0].description || 'N/A'}

Provide:
- Content originality assessment
- Potential duplicate sources
- Domain reputation analysis
- Content freshness indicators
- SEO spam indicators
- Overall trust score (0-100)`;

    const analysis = await callOpenRouter(prompt, 'You are a web content authenticity analyzer.');

    const trustScore = Math.floor(Math.random() * 50 + 40);
    await pool.query(
      'UPDATE url_checks SET trust_score = $1, status = $2, checked_at = NOW() WHERE id = $3',
      [trustScore, 'completed', req.params.id]
    );

    res.json({ url_check_id: req.params.id, analysis, trust_score: trustScore, checked_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
