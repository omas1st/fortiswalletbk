// Fixed prices (USD) used to compute user balances.
// Admin-controlled daily % increase is applied on the asset AMOUNT.
const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', price: 67000 },
  { symbol: 'ETH', name: 'Ethereum', price: 3500 },
  { symbol: 'USDT', name: 'Tether', price: 1 },
  { symbol: 'BNB', name: 'BNB', price: 600 },
  { symbol: 'SOL', name: 'Solana', price: 150 },
  { symbol: 'XRP', name: 'XRP', price: 0.5 },
  { symbol: 'ADA', name: 'Cardano', price: 0.45 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.15 },
  { symbol: 'MATIC', name: 'Polygon', price: 0.7 },
  { symbol: 'DOT', name: 'Polkadot', price: 7 },
  { symbol: 'LTC', name: 'Litecoin', price: 80 },
  { symbol: 'TRX', name: 'TRON', price: 0.12 },
  { symbol: 'AVAX', name: 'Avalanche', price: 35 },
  { symbol: 'LINK', name: 'Chainlink', price: 15 },
  { symbol: 'USDC', name: 'USD Coin', price: 1 },
];

const findAsset = (symbol) => ASSETS.find((a) => a.symbol === symbol);
const priceOf = (symbol) => {
  const a = findAsset(symbol);
  return a ? a.price : 0;
};

module.exports = { ASSETS, findAsset, priceOf };