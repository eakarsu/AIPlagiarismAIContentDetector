const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Init ai_analyses table and api_keys quota column
const pool = require('./db');
const { aiRateLimiter } = require('./middleware/rateLimiter');

async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      analysis_type VARCHAR(100),
      entity_id INTEGER,
      entity_type VARCHAR(50),
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Add quota_limit column to api_keys if not present
  await pool.query(`
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS quota_limit INTEGER DEFAULT 1000
  `).catch(() => {});
}

initTables().catch(console.error);

// Routes
const auth = require('./middleware/auth');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/ai-detection', aiRateLimiter, require('./routes/aiDetection'));
app.use('/api/url-checker', require('./routes/urlChecker'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/writing-analysis', aiRateLimiter, require('./routes/writingAnalysis'));
app.use('/api/citations', require('./routes/citations'));
app.use('/api/paraphrase-detection', require('./routes/paraphraseDetection'));
app.use('/api/source-matching', require('./routes/sourceMatching'));
app.use('/api/batch-processing', require('./routes/batchProcessing'));
app.use('/api/students', require('./routes/students'));
app.use('/api/integrity-scores', aiRateLimiter, require('./routes/integrityScores'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/api-keys', require('./routes/apiKeys'));
app.use('/api/dashboard', require('./routes/dashboard'));

// New AI tool routes
const aiTools = require('./routes/aiTools');
app.use('/api/ai', aiTools);
app.use('/api/analyses', aiTools);

// Apply pass 5 — backlog extensions (cohorts, coaching, LTI stubs, Turnitin stub, monitor, ensemble, /ai aliases)
app.use('/api/ext', require('./routes/extensions'));

// AI History endpoint
app.get('/api/ai/history', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM ai_analyses WHERE user_id = $1',
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM ai_analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );

    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));


// === Custom Feature Mounts (batch_06) ===
app.use('/api/cf-agentic-plagiarism-monitoring', require('./routes/customFeat01_AgenticPlagiarismMonitoring'));
app.use('/api/cf-ai-generated-content-detection-ensemble', require('./routes/customFeat02_AiGeneratedContentDetectionEnsemble'));
app.use('/api/cf-paraphrase-detection', require('./routes/customFeat03_ParaphraseDetection'));
app.use('/api/cf-writing-style-fingerprinting', require('./routes/customFeat04_WritingStyleFingerprinting'));
app.use('/api/cf-student-writing-improvement', require('./routes/customFeat05_StudentWritingImprovement'));


// === Batch 06 Gaps & Frontend Mounts ===
app.use('/api/gap-existing-stub-files-aidetection-paraphrasedetectio', require('./routes/gapFeat_existing_stub_files_aidetection_paraphrasedetectio'));
app.use('/api/gap-no-style', require('./routes/gapFeat_no_style'));
app.use('/api/gap-no-cross', require('./routes/gapFeat_no_cross'));
app.use('/api/gap-no-real-lms-integration-canvas-blackboard', require('./routes/gapFeat_no_real_lms_integration_canvas_blackboard'));
app.use('/api/gap-no-student-feedback-workflows', require('./routes/gapFeat_no_student_feedback_workflows'));
app.use('/api/gap-no-integration-with-turnitin-other-plagiarism-serv', require('./routes/gapFeat_no_integration_with_turnitin_other_plagiarism_serv'));
app.use('/api/gap-limited-analytics-trends-across-courses-cohorts', require('./routes/gapFeat_limited_analytics_trends_across_courses_cohorts'));
app.use('/api/gap-webhook-scaffolding-present-but-not-wired-end', require('./routes/gapFeat_webhook_scaffolding_present_but_not_wired_end'));
app.use('/api/gap-no-notifications-module-grep-only-1', require('./routes/gapFeat_no_notifications_module_grep_only_1'));
app.use('/api/gap-only-7-frontend-pages-for-16', require('./routes/gapFeat_only_7_frontend_pages_for_16'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
