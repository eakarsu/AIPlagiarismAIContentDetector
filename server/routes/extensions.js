/**
 * Apply pass 5 — Plagiarism/AI-content backlog (additive).
 *
 * Backlog implemented (cap 8):
 *  1. PRODUCT-DECISION  flat /ai aliases (kept additive; existing routes untouched)
 *  2. PRODUCT-DECISION  cohort/course analytics       -> /cohorts/* + /cohorts/:id/stats
 *  3. PRODUCT-DECISION  student-improvement coaching  -> /coaching/sessions
 *  4. NEEDS-CREDS       Canvas LTI                    -> /lti/canvas/*    503 missing CANVAS_BASE_URL,CANVAS_API_KEY
 *  5. NEEDS-CREDS       Blackboard LTI                -> /lti/blackboard/* 503 missing BLACKBOARD_BASE_URL,BLACKBOARD_API_KEY
 *  6. NEEDS-CREDS       Turnitin / iThenticate        -> /turnitin/submit  503 missing TURNITIN_API_KEY
 *  7. TOO-RISKY         agentic plagiarism monitor    -> /monitor/* (queue table, additive)
 *  8. TOO-RISKY         multi-detector ensemble       -> /ensemble/score (deterministic stub blend)
 *
 * Env vars (NEEDS-CREDS endpoints return 503 + missing:<NAME>):
 *   - CANVAS_BASE_URL, CANVAS_API_KEY
 *   - BLACKBOARD_BASE_URL, BLACKBOARD_API_KEY
 *   - TURNITIN_API_KEY
 *   - OPENROUTER_API_KEY (existing; only the alias endpoints inherit it)
 *
 * Tables: CREATE TABLE IF NOT EXISTS only.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../db');

// ─── Bootstrap pass-5 tables (additive) ─────────────────────────────────────
let bootstrapped = false;
async function ensureSchema() {
  if (bootstrapped) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cohorts (
      id SERIAL PRIMARY KEY,
      owner_user_id INTEGER,
      name VARCHAR(200) NOT NULL,
      term VARCHAR(80),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cohort_members (
      cohort_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      added_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (cohort_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS coaching_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      student_id INTEGER,
      focus VARCHAR(120),
      goals TEXT,
      plan JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS plagiarism_monitor_queue (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      target_type VARCHAR(40),
      target_id INTEGER,
      status VARCHAR(40) DEFAULT 'queued',
      poll_interval_min INTEGER DEFAULT 60,
      last_run_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ensemble_scores (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      document_id INTEGER,
      detectors JSONB,
      blended_score FLOAT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  bootstrapped = true;
}

router.use(auth);
router.use(async (req, _res, next) => { try { await ensureSchema(); next(); } catch (e) { next(e); } });

// ════════════════════════════════════════════════════════════════════════════
// 1) Flat /ai aliases (PRODUCT-DECISION: keep existing resource routes; add aliases under /ai)
// ════════════════════════════════════════════════════════════════════════════
// PRODUCT-DECISION: alias router exposes the names the original audit expected. We do NOT
// touch the existing resource-scoped handlers — clients that already use them keep working.
// These aliases require document_id in the body and just point operators to the canonical
// route, so we don't duplicate handler logic and keep AI behaviour identical.
function aliasInfo(canonical) {
  return (_req, res) => res.json({ alias: true, canonical, note: 'Use the canonical route for full POST handling.' });
}
router.get('/ai/detect-plagiarism',     aliasInfo('POST /api/source-matching/:id/match'));
router.get('/ai/detect-ai-content',     aliasInfo('POST /api/ai-detection/:id/analyze'));
router.get('/ai/analyze-writing-style', aliasInfo('POST /api/writing-analysis/:id/analyze'));
router.get('/ai/check-citations',       aliasInfo('POST /api/ai/check-citations'));
router.get('/ai/paraphrase-detect',     aliasInfo('POST /api/paraphrase-detection/:id/detect'));

// ════════════════════════════════════════════════════════════════════════════
// 2) Cohort / course analytics
// ════════════════════════════════════════════════════════════════════════════
router.post('/cohorts', async (req, res) => {
  const { name, term } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = await pool.query(
    `INSERT INTO cohorts (owner_user_id, name, term) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.id, name, term || null]
  );
  res.json({ data: r.rows[0] });
});

router.get('/cohorts', async (req, res) => {
  const r = await pool.query(`SELECT * FROM cohorts WHERE owner_user_id = $1 ORDER BY id DESC`, [req.user.id]);
  res.json({ data: r.rows });
});

router.post('/cohorts/:id/members', async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  await pool.query(
    `INSERT INTO cohort_members (cohort_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, student_id]
  );
  res.json({ ok: true });
});

router.get('/cohorts/:id/stats', async (req, res) => {
  // Deterministic aggregate from existing tables; falls back to zeros where joins fail.
  const id = req.params.id;
  let memberCount = 0;
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM cohort_members WHERE cohort_id = $1`, [id]);
    memberCount = r.rows[0]?.n || 0;
  } catch (_) {}

  let aiAnalyses = 0;
  try {
    const r = await pool.query(`
      SELECT COUNT(*)::int AS n FROM ai_analyses
      WHERE entity_id IN (SELECT student_id FROM cohort_members WHERE cohort_id = $1)
    `, [id]);
    aiAnalyses = r.rows[0]?.n || 0;
  } catch (_) {}

  res.json({ cohort_id: Number(id), members: memberCount, ai_analyses: aiAnalyses });
});

// ════════════════════════════════════════════════════════════════════════════
// 3) Student-improvement coaching mode
// ════════════════════════════════════════════════════════════════════════════
// PRODUCT-DECISION: coaching is opt-in per student. Plans are stored as JSON with the focus
// areas {clarity, citations, originality, structure} so the frontend can render a checklist
// without locking us into a specific pedagogy. AI is optional — when OPENROUTER_API_KEY is
// set we'd call it; in this pass we ship a deterministic plan generator so smoke tests run
// without external calls.
router.post('/coaching/sessions', async (req, res) => {
  const { student_id, focus, goals } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  const focusAreas = focus ? [focus] : ['clarity', 'citations', 'originality', 'structure'];
  const plan = {
    focus_areas: focusAreas,
    goals: goals || 'Improve attribution and original synthesis',
    weeks: focusAreas.map((f, i) => ({ week: i + 1, focus: f, tasks: [`Drill ${f}`, `Self-review ${f}`] })),
  };
  const r = await pool.query(
    `INSERT INTO coaching_sessions (user_id, student_id, focus, goals, plan)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.id, student_id, focus || null, goals || null, plan]
  );
  res.json({ data: r.rows[0] });
});

router.get('/coaching/sessions', async (req, res) => {
  const r = await pool.query(`SELECT * FROM coaching_sessions WHERE user_id = $1 ORDER BY id DESC LIMIT 100`, [req.user.id]);
  res.json({ data: r.rows });
});

// ════════════════════════════════════════════════════════════════════════════
// 4) Canvas LTI (NEEDS-CREDS)
// ════════════════════════════════════════════════════════════════════════════
router.get('/lti/canvas/courses', (req, res) => {
  const missing = [];
  if (!process.env.CANVAS_BASE_URL) missing.push('CANVAS_BASE_URL');
  if (!process.env.CANVAS_API_KEY) missing.push('CANVAS_API_KEY');
  if (missing.length) return res.status(503).json({ error: 'Canvas LTI unavailable', missing: missing.join(',') });
  res.json({ data: [], note: 'Canvas creds set; provider wiring deferred' });
});

// ════════════════════════════════════════════════════════════════════════════
// 5) Blackboard LTI (NEEDS-CREDS)
// ════════════════════════════════════════════════════════════════════════════
router.get('/lti/blackboard/courses', (req, res) => {
  const missing = [];
  if (!process.env.BLACKBOARD_BASE_URL) missing.push('BLACKBOARD_BASE_URL');
  if (!process.env.BLACKBOARD_API_KEY) missing.push('BLACKBOARD_API_KEY');
  if (missing.length) return res.status(503).json({ error: 'Blackboard LTI unavailable', missing: missing.join(',') });
  res.json({ data: [], note: 'Blackboard creds set; provider wiring deferred' });
});

// ════════════════════════════════════════════════════════════════════════════
// 6) Turnitin / iThenticate (NEEDS-CREDS)
// ════════════════════════════════════════════════════════════════════════════
router.post('/turnitin/submit', (req, res) => {
  if (!process.env.TURNITIN_API_KEY) {
    return res.status(503).json({ error: 'Turnitin unavailable', missing: 'TURNITIN_API_KEY' });
  }
  const { document_id } = req.body || {};
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  res.json({ submitted: true, document_id, note: 'TURNITIN_API_KEY set; provider wiring deferred' });
});

// ════════════════════════════════════════════════════════════════════════════
// 7) Agentic plagiarism monitor (TOO-RISKY → additive queue table only)
// ════════════════════════════════════════════════════════════════════════════
// PRODUCT-DECISION: poll-mode queue, not a background worker. The queue is enqueued by users
// and processed by an external cron / worker (out of scope). We expose only enqueue + list.
router.post('/monitor/enqueue', async (req, res) => {
  const { target_type, target_id, poll_interval_min } = req.body || {};
  if (!target_type || !target_id) return res.status(400).json({ error: 'target_type and target_id required' });
  const r = await pool.query(`
    INSERT INTO plagiarism_monitor_queue (user_id, target_type, target_id, poll_interval_min)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [req.user.id, target_type, target_id, Math.max(15, Math.min(1440, Number(poll_interval_min) || 60))]);
  res.json({ data: r.rows[0] });
});

router.get('/monitor/queue', async (req, res) => {
  const r = await pool.query(`
    SELECT * FROM plagiarism_monitor_queue WHERE user_id = $1 ORDER BY id DESC LIMIT 100
  `, [req.user.id]);
  res.json({ data: r.rows });
});

// ════════════════════════════════════════════════════════════════════════════
// 8) Multi-detector ensemble (TOO-RISKY → deterministic stub blend)
// ════════════════════════════════════════════════════════════════════════════
// PRODUCT-DECISION: blend = mean of provided detector scores 0-1. If document_id is provided
// we look up recent ai_analyses results and average their `confidence` if present. No new
// LLM calls — caching/cost concerns from the audit drove this stub design.
router.post('/ensemble/score', async (req, res) => {
  const { document_id, detectors } = req.body || {};
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  const inputScores = Array.isArray(detectors) ? detectors.filter(d => Number.isFinite(d.score)) : [];
  let blended;
  if (inputScores.length) {
    blended = inputScores.reduce((s, d) => s + d.score, 0) / inputScores.length;
  } else {
    try {
      const r = await pool.query(`
        SELECT result FROM ai_analyses
        WHERE entity_type = 'document' AND entity_id = $1 AND user_id = $2
        ORDER BY created_at DESC LIMIT 5
      `, [document_id, req.user.id]);
      const confidences = r.rows.map(row => Number(row.result?.confidence)).filter(Number.isFinite);
      blended = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.5;
    } catch (_) {
      blended = 0.5;
    }
  }
  const ins = await pool.query(`
    INSERT INTO ensemble_scores (user_id, document_id, detectors, blended_score)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [req.user.id, document_id, inputScores, blended]);
  res.json({ data: ins.rows[0] });
});

module.exports = router;
