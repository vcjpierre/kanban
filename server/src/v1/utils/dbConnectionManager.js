const mongoose = require('mongoose');

/**
 * Manages MongoDB connections to prevent leaks and timeouts
 * Optimized for both traditional and serverless environments
 */
class DatabaseConnectionManager {
  constructor() {
    this.isConnected = false;
    this.connectionTimeout = null;
    this.MAX_IDLE_TIME = 30 * 60 * 1000; // 30 minutes
    this.connectionPromise = null; // Para evitar conexiones múltiples simultáneas
  }
  /**
   * Connects to MongoDB with the given options
   * Optimized for serverless environments with connection caching
   */
  async connect(url, options = {}) {
    // Si ya tenemos una conexión en proceso, esperamos a que termine
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // Verificar el estado de la conexión
    const readyState = mongoose.connection.readyState;
    
    // Si ya estamos conectados, reutilizamos la conexión
    if (this.isConnected && readyState === 1) {
      console.log('Using existing MongoDB connection');
      
      // Para entornos no serverless, reseteamos el timeout
      if (process.env.NODE_ENV !== 'production') {
        this._resetIdleTimeout();
      }
      
      return mongoose.connection;
    }
    
    if (readyState === 0 || readyState === 3) {
      console.log('Previous connection is closed or in error state. Creating new connection...');
      mongoose.connections.forEach((conn) => conn.removeAllListeners());
      try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
      this.isConnected = false;
    }
    
    this.connectionPromise = this._connect(url, options);
    return this.connectionPromise;
  }

  async _connect(url, options) {
    try {
      if (!url) {
        throw new Error('MongoDB URL is not defined. Check your environment variables.');
      }
      
      const serverlessOptions = {
        ...options,
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        heartbeatFrequencyMS: 30000,
        minPoolSize: 1,
        maxPoolSize: 10,
        connectTimeoutMS: 10000
      };
      
      const finalOptions = process.env.NODE_ENV === 'production' 
        ? serverlessOptions 
        : options;

      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Connecting to MongoDB (attempt ${retryCount + 1}/${maxRetries})...`);
          const connection = await mongoose.connect(url, finalOptions);
          console.log(`MongoDB connected on attempt ${retryCount + 1}`);
          this.isConnected = true;
          this._setupConnectionEventHandlers();
          if (process.env.NODE_ENV !== 'production') this._resetIdleTimeout();
          return connection;
        } catch (err) {
          retryCount++;
          console.error(`MongoDB connection attempt ${retryCount} failed:`, err.message);
          if (retryCount >= maxRetries) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }
  /**
   * Resets the idle timeout - called when the connection is used
   * Solo se usa en entornos no serverless
   */
  _resetIdleTimeout() {
    // No usar timeouts en entornos serverless como Vercel
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    
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
   * Configure event handlers for the MongoDB connection
   * This sets up listeners for connection events
   */
  _setupConnectionEventHandlers() {
    // Limpiar listeners anteriores para evitar duplicados
    mongoose.connection.removeAllListeners('disconnected');
    mongoose.connection.removeAllListeners('error');
    mongoose.connection.removeAllListeners('connected');
    
    // Configurar nuevos listeners
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      this.isConnected = false;
      
      // En entornos serverless, no intentamos reconectar automáticamente
      // ya que cada función tendrá su propio ciclo de vida
      if (process.env.NODE_ENV !== 'production') {
        console.log('Will attempt to reconnect on next request');
      }
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      // No establecemos isConnected = false aquí ya que algunos errores son transitorios
      // y mongoose puede recuperarse automáticamente
    });
    
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connection established or re-established');
      this.isConnected = true;
    });
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
