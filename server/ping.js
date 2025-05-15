/**
 * Script para mantener "caliente" la instancia de Vercel
 * Puede programarse para ejecutarse cada 5 minutos en un servicio como cron-job.org
 */

const https = require('https');
const http = require('http');

const pingServerless = async (url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    console.log(`Pinging: ${url}`);
    const startTime = Date.now();
    
    const req = protocol.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`Status: ${res.statusCode}, Time: ${duration}ms`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ 
            success: true, 
            statusCode: res.statusCode, 
            data: data,
            duration 
          });
        } else {
          reject({
            success: false,
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error pinging ${url}:`, error);
      reject({ success: false, error });
    });
    
    req.on('timeout', () => {
      req.abort();
      reject({ success: false, error: 'Request timeout' });
    });
    
    req.setTimeout(10000); // 10 segundos de timeout
  });
};

// URLs a verificar (ajustar con tus propios endpoints)
const urls = [
  'https://kanban-rqro.vercel.app/health',
  'https://kanban-rqro.vercel.app/api/v1/auth/login'
];

const pingAll = async () => {
  try {
    console.log(`=== Ping started at ${new Date().toISOString()} ===`);
    
    for (const url of urls) {
      try {
        await pingServerless(url);
        console.log(`✅ Successfully pinged: ${url}`);
      } catch (error) {
        console.error(`❌ Failed to ping: ${url}`, error);
      }
    }
    
    console.log('=== Ping completed ===\n');
  } catch (error) {
    console.error('Error during ping process:', error);
  }
};

// Si se ejecuta directamente (no como módulo)
if (require.main === module) {
  pingAll();
}

module.exports = { pingServerless, pingAll };
