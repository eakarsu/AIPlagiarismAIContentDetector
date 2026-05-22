const router = require('express').Router();

router.post('/score', (req, res) => {
  const { similarityScore = 0, aiScore = 0, citationErrorRate = 0, paraphraseScore = 0, draftCount = 1 } = req.body || {};
  const score = Math.min(100, Math.round(
    Number(similarityScore) * 0.35 +
    Number(aiScore) * 0.25 +
    Number(citationErrorRate) * 0.2 +
    Number(paraphraseScore) * 0.15 +
    Math.max(0, 3 - Number(draftCount)) * 8
  ));

  res.json({
    feature: 'originality_risk_triage',
    score,
    level: score >= 70 ? 'escalate' : score >= 40 ? 'review' : 'clear',
    actions: [
      Number(citationErrorRate) > 30 && 'Require citation correction before integrity review.',
      Number(paraphraseScore) > 55 && 'Compare suspicious passages against known source clusters.',
      Number(aiScore) > 65 && 'Request process evidence such as outline, notes, and revision history.',
    ].filter(Boolean),
  });
});

module.exports = router;
