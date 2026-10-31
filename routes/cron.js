const router = require('express').Router();
const { applyIntervalIncrease } = require('../utils/cron');

router.get('/increase', async (req, res) => {
  try {
    const results = await applyIntervalIncrease();
    return res.json({ ok: true, message: 'Increase applied', results });
  } catch (err) {
    console.error('[cron] increase failed:', err);
    return res.status(500).json({ message: err.message || 'Cron failed' });
  }
});

module.exports = router;