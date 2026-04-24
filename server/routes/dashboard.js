const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/stats', auth, async (req, res) => {
  try {
    const [docs, detections, urls, reports, submissions, students] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM documents'),
      pool.query('SELECT COUNT(*) as count FROM ai_detections'),
      pool.query('SELECT COUNT(*) as count FROM url_checks'),
      pool.query('SELECT COUNT(*) as count FROM reports'),
      pool.query('SELECT COUNT(*) as count FROM submissions'),
      pool.query('SELECT COUNT(*) as count FROM students'),
    ]);
    res.json({
      documents: parseInt(docs.rows[0].count),
      ai_detections: parseInt(detections.rows[0].count),
      url_checks: parseInt(urls.rows[0].count),
      reports: parseInt(reports.rows[0].count),
      submissions: parseInt(submissions.rows[0].count),
      students: parseInt(students.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
