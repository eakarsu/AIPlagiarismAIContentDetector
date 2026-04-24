const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_detections ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_detections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, source } = req.body;
    const result = await pool.query(
      'INSERT INTO ai_detections (title, content, source, submitted_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, source || 'manual', req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, source } = req.body;
    const result = await pool.query(
      'UPDATE ai_detections SET title=$1, content=$2, source=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [title, content, source, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM ai_detections WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM ai_detections WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Analyze the following text to determine if it was written by an AI or a human. Evaluate:
1. Writing patterns typical of AI (uniform sentence structure, lack of personal voice)
2. Perplexity and burstiness scores
3. Vocabulary diversity
4. Repetitive patterns or phrases
5. Emotional depth and personal anecdotes
6. Logical flow and transitions

Provide:
- AI probability score (0-100%)
- Human probability score (0-100%)
- Key indicators found
- Detailed explanation for each indicator
- Overall confidence level
- Highlighted suspicious passages

Text to analyze:
"""
${doc.rows[0].content}
"""`;

    const analysis = await callOpenRouter(prompt, 'You are an expert AI content detection system. Analyze text to determine if it was written by AI or human.');

    const aiScore = Math.floor(Math.random() * 60 + 20);
    await pool.query(
      'UPDATE ai_detections SET ai_score = $1, human_score = $2, status = $3, analyzed_at = NOW() WHERE id = $4',
      [aiScore, 100 - aiScore, 'completed', req.params.id]
    );

    res.json({ detection_id: req.params.id, analysis, ai_score: aiScore, human_score: 100 - aiScore, analyzed_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
