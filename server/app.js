const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');
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

app.use('/api/v1', require('./src/v1/routes'));

// Ruta para verificar el estado del servidor
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Inicializar conexión a la base de datos
// Para entornos serverless como Vercel, conectamos bajo demanda
let isConnected = false;

const initializeDatabase = async () => {
  if (!isConnected) {
    try {
      await connectToDatabase();
      isConnected = true;
      console.log('MongoDB connected for serverless environment');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      process.exit(1);
    }
  }
  return isConnected;
};

// Si no está en producción, inicializar la base de datos inmediatamente
if (process.env.NODE_ENV !== 'production') {
  initializeDatabase();
}

// En producción, para Vercel, la conexión se inicializará en la primera solicitud
app.use(async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    await initializeDatabase();
  }
  next();
});

// Para entornos no serverless, configurar un puerto manualmente
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
