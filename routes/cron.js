const router = require('express').Router();
const { applyDailyIncrease } = require('../utils/cron');

router.get('/daily-increase', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }
  try {
    await applyDailyIncrease();
    return res.json({ ok: true, message: 'Daily increase applied' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;