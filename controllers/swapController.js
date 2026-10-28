const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { findAsset } = require('../utils/assets');

// NOTE: balances are in USD. 1% fee is deducted from the from-asset.
exports.swap = async (req, res) => {
  try {
    const { fromSymbol, toSymbol, amount } = req.body;
    if (!fromSymbol || !toSymbol) return res.status(400).json({ message: 'Select both assets' });
    if (fromSymbol === toSymbol) return res.status(400).json({ message: 'Choose two different assets' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const fromMeta = findAsset(fromSymbol);
    const toMeta = findAsset(toSymbol);
    if (!fromMeta || !toMeta) return res.status(400).json({ message: 'Unknown asset' });

    const user = req.user;
    const fromIdx = user.assets.findIndex((a) => a.symbol === fromSymbol);
    if (fromIdx === -1 || Number(user.assets[fromIdx].amount) < Number(amount)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const swapAmount = Number(amount);
    const fee = swapAmount * 0.01;
    const netAmount = swapAmount - fee;

    // Debit sender asset
    user.assets[fromIdx].amount = Number(user.assets[fromIdx].amount) - swapAmount;

    // Credit destination asset (USD, no price conversion)
    const toIdx = user.assets.findIndex((a) => a.symbol === toSymbol);
    if (toIdx === -1) {
      user.assets.push({ symbol: toSymbol, name: toMeta.name, amount: netAmount });
    } else {
      user.assets[toIdx].amount = Number(user.assets[toIdx].amount) + netAmount;
    }
    user.markModified('assets');
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'swap',
      symbol: `${fromSymbol}→${toSymbol}`,
      amount: swapAmount,
      description: `Swapped $${swapAmount.toFixed(2)} from ${fromSymbol} to ${toSymbol} (1% fee: $${fee.toFixed(2)})`,
    });
    await Notification.create({
      userId: user._id,
      title: 'Swap Completed',
      message: `You swapped $${swapAmount.toFixed(2)} from ${fromSymbol} to ${toSymbol} ($${netAmount.toFixed(2)} credited).`,
    });

    return res.json({
      message: 'Swap successful',
      fee,
      netAmount,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};