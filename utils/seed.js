const AssetSetting = require('../models/AssetSetting');
const Setting = require('../models/Setting');
const { ASSETS } = require('./assets');

async function seedAssetSettings() {
  for (const a of ASSETS) {
    // eslint-disable-next-line no-await-in-loop
    await AssetSetting.updateOne(
      { symbol: a.symbol },
      { $setOnInsert: { symbol: a.symbol, name: a.name, percent: 1 } },
      { upsert: true }
    );
  }
  console.log('Asset settings seeded');
}

async function seedGlobalSettings() {
  const existing = await Setting.findOne({ key: 'global' });
  if (!existing) {
    await Setting.create({
      key: 'global',
      paypalId: process.env.PAYPAL_ID || process.env.REACT_APP_PAYPAL_ID || 'payments@fortiswallet.com',
      cardLocked: false,
      paypalLocked: false,
    });
    console.log('Global settings seeded');
  }
}

module.exports = { seedAssetSettings, seedGlobalSettings };