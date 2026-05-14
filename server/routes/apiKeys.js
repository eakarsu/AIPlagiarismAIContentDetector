const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM api_keys ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM api_keys WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, permissions, rate_limit, quota_limit } = req.body;
    const apiKey = `apd_${uuidv4().replace(/-/g, '')}`;
    const result = await pool.query(
      'INSERT INTO api_keys (name, api_key, permissions, rate_limit, quota_limit, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, apiKey, permissions || 'read', rate_limit || 1000, quota_limit || 1000, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, permissions, rate_limit, quota_limit, status } = req.body;
    const result = await pool.query(
      'UPDATE api_keys SET name=$1, permissions=$2, rate_limit=$3, quota_limit=$4, status=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, permissions, rate_limit, quota_limit, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM api_keys WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware to check and enforce API key quota
// Usage: checkApiKeyQuota(key) — updates usage_count and checks limit
async function checkApiKeyQuota(apiKey) {
  const result = await pool.query('SELECT * FROM api_keys WHERE api_key = $1', [apiKey]);
  if (result.rows.length === 0) {
    throw { status: 401, message: 'Invalid API key' };
  }
  const row = result.rows[0];
  if (row.status !== 'active') {
    throw { status: 403, message: 'API key is inactive' };
  }
  const quotaLimit = row.quota_limit || 1000;
  const currentUsage = row.usage_count || 0;
  if (currentUsage >= quotaLimit) {
    throw { status: 429, message: `API key quota exceeded (${currentUsage}/${quotaLimit})` };
  }
  // Increment usage
  await pool.query(
    'UPDATE api_keys SET usage_count = usage_count + 1 WHERE api_key = $1',
    [apiKey]
  );
  return row;
}

module.exports = router;
module.exports.checkApiKeyQuota = checkApiKeyQuota;
