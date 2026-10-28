const mongoose = require('mongoose');

const AssetSettingSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  percent: { type: Number, default: 1 },
});

module.exports = mongoose.model('AssetSetting', AssetSettingSchema);