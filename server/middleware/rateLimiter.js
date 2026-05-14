const rateLimit = require('express-rate-limit');
// Apply pass 5: pre-existing breakage — the prior keyGenerator returned `req.ip` directly,
// which fails the IPv6 validator in newer express-rate-limit versions and crashes the process
// on the first hit. Use the library-provided `ipKeyGenerator` helper for IP fallback.
const { ipKeyGenerator } = require('express-rate-limit');

const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req, res) => {
    return (req.user && req.user.id) ? String(req.user.id) : ipKeyGenerator(req, res);
  },
  message: { error: 'Too many AI requests. Limit is 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter };
