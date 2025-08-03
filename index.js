const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const axios = require('axios');

const { generateCodeVerifier, generateCodeChallenge } = require('./utils');
const {
  setCodeChallenge,
  getCodeChallenge,
  storeTokenData,
  generateAuthCookie,
  getTokensFromCookie,
  mapCookieToTokens,
  deleteCookieMapping
} = require('./sessionStore');
const config = require('./config');


const app = express();
app.use(cookieParser());

//Cors headers 
app.use(cors({
  origin: 'https://app.test.com',
  credentials: true, // allow sending cookies
}));


const PORT = 443;

// SSL Certificate and Key
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'test.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'test.crt'))
};

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// GET /session
app.get('/session', (req, res) => {
  const cookieId = req.cookies['session_id'];

  if (cookieId) {
    const tokenPair = getTokensFromCookie(cookieId);
    if (tokenPair) {
      return res.json({ authenticated: true });
    }

    // ❌ Invalid session: remove the cookie
    res.clearCookie('session_id', {
      domain: '.test.com',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    });
  }

  // If session cookie missing or invalid, return auth URL
  const codeVerifier = generateCodeVerifier();
  const authUrl = generateAuthUrl(codeVerifier);

  res.json({
    authenticated: false,
    auth_url: authUrl
  });
});


app.post('/logout', (req, res) => {
  const cookieId = req.cookies['session_id'];

  if (cookieId) {
    deleteCookieMapping(cookieId); // remove session from map
    res.clearCookie('session_id', {
      domain: '.test.com', // match cookie domain
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None'
    });
  }
  return res.status(200).json({ success: true, message: 'Logged out' });
});


function generateAuthUrl(codeVerifier) {
  const codeChallenge = generateCodeChallenge(codeVerifier);
  setCodeChallenge(codeVerifier, codeChallenge, 10 * 60 * 1000); // 10 mins

  const params = {
    client_id: config.client_id,
    response_type: 'code',
    redirect_uri: config.redirect_uri,
    response_mode: 'query',
    scope: config.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: codeChallenge
  };

  return `${config.authority}/${config.tenant_id}/oauth2/v2.0/authorize?${querystring.stringify(params)}`;
}

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code || !state) {
    return res.status(400).send('Missing code or state.');
  }

  // Validate state
  const pkceData = getCodeChallenge(state);
  if (!pkceData ) {
    return res.status(403).send('Invalid or expired state.');
  }

  const { code_verifier } = pkceData;

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.client_id,
      code: code,
      redirect_uri: config.redirect_uri,
      code_verifier: code_verifier,
      scope: config.scope
    });

    if (config.client_secret) {
      params.append('client_secret', config.client_secret);
    }

    const tokenEndpoint = `${config.authority}/${config.tenant_id}/oauth2/v2.0/token`;
    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Generate session ID
    const session_id = crypto.randomUUID();
    const now = Date.now();
    const expiration = now + expires_in * 1000;

    // Store session → token mapping
    mapCookieToTokens(session_id, 
      access_token,
      refresh_token,
      expiration
    );

    // Set session_id cookie
    res.cookie('session_id', session_id, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: expires_in * 1000,
      domain: '.test.com'
    });

    // Redirect to front-end app
    res.redirect('https://app.test.com');
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    res.status(500).send('Token exchange failed.');
  }
});


app.use('/resource', async (req, res) => {
  const cookieId = req.cookies['session_id'];
  
  if (! cookieId) {
    return res.status(401).json({ error: 'Unauthorized or session expired' });
  } 

  const tokenInfo = getTokensFromCookie(cookieId);
  if (!tokenInfo) {
    return res.status(401).json({ error: 'Unauthorized or session expired' });
  }
  
  const targetUrl = `${config.resource}${req.path.replace(/^\/resource/, '')}`;

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      httpsAgent,
      headers: {
        //...req.headers, //ms graph api does not like proxying requests with original headers
        authorization: `Bearer ${tokenInfo.access_token}`
      },
      data: req.body
    });

    res.status(response.status).set(response.headers).send(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: 'Proxy request failed',
      details: err.response?.data || err.message
    });
  }
});

// Create HTTPS server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS server running at https://api.host.com`);
});
