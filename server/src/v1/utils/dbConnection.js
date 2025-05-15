const mongoose = require('mongoose');
const dbConnectionManager = require('./dbConnectionManager');

// MongoDB connection options to improve reliability and prevent timeouts
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
  socketTimeoutMS: 45000,         // Increase socket timeout
  family: 4,                      // Use IPv4, skip trying IPv6
  maxPoolSize: 10,                // Maximum number of connections in the pool
  connectTimeoutMS: 30000,        // Connection timeout
  keepAlive: true,                // Keep connection alive
  keepAliveInitialDelay: 300000   // 5 minutes initial delay for keepAlive
};

/**
 * Initialize MongoDB connection with improved options and error handling
 */
const connectToDatabase = async () => {
  try {
    await dbConnectionManager.connect(process.env.MONGODB_URL, mongooseOptions);
    console.log(`MongoDB connected successfully to ${process.env.MONGODB_URL}`);
    
    // Add event listeners for connection issues
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      await dbConnectionManager.disconnect();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    throw err;
  }
};

module.exports = {
  connectToDatabase,
  mongooseOptions,
  dbConnectionManager
};
