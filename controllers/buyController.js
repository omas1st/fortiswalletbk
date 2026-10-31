const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { findAsset } = require('../utils/assets');
const { notifyAdminAsync } = require('../config/mailer');
const { buildDashboard } = require('./userController');
const cloudinary = require('../config/cloudinary');
const { calculateProfit } = require('../utils/calProfit');

function uploadToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function loadGlobalSetting() {
  let global = await Setting.findOne({ key: 'global' });
  if (!global) {
    global = await Setting.create({
      key: 'global',
      paypalId: process.env.PAYPAL_ID || process.env.REACT_APP_PAYPAL_ID || 'payments@fortiswallet.com',
      cardLocked: false,
      paypalLocked: false,
      giftCardLocked: false,
    });
  }
  return global;
}

exports.getConfig = async (req, res) => {
  try {
    const global = await loadGlobalSetting();
    return res.json({
      paypalId: global.paypalId || process.env.PAYPAL_ID || 'payments@fortiswallet.com',
      cardLocked: !!global.cardLocked,
      paypalLocked: !!global.paypalLocked,
      giftCardLocked: !!global.giftCardLocked, 
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.uploadGiftCard = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'File is required' });
    }
    const side = req.body.side === 'back' ? 'back' : 'front';
    const result = await uploadToCloudinary(
      req.file.buffer,
      'fortis_wallet/giftcards',
      `user_${req.user._id}_gift_${side}_${Date.now()}`
    );
    return res.json({ url: result.secure_url });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.requestBuy = async (req, res) => {
  try {
    const { symbol, amount, method, cardLast4, cardName, giftCards, proofUrl } = req.body;
    const meta = findAsset(symbol);
    if (!meta) return res.status(400).json({ message: 'Invalid asset' });

    const global = await loadGlobalSetting();
    const chosen = method === 'paypal' ? 'paypal' : method === 'giftcard' ? 'giftcard' : 'card';

    if (global.cardLocked && global.paypalLocked && global.giftCardLocked) {
      return res.status(400).json({ message: 'All payment methods are currently unavailable.' });
    }
    if (chosen === 'card' && global.cardLocked) {
      return res.status(400).json({ message: 'Card payments are currently unavailable.' });
    }
    if (chosen === 'paypal' && global.paypalLocked) {
      return res.status(400).json({ message: 'PayPal is currently unavailable.' });
    }
    if (chosen === 'giftcard' && global.giftCardLocked) {
      return res.status(400).json({ message: 'Gift Card payments are currently unavailable.' });
    }
    if (chosen === 'paypal' && !proofUrl) {
      return res.status(400).json({ message: 'Proof of payment is required for PayPal.' });
    }

    const user = await calculateProfit(req.user);
    const dash = await buildDashboard(user);

    let totalAmount = Number(amount) || 0;
    let finalGiftCards = [];

    if (chosen === 'giftcard') {
      if (!Array.isArray(giftCards) || giftCards.length === 0) {
        return res.status(400).json({ message: 'No gift cards submitted' });
      }
      totalAmount = giftCards.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      if (totalAmount <= 0) {
        return res.status(400).json({ message: 'Total gift card amount must be greater than 0' });
      }
      finalGiftCards = giftCards.map(c => ({
        amount: Number(c.amount),
        pin: String(c.pin).trim(),
        frontUrl: c.frontUrl,
        backUrl: c.backUrl,
      }));
    } else {
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Invalid amount' });
    }

    const approval = await Approval.create({
      userId: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      symbol,
      amount: totalAmount,
      method: chosen,
      cardLast4,
      cardName,
      proofUrl,
      totalBalance: dash.totalBalance,
      status: 'pending',
      giftCards: finalGiftCards,
    });

    await Notification.create({
      userId: user._id,
      title: 'Payment Received — Processing',
      message: `We received your ${chosen} payment of $${totalAmount.toFixed(2)} for ${symbol}. Verification in progress.`,
    });

    let emailHtml = `<h3>New Buy Request</h3>
       <p><b>Name:</b> ${user.firstName} ${user.lastName}</p>
       <p><b>Email:</b> ${user.email}</p>
       <p><b>Method:</b> ${chosen.toUpperCase()}</p>
       <p><b>Asset:</b> ${symbol}</p>
       <p><b>Total Amount:</b> $${totalAmount.toFixed(2)}</p>
       <p><b>User Total Balance:</b> $${dash.totalBalance.toFixed(2)}</p>`;

    if (chosen === 'giftcard') {
      emailHtml += `<h4>Gift Cards Submitted:</h4><ul>`;
      finalGiftCards.forEach((c, i) => {
        emailHtml += `<li><b>Card ${i + 1}:</b> Amount $${c.amount}, Pin: ${c.pin}<br>
          <a href="${c.frontUrl}">Front Image</a> | <a href="${c.backUrl}">Back Image</a></li>`;
      });
      emailHtml += `</ul>`;
    } else if (chosen === 'paypal') {
      emailHtml += `<p><b>Proof of Payment:</b> <a href="${proofUrl}">Download Proof</a></p>`;
    } else if (cardLast4) {
      emailHtml += `<p><b>Card:</b> ****${cardLast4}</p>`;
    }

    emailHtml += `<p>Approve or reject this payment from the admin panel.</p>`;

    notifyAdminAsync(
      `New Buy Request — ${chosen} ($${totalAmount.toFixed(2)})`,
      emailHtml
    );

    return res.json({ message: 'Buy request submitted', approvalId: approval._id });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};