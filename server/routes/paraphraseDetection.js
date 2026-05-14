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
    const countResult = await pool.query('SELECT COUNT(*) FROM paraphrase_detections');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM paraphrase_detections ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM paraphrase_detections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, original_text, comparison_text } = req.body;
    const result = await pool.query(
      'INSERT INTO paraphrase_detections (title, original_text, comparison_text, submitted_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, original_text, comparison_text, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, original_text, comparison_text } = req.body;
    const result = await pool.query(
      'UPDATE paraphrase_detections SET title=$1, original_text=$2, comparison_text=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [title, original_text, comparison_text, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM paraphrase_detections WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/detect', auth, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM paraphrase_detections WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const prompt = `Compare these two texts for paraphrasing detection. Respond ONLY with valid JSON in this exact format:
{
  "similarity_score": <number 0-100>,
  "paraphrase_probability": <number 0-100>,
  "paraphrasing_techniques": ["<technique used>"],
  "matching_passages": [{"original": "<excerpt>", "comparison": "<matching excerpt>", "similarity": <number>}],
  "vocabulary_overlap_percent": <number 0-100>,
  "structural_similarity": "<high|medium|low>",
  "verdict": "<likely_paraphrase|possible_paraphrase|original|identical>",
  "confidence": "<high|medium|low>",
  "explanation": "<detailed explanation of findings>"
}

Original Text:
"""
${doc.rows[0].original_text}
"""

Comparison Text:
"""
${doc.rows[0].comparison_text}
"""`;

    const rawAnalysis = await callOpenRouter(prompt, 'You are a paraphrase detection expert. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawAnalysis);

    const similarity = parsed && typeof parsed.similarity_score === 'number'
      ? Math.round(parsed.similarity_score)
      : null;

    await pool.query('UPDATE paraphrase_detections SET similarity_score = $1, status = $2, analyzed_at = NOW() WHERE id = $3',
      [similarity, 'completed', req.params.id]);

    // Save to ai_analyses
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'paraphrase_detection', req.params.id, 'paraphrase_detection', JSON.stringify(parsed || { raw: rawAnalysis })]
    ).catch(() => {});

    res.json({ detection_id: req.params.id, analysis: parsed || rawAnalysis, similarity_score: similarity, analyzed_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
