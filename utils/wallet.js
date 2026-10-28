const User = require('../models/User');

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '0123456789';

function generateWalletAddress() {
  const arr = [];
  for (let i = 0; i < 10; i++) arr.push(DIGITS[Math.floor(Math.random() * DIGITS.length)]);
  for (let i = 0; i < 6; i++) arr.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

async function generateUniqueWalletAddress() {
  for (let i = 0; i < 20; i++) {
    const addr = generateWalletAddress();
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne({ walletAddress: addr });
    if (!exists) return addr;
  }
  throw new Error('Could not generate unique wallet address');
}

module.exports = { generateWalletAddress, generateUniqueWalletAddress };