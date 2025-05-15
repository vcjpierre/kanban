const jsonwebtoken = require('jsonwebtoken')
const User = require('../models/user')

const tokenDecode = (req) => {
  const bearerHeader = req.headers['authorization']
  if (bearerHeader) {
    const bearer = bearerHeader.split(' ')[1]
    try {
      const tokenDecoded = jsonwebtoken.verify(
        bearer,
        process.env.TOKEN_SECRET_KEY
      )
      return tokenDecoded
    } catch {
      return false
    }
  } else {
    return false
  }
}

exports.verifyToken = async (req, res, next) => {
  const tokenDecoded = tokenDecode(req)
  if (tokenDecoded) {
    try {
      // Verificar que la conexión a MongoDB esté activa
      const readyState = require('mongoose').connection.readyState;
      if (readyState !== 1) {
        console.warn('MongoDB connection not ready during token verification. Status:', readyState);
        return res.status(503).json({
          errors: [{
            param: 'database',
            msg: 'Database connection error. Please try again later.'
          }]
        });
      }
      
      // Usar lean() para mejor rendimiento y agregar timeout para evitar bloqueos
      const user = await User.findById(tokenDecoded.id)
        .lean()
        .maxTimeMS(5000)
        .exec();
        
      if (!user) {
        return res.status(401).json({
          errors: [{
            param: 'auth',
            msg: 'Unauthorized: Invalid user session'
          }]
        });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      
      // Manejar errores específicos de MongoDB
      if (
        error.name === 'MongoError' ||
        error.name === 'MongooseError' ||
        error.name === 'MongoServerError' ||
        (error.message && error.message.includes('timeout'))
      ) {
        return res.status(503).json({
          errors: [{
            param: 'database',
            msg: 'Database connection error. Please try again later.'
          }]
        });
      }
      
      return res.status(500).json({
        errors: [{
          param: 'server',
          msg: 'Error verifying authentication'
        }]
      });
    }
  } else {
    res.status(401).json({
      errors: [{
        param: 'auth',
        msg: 'Unauthorized: Invalid or missing token'
      }]
    });
  }
}