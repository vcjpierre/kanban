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
 * Optimizada para entornos serverless y tradicionales
 */
const connectToDatabase = async () => {
  try {
    // Verificar que la URL de MongoDB esté definida
    const mongoDbUrl = process.env.MONGODB_URL;
    
    if (!mongoDbUrl) {
      const error = new Error('MONGODB_URL environment variable is not defined');
      console.error('MongoDB connection error:', error);
      throw error;
    }
    
    // Eliminar posible información sensible para los logs
    const sanitizedUrl = mongoDbUrl.replace(/:([^:@]+)@/, ':***@');
    
    // Conectar a la base de datos
    await dbConnectionManager.connect(mongoDbUrl, mongooseOptions);
    console.log(`MongoDB connected successfully to ${sanitizedUrl}`);
    
    // Add event listeners for connection issues (solo si no están ya configurados)
    if (mongoose.connection.listenerCount('error') === 0) {
      mongoose.connection.on('error', err => {
        console.error('MongoDB connection error:', err);
      });
    }
    
    if (mongoose.connection.listenerCount('disconnected') === 0) {
      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected. Will reconnect on next request.');
      });
    }
    
    // Graceful shutdown handling (solo para entornos no serverless)
    if (process.env.NODE_ENV !== 'production' && 
        process.listenerCount('SIGINT') === 0) {
      process.on('SIGINT', async () => {
        await dbConnectionManager.disconnect();
        console.log('MongoDB connection closed due to app termination');
        process.exit(0);
      });
    }
    
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
