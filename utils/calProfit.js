const AssetSetting = require('../models/AssetSetting');

async function calculateProfit(user) {
  const now = new Date();
  const lastUpdate = user.lastProfitUpdate || user.createdAt || now;
  
  // Calculate how many full days have passed
  const msPassed = now.getTime() - lastUpdate.getTime();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysPassed = Math.floor(msPassed / MS_PER_DAY); 

  if (daysPassed <= 0) return user; 

  const settings = await AssetSetting.find().lean();
  const percentMap = {};
  settings.forEach((s) => {
    percentMap[s.symbol] = Number(s.percent) || 0;
  });

  let changed = false;

  for (const asset of user.assets) {
    // Default fallback is 0.05% if for some reason the asset isn't in settings
    const dailyPct = percentMap[asset.symbol] ?? 0.05; 
    if (dailyPct > 0) {
      const rate = dailyPct / 100;
      
      const oldAmount = Number(asset.amount) || 0;
      // Compound interest formula for the number of days passed: A = P * (1 + r)^n
      const newAmount = oldAmount * Math.pow(1 + rate, daysPassed);
      const gained = newAmount - oldAmount;

      if (gained > 0) {
        asset.amount = newAmount;
        asset.profit = (Number(asset.profit) || 0) + gained;
        changed = true;
      }
    }
  }

  // Advance the lastProfitUpdate by the exact number of full days processed
  user.lastProfitUpdate = new Date(lastUpdate.getTime() + daysPassed * MS_PER_DAY);

  if (changed) {
    user.markModified('assets');
  }
  
  // Always save to ensure lastProfitUpdate advances
  await user.save();

  return user;
}

module.exports = { calculateProfit };