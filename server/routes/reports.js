const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, report_type, content, summary } = req.body;
    const result = await pool.query(
      'INSERT INTO reports (title, report_type, content, summary, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, report_type, content, summary, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, report_type, content, summary } = req.body;
    const result = await pool.query(
      'UPDATE reports SET title=$1, report_type=$2, content=$3, summary=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [title, report_type, content, summary, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/generate', auth, async (req, res) => {
  try {
    const report = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (report.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Generate a comprehensive ${report.rows[0].report_type} report based on:
Title: ${report.rows[0].title}
Content: ${report.rows[0].content}

Include:
- Executive summary
- Key findings
- Detailed analysis
- Risk assessment
- Recommendations
- Action items`;

    const analysis = await callOpenRouter(prompt, 'You are a professional report generator for academic integrity.');

    await pool.query('UPDATE reports SET ai_summary = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [analysis, 'completed', req.params.id]);

    res.json({ report_id: req.params.id, analysis, generated_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
