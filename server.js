import express from 'express';
import https from 'https';
import fs from 'fs';

const app = express();

const host = '0.0.0.0';
const port = 8080;

// Path to your certificate and key files
const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };

// Middleware to set required headers for SharedArrayBuffer access
app.use((req, res, next) => {
  if (process.env.MULTITHREAD) {
    // add required security header to enable SharedArrayBuffer, needed to run multithread
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static files from the 'public' directory
app.use(express.static('./dev'));

if (!process.env.MULTITHREAD) {
  console.log('WARN: Running server without MULTITHREAD=1, this will effectively disable multithreading');
}

// Create an HTTPS server with your custom certificate and key
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(port, host, () => {
  console.log(`HTTPS server listening at https://${host}:${port}`);
});
