require('dotenv').config();

async function callOpenRouter(prompt, systemPrompt = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const baseUrl = process.env.OPENROUTER_BASE_URL;
  if (!apiKey || !model || !baseUrl) throw new Error('OpenRouter key, model, and base URL are required');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Plagiarism Detector',
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) throw new Error('OpenRouter returned empty content');
  return content;
}

/**
 * Parse JSON from AI response using 3 strategies:
 * 1. Direct JSON.parse
 * 2. Extract from markdown code block
 * 3. Find first {...} block
 */
function parseAIJson(content) {
  // Strategy 1: direct parse
  try {
    return JSON.parse(content);
  } catch {}

  // Strategy 2: extract from markdown code block
  const blockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) {
    try {
      return JSON.parse(blockMatch[1].trim());
    } catch {}
  }

  // Strategy 3: find first { ... } block
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

module.exports = { callOpenRouter, parseAIJson };
