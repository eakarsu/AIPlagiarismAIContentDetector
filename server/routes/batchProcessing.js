const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter, parseAIJson } = require('../openrouter');
const router = express.Router();

// GET /api/batch-processing?page=1&limit=20
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM batch_jobs');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM batch_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM batch_jobs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, job_type, documents, priority } = req.body;
    const result = await pool.query(
      'INSERT INTO batch_jobs (title, job_type, documents, priority, total_items, submitted_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, job_type, JSON.stringify(documents || []), priority || 'normal', documents?.length || 0, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, job_type, priority } = req.body;
    const result = await pool.query(
      'UPDATE batch_jobs SET title=$1, job_type=$2, priority=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [title, job_type, priority, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM batch_jobs WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/process', auth, async (req, res) => {
  try {
    const job = await pool.query('SELECT * FROM batch_jobs WHERE id = $1', [req.params.id]);
    if (job.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const jobRow = job.rows[0];

    // Set status to processing immediately
    await pool.query(
      'UPDATE batch_jobs SET status = $1 WHERE id = $2',
      ['processing', req.params.id]
    );

    // Return 202 immediately
    res.status(202).json({ status: 'processing', job_id: req.params.id, message: 'Batch job started asynchronously' });

    // Process asynchronously
    setImmediate(async () => {
      try {
        const prompt = `Process this batch analysis job and provide a summary. Respond ONLY with valid JSON:
{
  "batch_summary": "<overall summary>",
  "documents_processed": <number>,
  "common_patterns": ["<pattern>"],
  "aggregate_risk": "<low|medium|high>",
  "flagged_items": <number>,
  "recommendations": ["<recommendation>"]
}

Job Type: ${jobRow.job_type}
Title: ${jobRow.title}
Documents: ${jobRow.documents}`;

        const rawResult = await callOpenRouter(prompt, 'You are a batch document processing system. Respond ONLY with valid JSON.');
        const parsed = parseAIJson(rawResult);

        await pool.query(
          'UPDATE batch_jobs SET status = $1, processed_items = total_items, completed_at = NOW() WHERE id = $2',
          ['completed', jobRow.id]
        );
      } catch (err) {
        console.error('Batch processing async error:', err.message);
        await pool.query(
          'UPDATE batch_jobs SET status = $1 WHERE id = $2',
          ['failed', jobRow.id]
        ).catch(() => {});
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
