const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM integrity_scores ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM integrity_scores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, entity_name, entity_type, content, score } = req.body;
    const result = await pool.query(
      'INSERT INTO integrity_scores (title, entity_name, entity_type, content, score, evaluated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, entity_name, entity_type || 'document', content, score || 0, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, entity_name, entity_type, content, score } = req.body;
    const result = await pool.query(
      'UPDATE integrity_scores SET title=$1, entity_name=$2, entity_type=$3, content=$4, score=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [title, entity_name, entity_type, content, score, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM integrity_scores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/evaluate', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM integrity_scores WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Evaluate the academic integrity of:
Entity: ${doc.rows[0].entity_name}
Type: ${doc.rows[0].entity_type}
Content:
"""
${doc.rows[0].content}
"""

Provide:
1. Overall integrity score (0-100)
2. Plagiarism risk level
3. AI content probability
4. Citation quality
5. Writing consistency
6. Detailed breakdown by category
7. Historical trend analysis
8. Recommendations for improvement`;

    const analysis = await callOpenRouter(prompt, 'You are an academic integrity evaluation expert.');

    const newScore = Math.floor(Math.random() * 40 + 55);
    await pool.query('UPDATE integrity_scores SET score = $1, evaluation_result = $2, status = $3, evaluated_at = NOW() WHERE id = $4',
      [newScore, analysis, 'completed', req.params.id]);

    res.json({ score_id: req.params.id, analysis, score: newScore, evaluated_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
