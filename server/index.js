const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/ai-detection', require('./routes/aiDetection'));
app.use('/api/url-checker', require('./routes/urlChecker'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/writing-analysis', require('./routes/writingAnalysis'));
app.use('/api/citations', require('./routes/citations'));
app.use('/api/paraphrase-detection', require('./routes/paraphraseDetection'));
app.use('/api/source-matching', require('./routes/sourceMatching'));
app.use('/api/batch-processing', require('./routes/batchProcessing'));
app.use('/api/students', require('./routes/students'));
app.use('/api/integrity-scores', require('./routes/integrityScores'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/api-keys', require('./routes/apiKeys'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
