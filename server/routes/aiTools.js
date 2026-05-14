/**
 * AI Tools routes for AIPlagiarismAIContentDetector
 * - POST /api/ai/compare-documents
 * - POST /api/analyses/batch
 * - POST /api/ai/check-citations
 * - POST /api/ai/style-fingerprint
 */

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, parseAIJson } = require('../openrouter');
const router = express.Router();

// Helper: persist AI result
async function persistAIResult(userId, analysisType, entityId, entityType, result) {
  try {
    await pool.query(
      'INSERT INTO ai_analyses (user_id, analysis_type, entity_id, entity_type, result) VALUES ($1, $2, $3, $4, $5)',
      [userId, analysisType, entityId || null, entityType || 'ai_tool', JSON.stringify(result)]
    );
  } catch (e) {
    console.error('Failed to persist AI result:', e.message);
  }
}

// POST /api/ai/compare-documents
// Body: { text1: string, text2: string, title1?: string, title2?: string }
router.post('/compare-documents', auth, aiRateLimiter, async (req, res) => {
  try {
    const { text1, text2, title1, title2 } = req.body;
    if (!text1 || !text2) return res.status(400).json({ error: 'text1 and text2 are required.' });

    const prompt = `Compare these two documents for similarity, plagiarism, and content overlap. Respond ONLY with valid JSON in this exact format:
{
  "similarity_score": <number 0-100>,
  "plagiarism_score": <number 0-100>,
  "ai_generated_probability_doc1": <number 0-100>,
  "ai_generated_probability_doc2": <number 0-100>,
  "original_score_doc1": <number 0-100>,
  "original_score_doc2": <number 0-100>,
  "matching_passages": [
    {
      "doc1_excerpt": "<text from document 1>",
      "doc2_excerpt": "<text from document 2>",
      "similarity_percent": <number 0-100>,
      "type": "<verbatim|paraphrase|similar_idea>"
    }
  ],
  "flagged_sections": [
    {
      "text": "<flagged excerpt>",
      "document": "<doc1|doc2>",
      "reason": "<why flagged>",
      "severity": "<low|medium|high>"
    }
  ],
  "relationship": "<same_author|similar_source|copied|paraphrased|independent|unknown>",
  "overall_assessment": "<summary of the comparison>",
  "recommendations": ["<recommendation>"]
}

Document 1${title1 ? ` (${title1})` : ''}:
"""
${text1}
"""

Document 2${title2 ? ` (${title2})` : ''}:
"""
${text2}
"""`;

    const rawResult = await callOpenRouter(prompt, 'You are an expert document comparison and plagiarism detection system. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawResult);

    await persistAIResult(req.user.id, 'document_comparison', null, 'comparison', parsed || { raw: rawResult });

    res.json({
      success: true,
      comparison: parsed || rawResult,
      analyzed_at: new Date(),
    });
  } catch (err) {
    console.error('Compare documents error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analyses/batch
// Body: { texts: string[], job_title?: string }
// Note: mounted at /api/analyses, so the path here is /batch (not /analyses/batch)
router.post('/batch', auth, aiRateLimiter, async (req, res) => {
  try {
    const { texts, job_title } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'texts must be a non-empty array.' });
    }
    if (texts.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 texts per batch request.' });
    }

    const results = [];
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || typeof text !== 'string') {
        results.push({ index: i, error: 'Invalid text entry' });
        continue;
      }

      try {
        const prompt = `Analyze this text for plagiarism and AI-generated content. Respond ONLY with valid JSON in this exact format:
{
  "plagiarism_score": <number 0-100>,
  "ai_generated_probability": <number 0-100>,
  "original_score": <number 0-100>,
  "flagged_sections": [{"text": "<excerpt>", "reason": "<reason>", "severity": "<low|medium|high>"}],
  "overall_assessment": "<brief summary>",
  "recommendations": ["<recommendation>"]
}

Text to analyze:
"""
${text.substring(0, 3000)}
"""`;

        const rawResult = await callOpenRouter(prompt, 'You are an expert plagiarism and AI content detection system. Respond ONLY with valid JSON, no markdown.');
        const parsed = parseAIJson(rawResult);

        results.push({
          index: i,
          analysis: parsed || rawResult,
          text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        });
      } catch (err) {
        results.push({ index: i, error: err.message, text_preview: text.substring(0, 100) });
      }
    }

    await persistAIResult(req.user.id, 'batch_analysis', null, 'batch', { job_title, results });

    res.json({
      success: true,
      job_title: job_title || 'Batch Analysis',
      total_texts: texts.length,
      results,
      analyzed_at: new Date(),
    });
  } catch (err) {
    console.error('Batch analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/check-citations
// Body: { text: string, citation_style?: string }
router.post('/check-citations', auth, aiRateLimiter, async (req, res) => {
  try {
    const { text, citation_style } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required.' });

    const prompt = `Validate citations in the following text. Respond ONLY with valid JSON in this exact format:
{
  "citation_quality_score": <number 0-100>,
  "total_citations_found": <number>,
  "well_formatted_count": <number>,
  "citation_style_detected": "<APA|MLA|Chicago|Harvard|IEEE|Vancouver|mixed|none|unknown>",
  "format_compliance_score": <number 0-100>,
  "citations_analyzed": [
    {
      "citation_text": "<the citation as it appears>",
      "format_valid": <boolean>,
      "issues": ["<issue>"],
      "suggested_correction": "<corrected citation format>",
      "completeness_score": <number 0-100>
    }
  ],
  "missing_citations_for_claims": ["<claim that needs a citation>"],
  "overall_assessment": "<summary of citation quality>",
  "recommendations": ["<recommendation>"]
}

Citation Style Expected: ${citation_style || 'Auto-detect'}
Text with citations:
"""
${text}
"""`;

    const rawResult = await callOpenRouter(prompt, 'You are an expert citation and reference quality checker. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawResult);

    await persistAIResult(req.user.id, 'citation_check', null, 'citation_check', parsed || { raw: rawResult });

    res.json({
      success: true,
      citation_analysis: parsed || rawResult,
      analyzed_at: new Date(),
    });
  } catch (err) {
    console.error('Check citations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/style-fingerprint
// Body: { text: string, author_name?: string }
router.post('/style-fingerprint', auth, aiRateLimiter, async (req, res) => {
  try {
    const { text, author_name } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required.' });

    const prompt = `Analyze the writing style of this text to create a style fingerprint. Respond ONLY with valid JSON in this exact format:
{
  "avg_sentence_length_words": <number>,
  "sentence_length_variance": "<low|medium|high>",
  "vocabulary_complexity_score": <number 0-100>,
  "lexical_diversity_score": <number 0-100>,
  "passive_voice_percentage": <number 0-100>,
  "active_voice_percentage": <number 0-100>,
  "average_word_length_chars": <number>,
  "reading_grade_level": <number>,
  "flesch_kincaid_ease_estimate": <number 0-100>,
  "tone": "<formal|informal|academic|conversational|technical|journalistic>",
  "dominant_voice": "<first_person|second_person|third_person|mixed>",
  "punctuation_patterns": {
    "comma_frequency": "<low|medium|high>",
    "semicolon_usage": "<rare|occasional|frequent>",
    "em_dash_usage": "<none|rare|occasional|frequent>",
    "parenthetical_usage": "<none|rare|occasional|frequent>"
  },
  "sentence_structures": {
    "simple_sentence_percent": <number 0-100>,
    "compound_sentence_percent": <number 0-100>,
    "complex_sentence_percent": <number 0-100>
  },
  "distinctive_patterns": ["<unique stylistic feature>"],
  "transition_words_used": ["<common transition words found>"],
  "style_summary": "<narrative description of the writing style>",
  "cross_document_matching_notes": "<what features are most useful for identifying this author across documents>"
}

${author_name ? `Author: ${author_name}` : ''}
Text to analyze:
"""
${text}
"""`;

    const rawResult = await callOpenRouter(prompt, 'You are an expert computational linguistics and writing style analysis system. Respond ONLY with valid JSON, no markdown.');
    const parsed = parseAIJson(rawResult);

    await persistAIResult(req.user.id, 'style_fingerprint', null, 'style_fingerprint', parsed || { raw: rawResult });

    res.json({
      success: true,
      style_fingerprint: parsed || rawResult,
      author_name: author_name || null,
      analyzed_at: new Date(),
    });
  } catch (err) {
    console.error('Style fingerprint error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
