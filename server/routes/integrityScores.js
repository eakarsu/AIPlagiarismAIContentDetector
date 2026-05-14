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
    const countResult = await pool.query('SELECT COUNT(*) FROM integrity_scores');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM integrity_scores ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
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

    const prompt = `Evaluate the academic integrity of the following content. Respond ONLY with valid JSON in this exact format:
{
  "integrity_score": <number 0-100>,
  "risk_level": "<low|medium|high|critical>",
  "violations": ["<violation description>"],
  "plagiarism_risk": <number 0-100>,
  "ai_content_probability": <number 0-100>,
  "citation_quality": <number 0-100>,
  "writing_consistency": <number 0-100>,
  "recommendations": ["<recommendation>"],
  "summary": "<overall assessment>"
}

Entity: ${doc.rows[0].entity_name}
Type: ${doc.rows[0].entity_type}
Content:
"""
${doc.rows[0].content}
"""`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are an academic integrity evaluation expert. Respond ONLY with valid JSON, no markdown.');

    const parsed = parseAIJson(rawAnalysis);
    const newScore = parsed && typeof parsed.integrity_score === 'number'
      ? Math.round(parsed.integrity_score)
      : null;

    await pool.query(
      'UPDATE integrity_scores SET score = $1, evaluation_result = $2, status = $3, evaluated_at = NOW() WHERE id = $4',
      [newScore, typeof parsed === 'object' ? JSON.stringify(parsed) : rawAnalysis, 'completed', req.params.id]
    );

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'integrity_evaluation', req.params.id, 'integrity_score', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({ score_id: req.params.id, analysis: parsed || rawAnalysis, score: newScore, evaluated_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
