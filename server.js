// server.js
const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// OAuth2 client setup
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Root route handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to initiate OAuth flow for additional scopes
app.get('/auth', (req, res) => {
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.compose'
  ];

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    include_granted_scopes: true
  });

  res.redirect(authUrl);
});

// OAuth2 callback endpoint
app.get('/auth/oauth2callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    // Store tokens securely (e.g., in session or database)
    // For simplicity, we'll assume success
    res.redirect('/');
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Authentication failed');
  }
});

// Endpoint for creating a draft email
app.post('/gmail/draft', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('Unauthorized');
  }

  const accessToken = authHeader.split(' ')[1];
  oAuth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).send('Missing required fields: to, subject, body');
  }

  const emailContent = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body
  ].join('\n');

  const encodedMessage = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage
        }
      }
    });
    res.status(200).send({ id: draft.data.id });
  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).send('Failed to create draft');
  }
});

// Serve static files
app.get('/.well-known/ai-plugin.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'ai-plugin.json'));
});

app.get('/openapi.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo.png'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
