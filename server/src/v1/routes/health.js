const router = require('express').Router();
const { checkDatabaseConnection, tryReconnect } = require('../utils/dbHealthCheck');

// Get health status of the application
router.get('/status', async (req, res) => {
  try {
    const dbStatus = await checkDatabaseConnection();
    const healthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      db: dbStatus
    };
    
    if (!dbStatus.connected) {
      healthStatus.status = 'DEGRADED';
    }
    
    res.status(200).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Try to reconnect to database if connection is lost
router.post('/reconnect-db', async (req, res) => {
  try {
    const result = await tryReconnect();
    if (result.success) {
      res.status(200).json({
        status: 'SUCCESS',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'FAILED',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
