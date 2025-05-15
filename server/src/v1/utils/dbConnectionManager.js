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
    
    // Si ya estamos conectados, reutilizamos la conexión
    if (this.isConnected && mongoose.connection.readyState === 1) {
      console.log('Using existing MongoDB connection');
      
      // Para entornos no serverless, reseteamos el timeout
      if (process.env.NODE_ENV !== 'production') {
        this._resetIdleTimeout();
      }
      
      return mongoose.connection;
    }

    // Creamos una nueva promesa de conexión
    this.connectionPromise = (async () => {
      try {
        // Asegurarnos de que la URL de MongoDB está definida
        if (!url) {
          console.error('MongoDB URL is not defined');
          throw new Error('MongoDB URL is not defined. Check your environment variables.');
        }
        
        // Opciones optimizadas para Vercel
        const serverlessOptions = {
          ...options,
          bufferCommands: false, // Deshabilitar para entornos serverless
          serverSelectionTimeoutMS: 10000, // Reducir timeout para serverless
          socketTimeoutMS: 20000,
        };
        
        // Aplicar opciones según el entorno
        const finalOptions = process.env.NODE_ENV === 'production' 
          ? serverlessOptions 
          : options;

        console.log('Connecting to MongoDB...');
        const connection = await mongoose.connect(url, finalOptions);
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
        
        // Set an idle timeout to close unused connections (solo para entornos no serverless)
        if (process.env.NODE_ENV !== 'production') {
          this._resetIdleTimeout();
        }
        
        return connection;
      } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        this.isConnected = false;
        throw error;
      } finally {
        // Limpiar la promesa de conexión cuando termine
        this.connectionPromise = null;
      }
    })();
    
    return this.connectionPromise;
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
