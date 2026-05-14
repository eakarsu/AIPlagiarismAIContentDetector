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
    const countResult = await pool.query('SELECT COUNT(*) FROM ai_detections');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM ai_detections ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
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

    const prompt = `Analyze the following text to determine if it was written by an AI or a human. Respond ONLY with valid JSON in this exact format:
{
  "ai_probability": <number 0-100>,
  "confidence": "<low|medium|high>",
  "indicators": ["<indicator description>"],
  "verdict": "<human|ai|mixed>",
  "perplexity_assessment": "<low|medium|high>",
  "burstiness_assessment": "<low|medium|high>",
  "suspicious_passages": ["<suspicious text excerpt>"],
  "explanation": "<detailed explanation>"
}

Text to analyze:
"""
${doc.rows[0].content}
"""`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are an expert AI content detection system. Respond ONLY with valid JSON, no markdown.');

    const parsed = parseAIJson(rawAnalysis);
    const aiScore = parsed && typeof parsed.ai_probability === 'number'
      ? Math.round(parsed.ai_probability)
      : null;
    const humanScore = aiScore !== null ? 100 - aiScore : null;

    await pool.query(
      'UPDATE ai_detections SET ai_score = $1, human_score = $2, status = $3, analyzed_at = NOW() WHERE id = $4',
      [aiScore, humanScore, 'completed', req.params.id]
    );

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'ai_detection', req.params.id, 'ai_detection', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({
      detection_id: req.params.id,
      analysis: parsed || rawAnalysis,
      ai_score: aiScore,
      human_score: humanScore,
      analyzed_at: new Date(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
