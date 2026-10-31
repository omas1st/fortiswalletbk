const mongoose = require('mongoose');

const AssetSubSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    walletAddress: { type: String, required: true, unique: true, index: true },
    assets: [AssetSubSchema],
    resetCode: { type: String },
    resetCodeExpiry: { type: Date },
    lastProfitUpdate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// 🔧 FIX: Prevent OverwriteModelError by checking if it already exists
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);