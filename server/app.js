const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { connectToDatabase } = require('./src/v1/utils/dbConnection');

// Load environment variables
dotenv.config();

const app = express();

app.use(cors())
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middlewares de error para manejar diferentes situaciones
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  
  // Errores relacionados con MongoDB
  if (
    err.name === 'MongoError' ||
    err.name === 'MongooseError' ||
    err.name === 'MongoServerError' ||
    (err.message && (
      err.message.includes('MongoDB') ||
      err.message.includes('mongo') ||
      err.message.includes('timeout')
    ))
  ) {
    return res.status(503).json({
      errors: [{
        param: 'database',
        msg: 'Database service is temporarily unavailable. Please try again later.'
      }]
    });
  }
  
  // Error genérico para cualquier otro tipo de error
  return res.status(500).json({
    errors: [{
      param: 'server',
      msg: 'An unexpected server error occurred'
    }]
  });
});

app.use('/api/v1', require('./src/v1/routes'));

// Ruta para verificar el estado del servidor y la conexión a MongoDB
app.get('/health', async (req, res) => {
  const status = {
    server: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  };
  
  // Opcional: verificar el estado de MongoDB si se solicita con ?checkDb=true
  if (req.query.checkDb === 'true') {
    try {
      if (mongoose.connection.readyState === 1) {
        status.database = 'connected';
      } else {
        // Intentar conectar
        const connected = await initializeDatabase(true);
        status.database = connected ? 'reconnected' : 'disconnected';
      }
    } catch (error) {
      status.database = 'error';
      status.dbError = error.message;
    }
  }
  
  res.status(200).json(status);
});

// Inicializar conexión a la base de datos
// Para entornos serverless como Vercel, conectamos bajo demanda
let isConnected = false;
let connectionError = null;
let lastConnectionAttempt = 0;
const CONNECTION_CACHE_TIME = 30000; // 30 segundos

const initializeDatabase = async (forceReconnect = false) => {
  const now = Date.now();
  
  // Si ya estamos conectados y no se fuerza la reconexión, simplemente retornamos
  if (isConnected && !forceReconnect) {
    return true;
  }
  
  // Si hubo un error reciente, no intentamos reconectar inmediatamente
  // a menos que se fuerce la reconexión
  if (connectionError && (now - lastConnectionAttempt) < CONNECTION_CACHE_TIME && !forceReconnect) {
    console.log('Recent connection error, skipping reconnection attempt');
    return false;
  }
  
  lastConnectionAttempt = now;
  connectionError = null;
  
  try {
    await connectToDatabase();
    isConnected = true;
    console.log('MongoDB connected for serverless environment');
    return true;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    connectionError = error;
    isConnected = false;
    
    // En entornos de desarrollo, un error de conexión es fatal
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    
    return false;
  }
};

// Si no está en producción, inicializar la base de datos inmediatamente
if (process.env.NODE_ENV !== 'production') {
  initializeDatabase();
}

// Middleware para manejar la conexión a la base de datos
app.use(async (req, res, next) => {
  // Ruta de verificación de salud no requiere conexión a DB
  if (req.path === '/health') {
    return next();
  }
  
  try {
    // En producción o si hubo un error previo, intentamos conectar
    if (process.env.NODE_ENV === 'production' || connectionError) {
      const connected = await initializeDatabase();
      
      // Si no pudimos conectar, enviamos un error 503 (servicio no disponible)
      if (!connected) {
        console.error('Database connection is not available');
        return res.status(503).json({
          errors: [{
            param: 'database',
            msg: 'Database service is temporarily unavailable. Please try again later.'
          }]
        });
      }
    }
    next();
  } catch (error) {
    console.error('Unhandled error in database middleware:', error);
    res.status(500).json({
      errors: [{
        param: 'server',
        msg: 'An unexpected server error occurred'
      }]
    });
  }
});

// Para entornos no serverless, configurar un puerto manualmente
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('\x1b[32m%s\x1b[0m', `✅ Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
