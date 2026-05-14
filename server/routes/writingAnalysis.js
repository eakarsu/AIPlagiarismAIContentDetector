const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter, parseAIJson } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM writing_analyses');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM writing_analyses ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
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

    const prompt = `Perform a comprehensive writing style analysis. Respond ONLY with valid JSON in this exact format:
{
  "readability_score": <number 0-100>,
  "vocabulary_richness": <number 0-100>,
  "style_consistency": <number 0-100>,
  "grammar_score": <number 0-100>,
  "flesch_kincaid_grade": <number>,
  "voice": "<active|passive|mixed>",
  "tone": "<formal|informal|academic|conversational|technical>",
  "sentence_complexity": "<simple|moderate|complex>",
  "unique_stylistic_markers": ["<marker>"],
  "strengths": ["<strength>"],
  "weaknesses": ["<weakness>"],
  "genre_fit": "<how well it matches the genre>",
  "summary": "<overall assessment>"
}

Text to analyze:
Title: ${doc.rows[0].title}
Author: ${doc.rows[0].author || 'Unknown'}
Genre: ${doc.rows[0].genre || 'General'}

"""
${doc.rows[0].content}
"""`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are an expert writing style analyst. Respond ONLY with valid JSON, no markdown.');

    const parsed = parseAIJson(rawAnalysis);

    await pool.query('UPDATE writing_analyses SET analysis_result = $1, status = $2, analyzed_at = NOW() WHERE id = $3',
      [typeof parsed === 'object' ? JSON.stringify(parsed) : rawAnalysis, 'completed', req.params.id]);

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'writing_analysis', req.params.id, 'writing_analysis', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({ analysis_id: req.params.id, analysis: parsed || rawAnalysis, analyzed_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
