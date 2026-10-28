const router = require('express').Router();
const { applyDailyIncrease } = require('../utils/cron');

router.get('/daily-increase', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      console.warn('[cron] unauthorized daily-increase call');
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }

  try {
    const results = await applyDailyIncrease();
    return res.json({ ok: true, message: 'Daily increase applied', results });
  } catch (err) {
    console.error('[cron] daily-increase failed:', err);
    return res.status(500).json({ message: err.message || 'Cron failed' });
  }
});

module.exports = router;