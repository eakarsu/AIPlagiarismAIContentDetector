const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM writing_analyses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM writing_analyses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, author, genre } = req.body;
    const result = await pool.query(
      'INSERT INTO writing_analyses (title, content, author, genre, submitted_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, author, genre, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, author, genre } = req.body;
    const result = await pool.query(
      'UPDATE writing_analyses SET title=$1, content=$2, author=$3, genre=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [title, content, author, genre, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM writing_analyses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM writing_analyses WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Perform a comprehensive writing style analysis on:
Title: ${doc.rows[0].title}
Author: ${doc.rows[0].author || 'Unknown'}
Genre: ${doc.rows[0].genre || 'General'}

Text:
"""
${doc.rows[0].content}
"""

Analyze:
1. Writing style fingerprint (formal/informal, active/passive voice usage)
2. Vocabulary complexity (Flesch-Kincaid grade level)
3. Sentence structure patterns
4. Tone and voice consistency
5. Readability metrics
6. Unique stylistic markers
7. Comparison to typical writing in this genre
8. Consistency score (0-100)`;

    const analysis = await callOpenRouter(prompt, 'You are an expert writing style analyst and forensic linguist.');

    await pool.query('UPDATE writing_analyses SET analysis_result = $1, status = $2, analyzed_at = NOW() WHERE id = $3',
      [analysis, 'completed', req.params.id]);

    res.json({ analysis_id: req.params.id, analysis, analyzed_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
