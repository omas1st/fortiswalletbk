const cron = require('node-cron');
const User = require('../models/User');
const AssetSetting = require('../models/AssetSetting');
const { ASSETS } = require('./assets');

/**
 * Applies the configured daily % increase to every user's assets.
 *
 * Design notes:
 *  - Uses ONE `updateMany` per asset symbol via an aggregation pipeline.
 *    This is atomic, runs in ~1-3s regardless of user count, and cannot
 *    partially complete like the old user-by-user loop (which is why the
 *    increase sometimes "didn't add up" on Vercel — the 60s function limit
 *    killed the loop halfway through).
 *  - Profit tracks how much of `amount` came from these increases:
 *      new_amount = old_amount + (old_amount * pct/100)
 *      new_profit = old_profit + (old_amount * pct/100)
 *  - No notification and no per-day transaction are created — the user
 *    only asked for the balance to grow, not to be pinged about it.
 */
async function applyDailyIncrease() {
  const settings = await AssetSetting.find().lean();
  const percentMap = {};
  for (const s of settings) {
    percentMap[s.symbol] = Number(s.percent) || 0;
  }

  // Defensive fallback: if the settings collection is empty (seed never ran),
  // default every platform asset to 1%/day so the increase still happens.
  if (Object.keys(percentMap).length === 0) {
    console.warn('[cron] AssetSetting empty — falling back to 1% for all assets');
    for (const a of ASSETS) percentMap[a.symbol] = 1;
  }

  const results = [];

  for (const [symbol, pct] of Object.entries(percentMap)) {
    if (!pct || pct <= 0) {
      results.push({ symbol, percent: pct, skipped: true });
      continue;
    }

    const fraction = pct / 100;

    // eslint-disable-next-line no-await-in-loop
    const res = await User.updateMany(
      { 'assets.symbol': symbol },
      [
        {
          $set: {
            assets: {
              $map: {
                input: { $ifNull: ['$assets', []] },
                as: 'a',
                in: {
                  $cond: [
                    { $eq: ['$$a.symbol', symbol] },
                    {
                      $mergeObjects: [
                        '$$a',
                        {
                          amount: {
                            $add: [
                              { $ifNull: ['$$a.amount', 0] },
                              { $multiply: [{ $ifNull: ['$$a.amount', 0] }, fraction] },
                            ],
                          },
                          profit: {
                            $add: [
                              { $ifNull: ['$$a.profit', 0] },
                              { $multiply: [{ $ifNull: ['$$a.amount', 0] }, fraction] },
                            ],
                          },
                        },
                      ],
                    },
                    '$$a',
                  ],
                },
              },
            },
          },
        },
      ]
    );

    results.push({
      symbol,
      percent: pct,
      matched: res.matchedCount,
      modified: res.modifiedCount,
    });
  }

  console.log('[cron] Daily increase applied:', JSON.stringify(results));
  return results;
}

function startDailyIncreaseCron() {
  // Local dev only. On Vercel this never runs (serverless) — the Vercel
  // Cron in vercel.json hits /api/cron/daily-increase instead.
  cron.schedule('0 0 * * *', () => {
    applyDailyIncrease().catch((e) => console.error('[cron] failed:', e));
  });
  console.log('Daily increase cron scheduled (node-cron, local only)');
}

module.exports = { startDailyIncreaseCron, applyDailyIncrease };