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
    const countResult = await pool.query('SELECT COUNT(*) FROM source_matches');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM source_matches ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM source_matches WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, search_scope } = req.body;
    const result = await pool.query(
      'INSERT INTO source_matches (title, content, search_scope, submitted_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, search_scope || 'web', req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, search_scope } = req.body;
    const result = await pool.query(
      'UPDATE source_matches SET title=$1, content=$2, search_scope=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [title, content, search_scope, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM source_matches WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/match', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM source_matches WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Find potential original sources for this text. Respond ONLY with valid JSON in this exact format:
{
  "matches_found": <number>,
  "overall_confidence": "<high|medium|low>",
  "potential_sources": [
    {
      "source_description": "<description of likely source>",
      "confidence_percent": <number 0-100>,
      "matching_passage": "<excerpt that likely appears in source>",
      "probable_database": "<where to find this source>",
      "estimated_publication_year": "<year or range>",
      "attribution_suggestion": "<suggested author/title>"
    }
  ],
  "common_phrases": ["<highly specific phrase likely from a source>"],
  "originality_assessment": "<how original the text appears>",
  "recommendations": ["<recommendation for proper attribution>"]
}

Text to find sources for:
"""
${doc.rows[0].content}
"""

Search Scope: ${doc.rows[0].search_scope}`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are a source matching and attribution expert. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawAnalysis);

    const matchCount = parsed && typeof parsed.matches_found === 'number'
      ? parsed.matches_found
      : (parsed && parsed.potential_sources ? parsed.potential_sources.length : 0);

    await pool.query('UPDATE source_matches SET matches_found = $1, status = $2, matched_at = NOW() WHERE id = $3',
      [matchCount, 'completed', req.params.id]);

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'source_matching', req.params.id, 'source_match', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({ match_id: req.params.id, analysis: parsed || rawAnalysis, matches_found: matchCount, matched_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
