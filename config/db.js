const mongoose = require('mongoose');

let connectPromise = null;

module.exports = async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (connectPromise) return connectPromise;

  connectPromise = mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB connected');
    })
    .catch((err) => {
      connectPromise = null;
      console.error('MongoDB connection error:', err.message);
      throw err;
    });

  return connectPromise;
};