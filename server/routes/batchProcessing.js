const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter } = require('../openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM batch_jobs ORDER BY created_at DESC');
    res.json(result.rows);
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

    const prompt = `Process this batch analysis job:
Job Type: ${job.rows[0].job_type}
Title: ${job.rows[0].title}
Documents: ${job.rows[0].documents}

Provide a batch processing summary including:
1. Processing status for each document
2. Overall batch statistics
3. Common patterns found across documents
4. Aggregate risk assessment
5. Priority flagged items
6. Batch completion summary`;

    const analysis = await callOpenRouter(prompt, 'You are a batch document processing system.');

    await pool.query('UPDATE batch_jobs SET status = $1, processed_items = total_items, completed_at = NOW() WHERE id = $2',
      ['completed', req.params.id]);

    res.json({ job_id: req.params.id, analysis, completed_at: new Date() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
