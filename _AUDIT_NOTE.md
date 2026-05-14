# Audit Note — AIPlagiarismAIContentDetector

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_06.md` section #24.

## Original Recommendations
The audit said `0 AI endpoints per TSV`, but the codebase already exposes substantive AI endpoints:
- `aiDetection.js` (`POST /:id/analyze`)
- `writingAnalysis.js` (`POST /:id/analyze`)
- `paraphraseDetection.js` (`POST /:id/detect`)
- `aiTools.js` (`/compare-documents`, `/batch`, `/check-citations`, `/style-fingerprint`)
- `citations.js`, `documents.js`, `sourceMatching.js`, `integrityScores.js`, `reports.js`, `urlChecker.js`, `batchProcessing.js`

So the "all major AI functionality missing" finding is incorrect on inspection — TSV under-counted because endpoints are spread across many resource routes rather than one `ai.js`.

### Gaps — Non-AI Features
- LMS integration (Canvas, Blackboard)
- Student feedback workflows
- Turnitin integration
- Cohort/course analytics

### Custom Feature Suggestions
1. Agentic plagiarism monitoring
2. AI-content-detection ensemble
3. Paraphrase detection (already exists)
4. Writing-style fingerprinting (already exists)
5. Student writing improvement

## Implemented (Mechanical)
- None. The recommended `/detect-plagiarism`, `/detect-ai-content`, `/analyze-writing-style`, `/check-citations`, `/paraphrase-detect` endpoints already exist as resource-scoped routes.

## Backlog (deferred)

### NEEDS-PRODUCT-DECISION
- Surface a flat `/ai/detect-plagiarism`, `/ai/detect-ai-content`, etc. alias router for clients that expect the standard endpoint names — minor refactor, but unclear whether to break existing clients.
- Cohort/course-level analytics dashboards.
- Student-improvement coaching mode (privacy + assessment policy).

### NEEDS-CREDS / NEW-DEPS
- Canvas/Blackboard LTI integration.
- Turnitin/iThenticate API integration.

### TOO-RISKY
- Agentic plagiarism monitor (background polling/queue).
- Multi-detector ensemble (latency/cost; needs caching strategy).

## Apply pass 3 (frontend)

**Stack:** React (CRA) under `client/`, Node/Express backend under `server/`.

**FE already wired.** `client/src/App.js` exposes ~14 feature configs (documents, ai-detection, url-checker, writing-analysis, paraphrase-detection, source-matching, citations, reports, batch-processing, students, submissions, integrity-scores, api-keys) plus 5 dedicated AI pages: `CompareDocuments`, `BatchAnalysis`, `StyleFingerprint`, `CheckCitations`, `AIHistory`. `client/src/api.js` is an axios instance that injects `Authorization: Bearer <localStorage token>` on every request and auto-clears on 401. All major backend AI routes (`aiDetection.js`, `writingAnalysis.js`, `paraphraseDetection.js`, `aiTools.js`) are reachable from the UI.

**Files written/modified:** none.
**Syntax check:** N/A (no new code).

## Apply pass 4 (mechanical backlog)

**Action:** LEFT-AS-IS — no MECHANICAL items remain. Backlog entries are all NEEDS-PRODUCT-DECISION, NEEDS-CREDS, or TOO-RISKY (flat alias router, cohort analytics, student-improvement coaching, Canvas/Blackboard LTI, Turnitin integration, agentic monitor, multi-detector ensemble).

**Files modified:** none.

