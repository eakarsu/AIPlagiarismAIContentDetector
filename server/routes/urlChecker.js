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
    const countResult = await pool.query('SELECT COUNT(*) FROM url_checks');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM url_checks ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
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

    const prompt = `Analyze this URL for content authenticity and trustworthiness. Respond ONLY with valid JSON in this exact format:
{
  "trust_score": <number 0-100>,
  "originality_assessment": "<highly original|somewhat original|potentially duplicate|likely duplicate>",
  "domain_reputation": "<trusted|neutral|suspicious|unknown>",
  "content_type_assessment": "<news|academic|blog|commercial|social_media|unknown>",
  "freshness_indicators": "<likely fresh|possibly outdated|likely recycled>",
  "spam_indicators": ["<indicator if any>"],
  "red_flags": ["<red flag if any>"],
  "positive_signals": ["<positive signal>"],
  "recommended_action": "<use as source|verify independently|avoid|bookmark for review>",
  "explanation": "<detailed explanation>"
}

URL: ${doc.rows[0].url}
Description: ${doc.rows[0].description || 'N/A'}`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are a web content authenticity analyzer. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawAnalysis);

    const trustScore = parsed && typeof parsed.trust_score === 'number'
      ? Math.round(parsed.trust_score)
      : null;

    await pool.query(
      'UPDATE url_checks SET trust_score = $1, status = $2, checked_at = NOW() WHERE id = $3',
      [trustScore, 'completed', req.params.id]
    );

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'url_check', req.params.id, 'url_check', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({ url_check_id: req.params.id, analysis: parsed || rawAnalysis, trust_score: trustScore, checked_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
