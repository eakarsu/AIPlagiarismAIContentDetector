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
    const countResult = await pool.query('SELECT COUNT(*) FROM citations');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM citations ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
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

    const prompt = `Verify citations in the following document. Respond ONLY with valid JSON in this exact format:
{
  "citation_quality_score": <number 0-100>,
  "format_compliance_score": <number 0-100>,
  "citation_style_detected": "<APA|MLA|Chicago|Harvard|IEEE|Vancouver|mixed|unknown>",
  "format_errors": [{"citation": "<cited text>", "issue": "<what is wrong>", "correction": "<suggested fix>"}],
  "missing_citations": ["<claim that lacks a citation>"],
  "citation_reference_mismatches": ["<description of mismatch>"],
  "self_plagiarism_indicators": ["<indicator>"],
  "attribution_issues": ["<issue>"],
  "well_formatted_citations": <number>,
  "total_citations_found": <number>,
  "recommendations": ["<recommendation>"],
  "overall_assessment": "<summary>"
}

Citation Style: ${doc.rows[0].citation_style}
Document Content:
"""
${doc.rows[0].content}
"""
References:
"""
${doc.rows[0].references_text || 'None provided'}
"""`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are a citation and reference verification expert. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawAnalysis);

    await pool.query('UPDATE citations SET verification_result = $1, status = $2, verified_at = NOW() WHERE id = $3',
      [typeof parsed === 'object' ? JSON.stringify(parsed) : rawAnalysis, 'completed', req.params.id]);

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'citation_verification', req.params.id, 'citation', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({ citation_id: req.params.id, analysis: parsed || rawAnalysis, verified_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
