const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/submissions?page=1&limit=20
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM submissions');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM submissions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, student_name, course, assignment, content, submission_type } = req.body;
    const result = await pool.query(
      'INSERT INTO submissions (title, student_name, course, assignment, content, submission_type, submitted_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, student_name, course, assignment, content, submission_type || 'essay', req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, student_name, course, assignment, content, submission_type } = req.body;
    const result = await pool.query(
      'UPDATE submissions SET title=$1, student_name=$2, course=$3, assignment=$4, content=$5, submission_type=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [title, student_name, course, assignment, content, submission_type, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM submissions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
