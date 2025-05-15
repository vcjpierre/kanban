const User = require('../models/user')
const CryptoJS = require('crypto-js')
const jsonwebtoken = require('jsonwebtoken')

exports.register = async (req, res) => {
  const { password } = req.body
  try {
    req.body.password = CryptoJS.AES.encrypt(
      password,
      process.env.PASSWORD_SECRET_KEY
    )

    const user = await User.create(req.body)
    const token = jsonwebtoken.sign(
      { id: user._id },
      process.env.TOKEN_SECRET_KEY,
      { expiresIn: '24h' }
    )
    res.status(201).json({ user, token })  } catch (err) {
    console.error('Registration error:', err);
    // Check for duplicate key error (username already exists)
    if (err.code === 11000) {
      return res.status(400).json({
        errors: [
          {
            param: 'username',
            msg: 'Username already used'
          }
        ]
      });
    }
    // Database connection issues
    if (err.name === 'MongooseError' || err.name === 'MongoError' || 
        err.name === 'MongoServerError' || (err.message && err.message.includes('timeout'))) {
      return res.status(500).json({
        errors: [{ 
          param: 'database',
          msg: 'Database connection error. Please try again later.'
        }]
      });
    }
    res.status(500).json({
      errors: [{ 
        param: 'server',
        msg: 'An unexpected error occurred'
      }]
    });
  }
}

exports.login = async (req, res) => {
  const { username, password } = req.body
  try {
    // Verificar que la conexión a MongoDB esté activa
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB connection not ready during login attempt');
      return res.status(503).json({
        errors: [{
          param: 'database',
          msg: 'Database connection error. Please try again later.'
        }]
      });
    }
    
    // Add timeout to the query to avoid hanging indefinitely
    const user = await User.findOne({ username })
      .select('password username')
      .maxTimeMS(10000)  // Increased maximum execution time to 10 seconds
      .lean()           // Use lean queries for better performance
      .exec();
      
    if (!user) {
      return res.status(401).json({
        errors: [
          {
            param: 'username',
            msg: 'Invalid username or password'
          }
        ]
      })
    }

    const decryptedPass = CryptoJS.AES.decrypt(
      user.password,
      process.env.PASSWORD_SECRET_KEY
    ).toString(CryptoJS.enc.Utf8)

    if (decryptedPass !== password) {
      return res.status(401).json({
        errors: [
          {
            param: 'username',
            msg: 'Invalid username or password'
          }
        ]
      })
    }

    user.password = undefined

    const token = jsonwebtoken.sign(
      { id: user._id },
      process.env.TOKEN_SECRET_KEY,
      { expiresIn: '24h' }
    );
    res.status(200).json({ user, token })

  } catch (err) {
    console.error('Login error:', err);    // Provide a more useful error message for MongoDB connection issues
    if (err.name === 'MongooseError' || err.name === 'MongoError' || 
        err.name === 'MongoServerError' || (err.message && err.message.includes('timeout'))) {
      return res.status(500).json({
        errors: [{ 
          param: 'database',
          msg: 'Database connection error. Please try again later.'
        }]
      });
    }
    res.status(500).json({
      errors: [{ 
        param: 'server',
        msg: 'An unexpected error occurred'
      }]
    });
  }
}