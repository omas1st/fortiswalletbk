const AssetSetting = require('../models/AssetSetting');

async function calculateProfit(user) {
  const now = new Date();
  const lastUpdate = user.lastProfitUpdate || user.createdAt || now;
  
  // Calculate how many 5-minute intervals have passed
  const msPassed = now.getTime() - lastUpdate.getTime();
  const intervals = Math.floor(msPassed / (5 * 60 * 1000)); 

  if (intervals <= 0) return user; 

  const settings = await AssetSetting.find().lean();
  const percentMap = {};
  settings.forEach((s) => {
    percentMap[s.symbol] = Number(s.percent) || 0;
  });

  let changed = false;
  const INTERVALS_PER_DAY = 288; // 24h * 60m / 5m

  for (const asset of user.assets) {
    const dailyPct = percentMap[asset.symbol] ?? 1; 
    if (dailyPct > 0) {
      const intervalPct = dailyPct / INTERVALS_PER_DAY;
      const rate = intervalPct / 100;
      
      const oldAmount = Number(asset.amount) || 0;
      // Compound interest formula: A = P * (1 + r)^n
      const newAmount = oldAmount * Math.pow(1 + rate, intervals);
      const gained = newAmount - oldAmount;

      if (gained > 0) {
        asset.amount = newAmount;
        asset.profit = (Number(asset.profit) || 0) + gained;
        changed = true;
      }
    }
  }

  // Advance the lastProfitUpdate by the exact number of intervals processed
  user.lastProfitUpdate = new Date(lastUpdate.getTime() + intervals * 5 * 60 * 1000);

  if (changed) {
    user.markModified('assets');
  }
  
  // 🔧 CRITICAL FIX: We always save the user to ensure lastProfitUpdate advances
  await user.save();

  return user;
}

module.exports = { calculateProfit };