const mongoose = require('mongoose');

/**
 * Checks the health of the MongoDB connection
 * @returns {Object} Status of the MongoDB connection
 */
const checkDatabaseConnection = async () => {
  try {
    const state = mongoose.connection.readyState;
    let status;
    
    switch (state) {
      case 0:
        status = { connected: false, state: 'disconnected', message: 'MongoDB is disconnected' };
        break;
      case 1:
        status = { connected: true, state: 'connected', message: 'MongoDB is connected' };
        break;
      case 2:
        status = { connected: false, state: 'connecting', message: 'MongoDB is connecting' };
        break;
      case 3:
        status = { connected: false, state: 'disconnecting', message: 'MongoDB is disconnecting' };
        break;
      default:
        status = { connected: false, state: 'unknown', message: 'MongoDB connection state is unknown' };
    }

    // Try to execute a simple ping command to verify server connectivity
    if (status.connected) {
      await mongoose.connection.db.admin().ping();
      status.pingSuccess = true;
    }
    
    return { 
      ...status, 
      timestamp: new Date().toISOString(),
      host: mongoose.connection.host,
      db: mongoose.connection.name
    };
  } catch (error) {
    return {
      connected: false,
      state: 'error',
      message: 'Error checking MongoDB connection',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Try to reconnect to MongoDB if connection is lost
 */
const tryReconnect = async () => {
  try {
    if (mongoose.connection.readyState !== 1) { // Not connected
      console.log('Attempting to reconnect to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URL);
      return { success: true, message: 'Successfully reconnected to MongoDB' };
    } else {
      return { success: true, message: 'MongoDB already connected' };
    }
  } catch (error) {
    console.error('Failed to reconnect to MongoDB:', error);
    return { success: false, message: error.message };
  }
};

module.exports = {
  checkDatabaseConnection,
  tryReconnect
};
