const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('restored UI boundary contains product workflow and failure handling', () => {
  const appPath = path.join(__dirname, '..', 'src', 'App.js');
  const app = fs.readFileSync(appPath, 'utf8');
  assert.match(app, /AI Plagiarism & AI Content Detector/);
  assert.match(app, /status: 'loading'/);
  assert.match(app, /status: 'error'/);
  assert.match(app, /Retry connection/);
  assert.ok(app.includes("Submit a document for analysis"));
  assert.ok(app.includes("Review source matches"));
  assert.ok(app.includes("Export an integrity report"));
});
