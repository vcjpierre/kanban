const mongoose = require('mongoose');

/**
 * Manages MongoDB connections to prevent leaks and timeouts
 */
class DatabaseConnectionManager {
  constructor() {
    this.isConnected = false;
    this.connectionTimeout = null;
    this.MAX_IDLE_TIME = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Connects to MongoDB with the given options
   */
  async connect(url, options = {}) {
    if (this.isConnected) {
      console.log('Using existing MongoDB connection');
      // Reset the timeout since connection is being used
      this._resetIdleTimeout();
      return mongoose.connection;
    }

    try {
      const connection = await mongoose.connect(url, options);
      console.log('New MongoDB connection established');
      this.isConnected = true;
      
      // Set up connection event listeners
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        this.isConnected = false;
      });
      
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      
      // Set an idle timeout to close unused connections
      this._resetIdleTimeout();
      
      return connection;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Resets the idle timeout - called when the connection is used
   */
  _resetIdleTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    this.connectionTimeout = setTimeout(() => {
      this._closeIdleConnection();
    }, this.MAX_IDLE_TIME);
  }

  /**
   * Closes idle connections to prevent resource leaks
   */
  async _closeIdleConnection() {
    if (this.isConnected) {
      console.log('Closing idle MongoDB connection');
      try {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('MongoDB connection closed due to inactivity');
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
    }
  }

  /**
   * Explicitly closes the MongoDB connection
   */
  async disconnect() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    if (this.isConnected) {
      try {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('MongoDB connection closed');
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
    }
  }
}

// Create and export a singleton instance
const dbConnectionManager = new DatabaseConnectionManager();
module.exports = dbConnectionManager;
