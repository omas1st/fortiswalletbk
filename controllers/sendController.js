const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { findAsset } = require('../utils/assets');

exports.lookup = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.json({ valid: false, message: 'Wallet address required' });
    const user = await User.findOne({ walletAddress: walletAddress.trim() });
    if (!user) return res.json({ valid: false, message: 'Wallet address not found' });
    return res.json({
      valid: true,
      name: `${user.firstName} ${user.lastName}`,
      userId: user._id,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// NOTE: amounts are in USD.
exports.send = async (req, res) => {
  try {
    const { walletAddress, symbol, amount } = req.body;
    if (!walletAddress || !symbol || !amount) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const amountNum = Number(amount);
    if (amountNum <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const meta = findAsset(symbol);
    if (!meta) return res.status(400).json({ message: 'Invalid asset' });

    const sender = req.user;
    const receiver = await User.findOne({ walletAddress: walletAddress.trim() });
    if (!receiver) return res.status(404).json({ message: 'Receiver wallet not found' });
    if (String(receiver._id) === String(sender._id)) {
      return res.status(400).json({ message: 'Cannot send to yourself' });
    }

    const senderIdx = sender.assets.findIndex((a) => a.symbol === symbol);
    if (senderIdx === -1 || Number(sender.assets[senderIdx].amount) < amountNum) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    sender.assets[senderIdx].amount = Number(sender.assets[senderIdx].amount) - amountNum;
    sender.markModified('assets');
    await sender.save();

    // Credit receiver by index (fixes mongoose ref-loss bug)
    const rIdx = receiver.assets.findIndex((a) => a.symbol === symbol);
    if (rIdx === -1) {
      receiver.assets.push({ symbol, name: meta.name, amount: amountNum });
    } else {
      receiver.assets[rIdx].amount = Number(receiver.assets[rIdx].amount) + amountNum;
    }
    receiver.markModified('assets');
    await receiver.save();

    await Transaction.create({
      userId: sender._id,
      type: 'send-out',
      symbol,
      amount: amountNum,
      description: `Sent $${amountNum.toFixed(2)} of ${symbol} to ${receiver.firstName} ${receiver.lastName}`,
    });
    await Transaction.create({
      userId: receiver._id,
      type: 'send-in',
      symbol,
      amount: amountNum,
      description: `Received $${amountNum.toFixed(2)} of ${symbol} from ${sender.firstName} ${sender.lastName}`,
    });
    await Notification.create({
      userId: sender._id,
      title: 'Sent Successfully',
      message: `You sent $${amountNum.toFixed(2)} of ${symbol} to ${receiver.firstName} ${receiver.lastName}.`,
    });
    await Notification.create({
      userId: receiver._id,
      title: 'Received',
      message: `You received $${amountNum.toFixed(2)} of ${symbol} from ${sender.firstName} ${sender.lastName}.`,
    });

    return res.json({ message: 'Transfer successful' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};