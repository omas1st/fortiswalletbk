const mongoose = require('mongoose');

const GiftCardSchema = new mongoose.Schema({
  amount: Number,
  pin: String,
  frontUrl: String,
  backUrl: String,
});

// 🔧 NEW: Schema for individual payment batches
const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  method: { type: String, enum: ['card', 'paypal', 'giftcard'], required: true },
  proofUrl: String,
  giftCards: [GiftCardSchema],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const UnverifiedWithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  originalAmount: { type: Number, required: true },
  tier: { type: Number, default: 1 }, // 1, 2, 3, 4
  status: { type: String, enum: ['initiated', 'pending_payment', 'pending_approval', 'completed', 'rejected'], default: 'initiated' },
  currentPaymentAmount: { type: Number },
  payments: [PaymentSchema], // 🔧 NEW: Tracks individual submissions
  
  // Legacy fields (kept for backwards compatibility with older records)
  paymentMethod: { type: String, enum: ['card', 'paypal', 'giftcard'] },
  proofUrl: { type: String },
  giftCards: [GiftCardSchema],
  totalFeesPaid: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('UnverifiedWithdrawal', UnverifiedWithdrawalSchema);