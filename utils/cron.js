const cron = require('node-cron');
const User = require('../models/User');
const AssetSetting = require('../models/AssetSetting');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

async function applyDailyIncrease() {
  console.log('Running daily increase...');
  const settings = await AssetSetting.find();
  const percentMap = {};
  settings.forEach((s) => {
    percentMap[s.symbol] = s.percent;
  });

  const users = await User.find();
  for (const user of users) {
    let changed = false;
    for (const asset of user.assets) {
      const pct = percentMap[asset.symbol] ?? 1;
      if (pct <= 0) continue;
      const gained = Number(asset.amount || 0) * (pct / 100);
      if (gained === 0) continue;
      asset.amount = Number(asset.amount || 0) + gained;
      asset.profit = Number(asset.profit || 0) + gained;
      changed = true;
    }
    if (changed) {
      user.markModified('assets');
      // eslint-disable-next-line no-await-in-loop
      await user.save();
      // eslint-disable-next-line no-await-in-loop
      await Transaction.create({
        userId: user._id,
        type: 'daily-increase',
        description: 'Daily asset increase applied',
      });
      // eslint-disable-next-line no-await-in-loop
      await Notification.create({
        userId: user._id,
        title: 'Daily Increase Applied',
        message: 'Your assets have been increased by their daily percentage.',
      });
    }
  }
  console.log('Daily increase done');
}

function startDailyIncreaseCron() {
  cron.schedule('0 0 * * *', () => {
    applyDailyIncrease().catch((e) => console.error('Cron error', e));
  });
  console.log('Daily increase cron scheduled');
}

module.exports = { startDailyIncreaseCron, applyDailyIncrease };