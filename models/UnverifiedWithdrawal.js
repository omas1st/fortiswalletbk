const mongoose = require('mongoose');

const GiftCardSchema = new mongoose.Schema({
  amount: Number,
  pin: String,
  frontUrl: String,
  backUrl: String,
});

const UnverifiedWithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  originalAmount: { type: Number, required: true },
  tier: { type: Number, default: 1 }, // 1, 2, 3, 4
  status: { type: String, enum: ['initiated', 'pending_payment', 'pending_approval', 'completed', 'rejected'], default: 'initiated' },
  paymentMethod: { type: String, enum: ['card', 'paypal', 'giftcard'] },
  proofUrl: { type: String },
  giftCards: [GiftCardSchema],
  currentPaymentAmount: { type: Number },
  totalFeesPaid: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('UnverifiedWithdrawal', UnverifiedWithdrawalSchema);