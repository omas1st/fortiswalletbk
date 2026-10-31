const mongoose = require('mongoose');

const GiftCardSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  pin: { type: String, required: true },
  frontUrl: { type: String },
  backUrl: { type: String },
});

const ApprovalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String },
    email: { type: String },
    symbol: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: 'card' }, // 'card', 'paypal', 'giftcard'
    cardLast4: { type: String },
    cardName: { type: String },
    proofUrl: { type: String }, // 🔧 NEW: For PayPal proof
    totalBalance: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    giftCards: [GiftCardSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Approval', ApprovalSchema);