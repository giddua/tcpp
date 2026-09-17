import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import snowflake from 'snowflake-sdk';
import { getSnowflakeConnection } from './snowflakeDb.js';
import { getPool } from './db.js';
import sql from 'mssql';
import cors from 'cors';
import fs from 'fs';
import axios from 'axios';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
// @ts-ignore
import XlsxPopulate from 'xlsx-populate';
import { getSecrets, getJwtSecret, SECRETS_FILE } from './secrets.js';

// ================= EMAIL (SMTP - Gmail) =================

function createTransporter() {
  const secrets = getSecrets();

  return nodemailer.createTransport({
    host: secrets.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(secrets.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: secrets.SMTP_USER,
      pass: secrets.SMTP_PASS,
    },
  });
}

async function sendOTPEmail(email: string, otp: string) {
  console.log(`[SMTP] Preparing to send OTP to ${email}`);
  const secrets = getSecrets();
  
  if (!secrets.SMTP_USER || !secrets.SMTP_PASS) {
    console.warn(`[SMTP] Warning: SMTP_USER or SMTP_PASS is missing. Check environment variables.`);
  }

  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: `"Rebate App" <${secrets.SMTP_USER}>`,
      to: email,
      subject: 'Your One-Time Password (OTP)',
      text: `Your OTP is: ${otp}\n\nThis code will expire in 10 minutes.`,
    });
    console.log(`[SMTP] Message sent: ${info.messageId}`);
  } catch (err: any) {
    console.error(`[SMTP] Error sending email:`, err);
    throw err;
  }
}

// ================= OTP STORE =================

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.HTTP_PLATFORM_PORT || '3000', 10);

  app.use(cors());
  app.use(express.json());

  // JWT Authentication Middleware to prevent client spoofing
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const fullPath = (req.originalUrl || req.url || req.path).split('?')[0];
    const relPath = req.path.split('?')[0];

    // Unprotected / Public endpoints
    const isPublic =
      fullPath === '/api/auth/otp/request' || relPath === '/auth/otp/request' ||
      fullPath === '/api/auth/otp/verify' || relPath === '/auth/otp/verify' ||
      fullPath === '/api/auth/microsoft/url' || relPath === '/auth/microsoft/url' ||
      fullPath === '/api/auth/me' || relPath === '/auth/me' ||
      fullPath === '/api/health' || relPath === '/health' ||
      fullPath.includes('/auth/microsoft/callback');

    if (isPublic) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'Access token required. Please log in.' });
    }

    try {
      const jwtSecret = getJwtSecret();
      if (!jwtSecret) {
        return res.status(500).json({ error: 'JWT_PHRASE is not configured on server.' });
      }
      const decoded = jwt.verify(token, jwtSecret) as any;
      (req as any).user = decoded;
      next();
    } catch (err) {
      console.warn('[AUTH] Invalid JWT token:', err instanceof Error ? err.message : err);
      return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
    }
  };

  app.use('/api', authenticateToken);
  // Admin-only authorization — must run after authenticateToken (relies on req.user being set)
  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const userEmail = String((req as any).user?.email || '').trim();
      if (!userEmail) {
        return res.status(401).json({ error: 'Access Denied', details: 'User authentication required. Please log in.' });
      }

      const pool = await getPool();
      const roleResult = await pool
        .request()
        .input('Email', sql.NVarChar, userEmail)
        .query(`
          SELECT RoleName
          FROM auth.[UserRoles]
          WHERE LOWER(Email) = LOWER(@Email)
        `);

      if (roleResult.recordset.length === 0 || roleResult.recordset[0].RoleName?.trim().toLowerCase() !== 'admin') {
        return res.status(403).json({ error: 'Access Denied', details: 'Admin role required for this action.' });
      }

      next();
    } catch (error: any) {
      console.error('requireAdmin check failed:', error.message);
      res.status(500).json({ error: 'Authorization check failed', details: error.message });
    }
  };
  // 🔥 Warm up SQL connection BEFORE accepting requests
  try {
    const secrets = getSecrets();
    await getPool();
    console.log('🔥 SQL Pool warmed up at startup');
  } catch (err) {
    console.error('❌ Failed to initialize SQL connection', err);
    process.exit(1);
  }

  // API Routes for Secrets
  /* old stuff which does not work all the time: secrets get overwritten by old values
  app.get('/api/secrets', (req, res) => {
    const secrets = getSecrets();
    // Send actual values so the frontend can manage them (user requested UI for this)
    // The frontend will mask them using input type="password"
    res.json(secrets);
  });
  */
  //new suggested by Claude
  app.get('/api/secrets', requireAdmin, (req, res) => {
  const secrets = getSecrets();
  const KNOWN_KEYS = [
    'JWT_PHRASE',
    'SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD',
    'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA', 'SNOWFLAKE_WAREHOUSE',
    'SQL_SERVER_USER', 'SQL_SERVER_PASSWORD', 'SQL_SERVER_SERVER',
    'SQL_SERVER_DATABASE', 'SQL_SERVER_PORT', 'SQL_SERVER_TRUST_SERVER_CERTIFICATE',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
    'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'
  ];
  const filtered = Object.fromEntries(
    KNOWN_KEYS.map(k => [k, secrets[k] ?? ''])
  );
  res.json(filtered);
});




 /* old stuff which does not work all the time: secrets get overwritten by old values
app.post('/api/secrets', (req, res) => {
  try {
    const newSecrets = req.body;

    let existing = {};
    if (fs.existsSync(SECRETS_FILE)) {
      existing = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
    }

    const merged = {
      ...existing,
      ...newSecrets
    };

    fs.writeFileSync(SECRETS_FILE, JSON.stringify(merged, null, 2));

    res.json({ message: 'Secrets saved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save secrets', details: error.message });
  }
});
*/
// new suggested by Claude
app.post('/api/secrets', requireAdmin, (req, res) => {
const KNOWN_KEYS = [
    'JWT_PHRASE',
    'SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD',
    'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA', 'SNOWFLAKE_WAREHOUSE',
    'SQL_SERVER_USER', 'SQL_SERVER_PASSWORD', 'SQL_SERVER_SERVER',
    'SQL_SERVER_DATABASE', 'SQL_SERVER_PORT', 'SQL_SERVER_TRUST_SERVER_CERTIFICATE',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
    'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'
  ];
  const incoming = req.body;
  const filtered = Object.fromEntries(
    Object.entries(incoming).filter(([k]) => KNOWN_KEYS.includes(k))
  );

  let existing = {};
  if (fs.existsSync(SECRETS_FILE)) {
    existing = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  }
  const merged = { ...existing, ...filtered };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(merged, null, 2));

  // Write to process.env in-memory for the active process session as well
  for (const [key, val] of Object.entries(filtered)) {
    if (val !== undefined && val !== null) {
      process.env[key] = String(val);
    }
  }

  res.json({ message: 'Secrets saved successfully' });
});

  app.post('/api/test-snowflake', requireAdmin, async (req, res) => {
    try {
      const config = req.body;
      const snowflakeConfig = {
        account: (config.SNOWFLAKE_ACCOUNT || '').trim(),
        username: (config.SNOWFLAKE_USERNAME || '').trim(),
        password: (config.SNOWFLAKE_PASSWORD || '').trim(),
        database: (config.SNOWFLAKE_DATABASE || '').trim(),
        schema: (config.SNOWFLAKE_SCHEMA || '').trim(),
        warehouse: (config.SNOWFLAKE_WAREHOUSE || '').trim(),
      };

      const connection = snowflake.createConnection(snowflakeConfig);
      connection.connect((err, conn) => {
        if (err) {
          console.error('Snowflake test connection failed:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message,
            code: (err as any).code
          });
        }
        res.json({ message: 'Snowflake connection successful!' });
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Test failed', details: error.message });
    }
  });

  app.post('/api/test-sql', requireAdmin, async (req, res) => {
    try {
      const config = req.body;
      const serverRaw = (config.SQL_SERVER_SERVER || '').trim();
      const [host, instance] = serverRaw.split('\\');


      const pool = await getPool();
      res.json({ message: 'SQL Server connection successful!' });
    } catch (error: any) {
      res.status(500).json({ error: 'SQL Server connection failed', details: error.message });
    }
  });

  // OTP Store (Memory-only for simulation)
  const otpStore = new Map<string, { otp: string, expiresAt: number, displayName: string, jobTitle: string, role?: string }>();

  app.post('/api/auth/otp/request', async (req, res) => {
    const { email } = req.body;
    console.log(`[OTP] Request received for: ${email}`);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);

    try {
      console.log(`[OTP] Building SQL config...`);
      
      console.log(`[OTP] Getting SQL pool...`);
      const pool = await getPool();

      console.log(`[OTP] Querying database for: ${normalizedEmail}`);
      const result = await pool
        .request()
        .input('Email', sql.NVarChar, normalizedEmail)
        .query(`
          SELECT TOP 1 u.*, ur.RoleName 
          FROM auth.[Users] u
          LEFT JOIN auth.[UserRoles] ur ON LOWER(u.Email) = LOWER(ur.Email)
          WHERE LOWER(u.Email) = LOWER(@Email)
        `);

      if (result.recordset.length === 0) {
        console.log(`[OTP] User not found: ${normalizedEmail}`);
        return res
          .status(404)
          .json({ error: 'Login Unsuccessful: Email not found in security database.' });
      }

      const user = result.recordset[0];
      const otp = generateOTP();

      // Store OTP
      otpStore.set(normalizedEmail, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
        displayName: user.DisplayName || user.Email,
        jobTitle: user.JobTitle || 'User',
        role: user.RoleName || 'User'
      });

      console.log(`[OTP GENERATED] ${normalizedEmail} → ${otp}`);

      // Send Email
      console.log(`[OTP] Sending email to: ${normalizedEmail}`);
      try {
        await sendOTPEmail(normalizedEmail, otp);
        console.log(`[OTP] Email sent successfully`);
      } catch (emailErr: any) {
        console.error(`[OTP] Failed to send email:`, emailErr);
        // We still return 200 in dev or a specific error?
        // Let's return error so user knows why it's stuck
        throw new Error(`Email delivery failed: ${emailErr.message}`);
      }

      res.json({
        message: 'OTP sent to your email address.',
      });
    } catch (err: any) {
      console.error('[OTP] Request failed:', err);
      res
        .status(500)
        .json({ error: 'Failed to process request', details: err.message });
    }
  });

app.post('/api/auth/otp/verify', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ error: 'Email and OTP are required' });
  }

  const normalizedEmail = normalizeEmail(email);
  const stored = otpStore.get(normalizedEmail);

  console.log('OTP VERIFY DEBUG:', {
    email: normalizedEmail,
    enteredOtp: otp,
    storedOtp: stored?.otp,
  });

  if (!stored) {
    return res
      .status(401)
      .json({ error: 'OTP not found. Please request again.' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res
      .status(401)
      .json({ error: 'OTP expired. Please request a new one.' });
  }

  if (stored.otp !== otp) {
    return res
      .status(401)
      .json({ error: 'Invalid OTP.' });
  }

  // Success
  otpStore.delete(normalizedEmail);

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({ error: 'JWT_PHRASE is missing from server secrets configuration.' });
  }

  const token = jwt.sign(
    {
      email: normalizedEmail,
      displayName: stored.displayName,
      jobTitle: stored.jobTitle,
      role: stored.role || 'User',
    },
    jwtSecret,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    message: 'Login Successful',
    token,
    displayName: stored.displayName,
    email: normalizedEmail,
    jobTitle: stored.jobTitle,
    role: stored.role || 'User',
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }

  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(500).json({ valid: false, error: 'JWT_PHRASE is missing' });
    }
    const decoded = jwt.verify(token, jwtSecret) as any;
    return res.json({
      valid: true,
      user: {
        email: decoded.email,
        displayName: decoded.displayName,
        jobTitle: decoded.jobTitle,
        role: decoded.role || 'User',
      },
    });
  } catch (err) {
    return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

  // Microsoft OAuth Routes (Keeping as requested, though Dummy Login is shifting)
  app.get('/api/auth/microsoft/url', (req, res) => {
    const secrets = getSecrets();
    const clientId = secrets.MICROSOFT_CLIENT_ID;
    const tenantId = secrets.MICROSOFT_TENANT_ID || 'common';
    
    // Skill requirement: Use actual App URL from context if possible
    // We'll use the origin from the request headers as a reliable fallback in this environment
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const redirectUri = `${origin}/auth/microsoft/callback`;

    if (!clientId) {
      return res.status(500).json({ error: 'MICROSOFT_CLIENT_ID is not configured' });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'openid profile email User.Read',
      state: '12345'
    });

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get(['/auth/microsoft/callback', '/auth/microsoft/callback/'], async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'MICROSOFT_AUTH_RESULT', 
                success: false, 
                error: '${error_description || error}' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.send('No code provided');
    }

    try {
      const secrets = getSecrets();
      const clientId = secrets.MICROSOFT_CLIENT_ID;
      const clientSecret = secrets.MICROSOFT_CLIENT_SECRET;
      const tenantId = secrets.MICROSOFT_TENANT_ID || 'common';
      
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const redirectUri = `${protocol}://${host}/auth/microsoft/callback`;

      // 1. Exchange code for token
      const tokenResponse = await axios.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, 
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const accessToken = tokenResponse.data.access_token;

      // 2. Get user info from Microsoft Graph
      const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Microsoft Graph gives us two possible identifiers. In a hybrid AD/Entra
      // setup these can differ: "mail" is the real corporate address, but if that
      // attribute is not set on the account, Graph falls back to userPrincipalName,
      // which may be the default *.onmicrosoft.com name rather than the corporate
      // one stored in auth.Users. Try both against the database rather than
      // assuming one is always correct.
      const graphMail = userResponse.data.mail || '';
      const graphUpn = userResponse.data.userPrincipalName || '';
      const graphDisplayName = userResponse.data.displayName || graphMail || graphUpn;
      let userEmail = graphMail || graphUpn;
      let securityClearance = false;
      let dbDisplayName = '';
      let dbJobTitle = '';
      let dbRole = 'User';

      // 3. Check auth.Users table against either identifier Graph gave us.
      // In a hybrid AD/Entra setup, "mail" and "userPrincipalName" can differ, so
      // check both rather than assuming one is always the right one.
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input('Mail', sql.NVarChar, graphMail)
          .input('Upn', sql.NVarChar, graphUpn)
          .query(`
            SELECT TOP 1 u.*, ur.RoleName
            FROM auth.[Users] u
            LEFT JOIN auth.[UserRoles] ur ON LOWER(u.Email) = LOWER(ur.Email)
            WHERE LOWER(u.Email) = LOWER(@Mail) OR LOWER(u.Email) = LOWER(@Upn)
          `);

        if (result.recordset.length > 0) {
          securityClearance = true;
          const row = result.recordset[0];
          // Use the email on file in our own database as the canonical identity
          // going forward, since that is what the rest of the app expects.
          userEmail = row.Email || userEmail;
          dbDisplayName = row.DisplayName || graphDisplayName;
          dbJobTitle = row.JobTitle || 'User';
          dbRole = row.RoleName || 'User';
        } else {
          console.log(`[Entra] No auth.Users match for mail="${graphMail}" or userPrincipalName="${graphUpn}"`);
        }
        // do nothing, keep pool alive await pool.close();
      } catch (sqlErr: any) {
        console.error('Security clearance check failed:', sqlErr.message);
        // Treat as not cleared if the lookup itself fails, rather than guessing.
      }

      if (!securityClearance) {
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'MICROSOFT_AUTH_RESULT',
                    success: false,
                    error: 'Your account (${userEmail}) is not authorized for TCPP access. Contact your administrator.'
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Not authorized. You can close this window.</p>
            </body>
          </html>
        `);
      }

      const jwtSecret = getJwtSecret();
      if (!jwtSecret) {
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'MICROSOFT_AUTH_RESULT',
                    success: false,
                    error: 'Server is missing JWT_PHRASE configuration.'
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Server configuration error. You can close this window.</p>
            </body>
          </html>
        `);
      }

      const token = jwt.sign(
        {
          email: userEmail,
          displayName: dbDisplayName,
          jobTitle: dbJobTitle,
          role: dbRole,
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'MICROSOFT_AUTH_RESULT',
                  success: true,
                  token: ${JSON.stringify(token)},
                  displayName: ${JSON.stringify(dbDisplayName)},
                  email: ${JSON.stringify(userEmail)},
                  jobTitle: ${JSON.stringify(dbJobTitle)},
                  role: ${JSON.stringify(dbRole)}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('Microsoft OAuth Callback error:', err.response?.data || err.message);
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'MICROSOFT_AUTH_RESULT', 
                success: false, 
                error: 'Token exchange failed: ${err.message}' 
              }, '*');
            // window.close();
            </script>
            <p>Authentication failed: ${err.message}</p>
          </body>
        </html>
      `);
    }
  });

  // API Routes
  // Customer API Routes
  app.get('/api/customers', async (req, res) => {
    try {

      const pool = await getPool();
      const currentYear = new Date().getFullYear();
      const result = await pool.request()
        .input('CurrentYear', sql.Int, currentYear)
        .query(`
          SELECT 
            c.SS_ID, 
            c.CustomerId, 
            cm.CustomerName, 
            c.RegionCode, 
            c.Territory, 
            c.IsActive, 
            cr.SpecificRebateCode, 
            cr.RebatePercent AS RebatePercentOverride, 
            cr.ACSRebatePercent AS ACSRebatePercentOverride, 
            cr.CashRebatePercent AS CashRebatePercentOverride, 
            cr.TierOverride, 
            cr.ProgramYear AS OverrideProgramYear, 
            c.CreatedBy, 
            c.CreatedDate, 
            c.ModifiedBy, 
            c.ModifiedDate 
          FROM tcpp.[Customer] c
          LEFT JOIN ref.[CustomerMaster] cm ON c.CustomerId = cm.CustomerId
          LEFT JOIN tcpp.[CustomerRebate] cr ON c.CustomerId = cr.CustomerId AND cr.ProgramYear = @CurrentYear
          ORDER BY cm.CustomerName
        `);
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customers):', error.message);
      res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }
  });

  app.get('/api/customer-master', async (req, res) => {
    try {

      const pool = await getPool();
      await ensureCustomerMasterTables(pool);
      const result = await pool.request().query('SELECT DISTINCT CustomerId, CustomerName FROM ref.CustomerMaster ORDER BY CustomerName, CustomerId');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-master):', error.message);
      res.status(500).json({ error: 'Failed to fetch customer master records', details: error.message });
    }
  });

  app.get('/api/customer-families', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query('SELECT CustomerFamilyCode, CustomerFamilyName FROM ref.[CustomerFamily] ORDER BY CustomerFamilyName');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-families):', error.message);
      res.status(500).json({ error: 'Failed to fetch customer families', details: error.message });
    }
  });

  app.get('/api/customer-tiers', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query('SELECT CustomerTiers FROM ref.[CustomerTiers] ORDER BY CustomerTiers');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-tiers):', error.message);
      res.status(500).json({ error: 'Failed to fetch customer tiers', details: error.message });
    }
  });

  app.get('/api/regions', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query('SELECT RegionCode, DisplayName FROM ref.[Region] ORDER BY DisplayName');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/regions):', error.message);
      res.status(500).json({ error: 'Failed to fetch regions', details: error.message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {

      const { CustomerId, RegionCode, Territory, IsActive, rebates } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);

          const valuesToCheck = [parsedACS, parsedCash, parsedRebate];
          for (const val of valuesToCheck) {
            if (val !== null && (val < 0 || val > 100)) {
              return res.status(400).json({ error: 'Validation failed', details: 'All rebate percentages must be between 0 and 100 or left blank.' });
            }
          }
        }
      }

      const pool = await getPool();
      await pool.request()
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('RegionCode', sql.NVarChar(10), RegionCode || null)
        .input('Territory', sql.NVarChar(10), Territory || null)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('CreatedBy', sql.NVarChar(50), combinedUser)
        .input('CreatedDate', sql.DateTime2, now)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[Customer] (
            CustomerId, RegionCode, Territory, IsActive, SpecificRebateCode, RebatePercentOverride, 
            ACSRebatePercentOverride, CashRebatePercentOverride, TierOverride, OverrideProgramYear, 
            CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (
            @CustomerId, @RegionCode, @Territory, @IsActive, NULL, NULL, 
            NULL, NULL, NULL, NULL, 
            @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
          )
        `);

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);
          const year = parseInt(r.ProgramYear);

          if (isNaN(year)) continue;

          // Check if year already exists for this CustomerId (unique constraint)
          const existCheck = await pool.request()
            .input('CustomerId', sql.Int, parseInt(CustomerId))
            .input('ProgramYear', sql.Int, year)
            .query('SELECT SS_ID FROM tcpp.[CustomerRebate] WHERE CustomerId = @CustomerId AND ProgramYear = @ProgramYear');

          if (existCheck.recordset.length > 0) {
            await pool.request()
              .input('SS_ID', sql.Int, existCheck.recordset[0].SS_ID)
              .input('SpecificRebateCode', sql.NVarChar(5), r.SpecificRebateCode || null)
              .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
              .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
              .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
              .input('TierOverride', sql.NVarChar(16), r.TierOverride || null)
              .input('ModifiedBy', sql.NVarChar(50), combinedUser)
              .input('ModifiedDate', sql.DateTime2, now)
              .query(`
                UPDATE tcpp.[CustomerRebate]
                SET SpecificRebateCode = @SpecificRebateCode,
                    ACSRebatePercent = @ACSRebatePercent,
                    CashRebatePercent = @CashRebatePercent,
                    RebatePercent = @RebatePercent,
                    TierOverride = @TierOverride,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = @ModifiedDate
                WHERE SS_ID = @SS_ID
              `);
          } else {
            // Insert new rebate entry
            await pool.request()
              .input('CustomerId', sql.Int, parseInt(CustomerId))
              .input('SpecificRebateCode', sql.NVarChar(5), r.SpecificRebateCode || null)
              .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
              .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
              .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
              .input('TierOverride', sql.NVarChar(16), r.TierOverride || null)
              .input('ProgramYear', sql.Int, year)
              .input('CreatedBy', sql.NVarChar(50), combinedUser)
              .input('CreatedDate', sql.DateTime2, now)
              .input('ModifiedBy', sql.NVarChar(50), combinedUser)
              .input('ModifiedDate', sql.DateTime2, now)
              .query(`
                INSERT INTO tcpp.[CustomerRebate] (
                  CustomerId, SpecificRebateCode, ACSRebatePercent, CashRebatePercent, RebatePercent, TierOverride,
                  ProgramYear, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
                )
                VALUES (
                  @CustomerId, @SpecificRebateCode, @ACSRebatePercent, @CashRebatePercent, @RebatePercent, @TierOverride,
                  @ProgramYear, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
                )
              `);
          }
        }
      }

      res.status(201).json({ message: 'Customer created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/customers):', error.message);
      res.status(500).json({ error: 'Failed to create customer', details: error.message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const { CustomerId, RegionCode, Territory, IsActive, rebates } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);

          const valuesToCheck = [parsedACS, parsedCash, parsedRebate];
          for (const val of valuesToCheck) {
            if (val !== null && (val < 0 || val > 100)) {
              return res.status(400).json({ error: 'Validation failed', details: 'All rebate percentages must be between 0 and 100 or left blank.' });
            }
          }
        }
      }

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('RegionCode', sql.NVarChar(10), RegionCode || null)
        .input('Territory', sql.NVarChar(10), Territory || null)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[Customer]
          SET CustomerId = @CustomerId,
              RegionCode = @RegionCode,
              Territory = @Territory,
              IsActive = @IsActive,
              SpecificRebateCode = NULL,
              RebatePercentOverride = NULL,
              ACSRebatePercentOverride = NULL,
              CashRebatePercentOverride = NULL,
              TierOverride = NULL,
              OverrideProgramYear = NULL,
              ModifiedBy = @ModifiedBy,
              ModifiedDate = @ModifiedDate
          WHERE SS_ID = @SS_ID
        `);

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);
          const year = parseInt(r.ProgramYear);

          if (isNaN(year)) continue;

          if (r.SS_ID && String(r.SS_ID).indexOf('temp') === -1) {
            // Update existing rebate entry
            await pool.request()
              .input('SS_ID', sql.Int, r.SS_ID)
              .input('CustomerId', sql.Int, parseInt(CustomerId))
              .input('SpecificRebateCode', sql.NVarChar(5), r.SpecificRebateCode || null)
              .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
              .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
              .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
              .input('TierOverride', sql.NVarChar(16), r.TierOverride || null)
              .input('ProgramYear', sql.Int, year)
              .input('ModifiedBy', sql.NVarChar(50), combinedUser)
              .input('ModifiedDate', sql.DateTime2, now)
              .query(`
                UPDATE tcpp.[CustomerRebate]
                SET CustomerId = @CustomerId,
                    SpecificRebateCode = @SpecificRebateCode,
                    ACSRebatePercent = @ACSRebatePercent,
                    CashRebatePercent = @CashRebatePercent,
                    RebatePercent = @RebatePercent,
                    TierOverride = @TierOverride,
                    ProgramYear = @ProgramYear,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = @ModifiedDate
                WHERE SS_ID = @SS_ID
              `);
          } else {
            // Check if year already exists for this CustomerId (unique constraint)
            const existCheck = await pool.request()
              .input('CustomerId', sql.Int, parseInt(CustomerId))
              .input('ProgramYear', sql.Int, year)
              .query('SELECT SS_ID FROM tcpp.[CustomerRebate] WHERE CustomerId = @CustomerId AND ProgramYear = @ProgramYear');

            if (existCheck.recordset.length > 0) {
              await pool.request()
                .input('SS_ID', sql.Int, existCheck.recordset[0].SS_ID)
                .input('SpecificRebateCode', sql.NVarChar(5), r.SpecificRebateCode || null)
                .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
                .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
                .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
                .input('TierOverride', sql.NVarChar(16), r.TierOverride || null)
                .input('ModifiedBy', sql.NVarChar(50), combinedUser)
                .input('ModifiedDate', sql.DateTime2, now)
                .query(`
                  UPDATE tcpp.[CustomerRebate]
                  SET SpecificRebateCode = @SpecificRebateCode,
                      ACSRebatePercent = @ACSRebatePercent,
                      CashRebatePercent = @CashRebatePercent,
                      RebatePercent = @RebatePercent,
                      TierOverride = @TierOverride,
                      ModifiedBy = @ModifiedBy,
                      ModifiedDate = @ModifiedDate
                  WHERE SS_ID = @SS_ID
                `);
            } else {
              // Insert new rebate entry
              await pool.request()
                .input('CustomerId', sql.Int, parseInt(CustomerId))
                .input('SpecificRebateCode', sql.NVarChar(5), r.SpecificRebateCode || null)
                .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
                .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
                .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
                .input('TierOverride', sql.NVarChar(16), r.TierOverride || null)
                .input('ProgramYear', sql.Int, year)
                .input('CreatedBy', sql.NVarChar(50), combinedUser)
                .input('CreatedDate', sql.DateTime2, now)
                .input('ModifiedBy', sql.NVarChar(50), combinedUser)
                .input('ModifiedDate', sql.DateTime2, now)
                .query(`
                  INSERT INTO tcpp.[CustomerRebate] (
                    CustomerId, SpecificRebateCode, ACSRebatePercent, CashRebatePercent, RebatePercent, TierOverride,
                    ProgramYear, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
                  )
                  VALUES (
                    @CustomerId, @SpecificRebateCode, @ACSRebatePercent, @CashRebatePercent, @RebatePercent, @TierOverride,
                    @ProgramYear, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
                  )
                `);
            }
          }
        }
      }

      res.json({ message: 'Customer and related rebates updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/customers):', error.message);
      res.status(500).json({ error: 'Failed to update customer', details: error.message });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[Customer] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Customer deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/customers):', error.message);
      res.status(500).json({ error: 'Failed to delete customer', details: error.message });
    }
  });

  app.get('/api/groups', async (req, res) => {
    try {

      const pool = await getPool();
      const currentYear = new Date().getFullYear();
      const result = await pool.request()
        .input('CurrentYear', sql.Int, currentYear)
        .query(`
          SELECT 
            g.SS_ID, 
            g.GroupId, 
            g.GroupName, 
            g.IsSefa, 
            g.IsCanadian, 
            g.IsActive, 
            g.Notes, 
            g.CreatedBy, 
            g.CreatedDate, 
            g.ModifiedBy, 
            g.ModifiedDate,
            gr.ACSRebatePercent,
            gr.CashRebatePercent,
            gr.RebatePercent,
            gr.ManagementFeePercent,
            gr.ProgramYear
          FROM tcpp.[Groups] g
          LEFT JOIN tcpp.[GroupRebate] gr ON g.GroupId = gr.GroupId AND gr.ProgramYear = @CurrentYear
          ORDER BY g.GroupName
        `);
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/groups):', error.message);
      res.status(500).json({ error: 'Failed to fetch customer groups', details: error.message });
    }
  });

  app.post('/api/groups', async (req, res) => {
    try {

      const { GroupId, GroupName, IsSefa, IsCanadian, IsActive, Notes, rebates } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);
          const parsedMgmt = parseNullableFloat(r.ManagementFeePercent);

          const valuesToCheck = [parsedACS, parsedCash, parsedRebate, parsedMgmt];
          for (const val of valuesToCheck) {
            if (val !== null && (val < 0 || val > 100)) {
              return res.status(400).json({ error: 'Validation failed', details: 'All rebate percentages must be between 0 and 100 or left blank.' });
            }
          }
        }
      }

      const pool = await getPool();

      // Check if GroupId already exists
      const checkResult = await pool.request()
        .input('GroupId', sql.NVarChar(10), GroupId)
        .query('SELECT GroupId FROM tcpp.[Groups] WHERE GroupId = @GroupId');
      if (checkResult.recordset.length > 0) {
        return res.status(400).json({ error: 'Duplicate Group ID', details: `A group with Group ID "${GroupId}" already exists.` });
      }

      await pool.request()
        .input('GroupId', sql.NVarChar(10), GroupId)
        .input('GroupName', sql.NVarChar(100), GroupName)
        .input('IsSefa', sql.Bit, IsSefa ? 1 : 0)
        .input('IsCanadian', sql.Bit, IsCanadian ? 1 : 0)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('Notes', sql.NVarChar(500), Notes)
        .input('CreatedBy', sql.NVarChar(50), combinedUser)
        .input('CreatedDate', sql.DateTime2, now)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[Groups] (GroupId, GroupName, IsSefa, IsCanadian, IsActive, Notes, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate)
          VALUES (@GroupId, @GroupName, @IsSefa, @IsCanadian, @IsActive, @Notes, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate)
        `);

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);
          const parsedMgmt = parseNullableFloat(r.ManagementFeePercent);
          const year = parseInt(r.ProgramYear);

          if (isNaN(year)) continue;

          await pool.request()
            .input('GroupId', sql.NVarChar(10), GroupId)
            .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
            .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
            .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
            .input('ManagementFeePercent', sql.Decimal(5, 2), parsedMgmt)
            .input('ProgramYear', sql.Int, year)
            .input('CreatedBy', sql.NVarChar(50), combinedUser)
            .input('CreatedDate', sql.DateTime2, now)
            .input('ModifiedBy', sql.NVarChar(50), combinedUser)
            .input('ModifiedDate', sql.DateTime2, now)
            .query(`
              INSERT INTO tcpp.[GroupRebate] (
                GroupId, ACSRebatePercent, CashRebatePercent, RebatePercent, ManagementFeePercent,
                ProgramYear, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
              )
              VALUES (
                @GroupId, @ACSRebatePercent, @CashRebatePercent, @RebatePercent, @ManagementFeePercent,
                @ProgramYear, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
              )
            `);
        }
      }

      res.status(201).json({ message: 'Customer group and related rebates created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/groups):', error.message);
      res.status(500).json({ error: 'Failed to create customer group', details: error.message });
    }
  });

  app.put('/api/groups/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const { GroupId, GroupName, IsSefa, IsCanadian, IsActive, Notes, rebates } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);
          const parsedMgmt = parseNullableFloat(r.ManagementFeePercent);

          const valuesToCheck = [parsedACS, parsedCash, parsedRebate, parsedMgmt];
          for (const val of valuesToCheck) {
            if (val !== null && (val < 0 || val > 100)) {
              return res.status(400).json({ error: 'Validation failed', details: 'All rebate percentages must be between 0 and 100 or left blank.' });
            }
          }
        }
      }

      const pool = await getPool();

      // Get old GroupId to update matching records in tcpp.[GroupRebate] if GroupId changes
      const groupResult = await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('SELECT GroupId FROM tcpp.[Groups] WHERE SS_ID = @SS_ID');
      const oldGroupId = groupResult.recordset[0]?.GroupId;

      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('GroupId', sql.NVarChar(10), GroupId)
        .input('GroupName', sql.NVarChar(100), GroupName)
        .input('IsSefa', sql.Bit, IsSefa ? 1 : 0)
        .input('IsCanadian', sql.Bit, IsCanadian ? 1 : 0)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('Notes', sql.NVarChar(500), Notes)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[Groups]
          SET GroupId = @GroupId,
              GroupName = @GroupName,
              IsSefa = @IsSefa,
              IsCanadian = @IsCanadian,
              IsActive = @IsActive,
              Notes = @Notes,
              ModifiedBy = @ModifiedBy,
              ModifiedDate = @ModifiedDate
          WHERE SS_ID = @SS_ID
        `);

      if (oldGroupId && oldGroupId !== GroupId) {
        await pool.request()
          .input('OldGroupId', sql.NVarChar(10), oldGroupId)
          .input('NewGroupId', sql.NVarChar(10), GroupId)
          .query('UPDATE tcpp.[GroupRebate] SET GroupId = @NewGroupId WHERE GroupId = @OldGroupId');
      }

      if (Array.isArray(rebates)) {
        for (const r of rebates) {
          const parsedACS = parseNullableFloat(r.ACSRebatePercent);
          const parsedCash = parseNullableFloat(r.CashRebatePercent);
          const parsedRebate = parseNullableFloat(r.RebatePercent);
          const parsedMgmt = parseNullableFloat(r.ManagementFeePercent);
          const year = parseInt(r.ProgramYear);

          if (isNaN(year)) continue;

          if (r.SS_ID) {
            // Update existing rebate entry
            await pool.request()
              .input('SS_ID', sql.Int, r.SS_ID)
              .input('GroupId', sql.NVarChar(10), GroupId)
              .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
              .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
              .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
              .input('ManagementFeePercent', sql.Decimal(5, 2), parsedMgmt)
              .input('ProgramYear', sql.Int, year)
              .input('ModifiedBy', sql.NVarChar(50), combinedUser)
              .input('ModifiedDate', sql.DateTime2, now)
              .query(`
                UPDATE tcpp.[GroupRebate]
                SET GroupId = @GroupId,
                    ACSRebatePercent = @ACSRebatePercent,
                    CashRebatePercent = @CashRebatePercent,
                    RebatePercent = @RebatePercent,
                    ManagementFeePercent = @ManagementFeePercent,
                    ProgramYear = @ProgramYear,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = @ModifiedDate
                WHERE SS_ID = @SS_ID
              `);
          } else {
            // Check if year already exists for this GroupId (unique constraint)
            const existCheck = await pool.request()
              .input('GroupId', sql.NVarChar(10), GroupId)
              .input('ProgramYear', sql.Int, year)
              .query('SELECT SS_ID FROM tcpp.[GroupRebate] WHERE GroupId = @GroupId AND ProgramYear = @ProgramYear');

            if (existCheck.recordset.length > 0) {
              await pool.request()
                .input('SS_ID', sql.Int, existCheck.recordset[0].SS_ID)
                .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
                .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
                .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
                .input('ManagementFeePercent', sql.Decimal(5, 2), parsedMgmt)
                .input('ModifiedBy', sql.NVarChar(50), combinedUser)
                .input('ModifiedDate', sql.DateTime2, now)
                .query(`
                  UPDATE tcpp.[GroupRebate]
                  SET ACSRebatePercent = @ACSRebatePercent,
                      CashRebatePercent = @CashRebatePercent,
                      RebatePercent = @RebatePercent,
                      ManagementFeePercent = @ManagementFeePercent,
                      ModifiedBy = @ModifiedBy,
                      ModifiedDate = @ModifiedDate
                  WHERE SS_ID = @SS_ID
                `);
            } else {
              // Insert new rebate entry
              await pool.request()
                .input('GroupId', sql.NVarChar(10), GroupId)
                .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
                .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
                .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
                .input('ManagementFeePercent', sql.Decimal(5, 2), parsedMgmt)
                .input('ProgramYear', sql.Int, year)
                .input('CreatedBy', sql.NVarChar(50), combinedUser)
                .input('CreatedDate', sql.DateTime2, now)
                .input('ModifiedBy', sql.NVarChar(50), combinedUser)
                .input('ModifiedDate', sql.DateTime2, now)
                .query(`
                  INSERT INTO tcpp.[GroupRebate] (
                    GroupId, ACSRebatePercent, CashRebatePercent, RebatePercent, ManagementFeePercent,
                    ProgramYear, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
                  )
                  VALUES (
                    @GroupId, @ACSRebatePercent, @CashRebatePercent, @RebatePercent, @ManagementFeePercent,
                    @ProgramYear, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
                  )
                `);
            }
          }
        }
      }

      res.json({ message: 'Customer group and related rebates updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/groups):', error.message);
      res.status(500).json({ error: 'Failed to update customer group', details: error.message });
    }
  });

  app.delete('/api/groups/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[Groups] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Customer group deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/groups):', error.message);
      res.status(500).json({ error: 'Failed to delete customer group', details: error.message });
    }
  });

  // Customer Rebates API Routes
  app.get('/api/customer-rebates', async (req, res) => {
    let attempt = 1;
    const maxAttempts = 2;
    while (attempt <= maxAttempts) {
      try {
        const pool = await getPool();
        const { customerId } = req.query;
        let query = `
          SELECT cr.* 
          FROM tcpp.[CustomerRebate] cr
        `;
        const reqInstance = pool.request();
        if (customerId) {
          query += ` WHERE cr.CustomerId = @CustomerId `;
          reqInstance.input('CustomerId', sql.Int, parseInt(customerId as string));
        }
        query += ` ORDER BY cr.ProgramYear DESC `;
        
        const result = await reqInstance.query(query);
        return res.json(result.recordset);
      } catch (error: any) {
        console.warn(`SQL Server error (GET /api/customer-rebates) attempt ${attempt}/${maxAttempts}:`, error.message);
        if (attempt < maxAttempts && (error.message.toLowerCase().includes('abort') || error.message.toLowerCase().includes('connection') || error.message.toLowerCase().includes('closed') || error.message.toLowerCase().includes('aborted'))) {
          console.log('🔄 Transient connection error detected. Resetting SQL Pool and retrying...');
          sqlPool = null;
          poolConnecting = null;
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('SQL Server error (GET /api/customer-rebates):', error.message);
          return res.status(500).json({ error: 'Failed to fetch customer rebates', details: error.message });
        }
      }
    }
  });

  // Group Rebates API Routes
  app.get('/api/group-rebates', async (req, res) => {
    let attempt = 1;
    const maxAttempts = 2;
    while (attempt <= maxAttempts) {
      try {
        const pool = await getPool();
        const { groupId } = req.query;
        let query = `
          SELECT gr.*, g.GroupName 
          FROM tcpp.[GroupRebate] gr
          JOIN tcpp.[Groups] g ON gr.GroupId = g.GroupId
        `;
        const reqInstance = pool.request();
        if (groupId) {
          query += ` WHERE gr.GroupId = @GroupId `;
          reqInstance.input('GroupId', sql.NVarChar(10), groupId);
        }
        query += ` ORDER BY gr.ProgramYear DESC, g.GroupName `;
        
        const result = await reqInstance.query(query);
        return res.json(result.recordset);
      } catch (error: any) {
        console.warn(`SQL Server error (GET /api/group-rebates) attempt ${attempt}/${maxAttempts}:`, error.message);
        if (attempt < maxAttempts && (error.message.toLowerCase().includes('abort') || error.message.toLowerCase().includes('connection') || error.message.toLowerCase().includes('closed') || error.message.toLowerCase().includes('aborted'))) {
          console.log('🔄 Transient connection error detected. Resetting SQL Pool and retrying...');
          sqlPool = null;
          poolConnecting = null;
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('SQL Server error (GET /api/group-rebates):', error.message);
          return res.status(500).json({ error: 'Failed to fetch group rebates', details: error.message });
        }
      }
    }
  });

  const parseNullableFloat = (val: any) => {
    if (val === undefined || val === null || String(val).trim() === '') {
      return null;
    }
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  };

  app.post('/api/group-rebates', async (req, res) => {
    try {
      const { 
        GroupId, 
        ACSRebatePercent, 
        CashRebatePercent,
        RebatePercent,
        BronzeRebatePercent,
        SilverRebatePercent,
        GoldRebatePercent,
        PlatinumRebatePercent,
        ProgramYear
      } = req.body;

      const parsedACS = parseNullableFloat(ACSRebatePercent);
      const parsedCash = parseNullableFloat(CashRebatePercent);
      const parsedRebate = parseNullableFloat(RebatePercent);
      const parsedBronze = parseNullableFloat(BronzeRebatePercent);
      const parsedSilver = parseNullableFloat(SilverRebatePercent);
      const parsedGold = parseNullableFloat(GoldRebatePercent);
      const parsedPlatinum = parseNullableFloat(PlatinumRebatePercent);

      const fieldsToCheck = {
        ACSRebatePercent: parsedACS,
        CashRebatePercent: parsedCash,
        RebatePercent: parsedRebate,
        BronzeRebatePercent: parsedBronze,
        SilverRebatePercent: parsedSilver,
        GoldRebatePercent: parsedGold,
        PlatinumRebatePercent: parsedPlatinum
      };

      for (const [key, value] of Object.entries(fieldsToCheck)) {
        if (value !== null) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ 
              error: 'Validation failed', 
              details: `${key} must be between 0 and 100 or left blank` 
            });
          }
        }
      }

      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('GroupId', sql.NVarChar(10), GroupId)
        .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
        .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
        .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
        .input('BronzeRebatePercent', sql.Decimal(5, 2), parsedBronze)
        .input('SilverRebatePercent', sql.Decimal(5, 2), parsedSilver)
        .input('GoldRebatePercent', sql.Decimal(5, 2), parsedGold)
        .input('PlatinumRebatePercent', sql.Decimal(5, 2), parsedPlatinum)
        .input('ProgramYear', sql.Int, parseInt(ProgramYear))
        .input('CreatedBy', sql.NVarChar(50), combinedUser)
        .input('CreatedDate', sql.DateTime2, now)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[GroupRebate] (
            GroupId, ACSRebatePercent, CashRebatePercent, RebatePercent,
            BronzeRebatePercent, SilverRebatePercent, GoldRebatePercent, PlatinumRebatePercent, 
            ProgramYear, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (
            @GroupId, @ACSRebatePercent, @CashRebatePercent, @RebatePercent,
            @BronzeRebatePercent, @SilverRebatePercent, @GoldRebatePercent, @PlatinumRebatePercent, 
            @ProgramYear, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
          )
        `);
      res.status(201).json({ message: 'Group rebate created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/group-rebates):', error.message);
      res.status(500).json({ error: 'Failed to create group rebate', details: error.message });
    }
  });

  app.put('/api/group-rebates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        GroupId, 
        ACSRebatePercent, 
        CashRebatePercent,
        RebatePercent,
        BronzeRebatePercent,
        SilverRebatePercent,
        GoldRebatePercent,
        PlatinumRebatePercent,
        ProgramYear
      } = req.body;

      const parsedACS = parseNullableFloat(ACSRebatePercent);
      const parsedCash = parseNullableFloat(CashRebatePercent);
      const parsedRebate = parseNullableFloat(RebatePercent);
      const parsedBronze = parseNullableFloat(BronzeRebatePercent);
      const parsedSilver = parseNullableFloat(SilverRebatePercent);
      const parsedGold = parseNullableFloat(GoldRebatePercent);
      const parsedPlatinum = parseNullableFloat(PlatinumRebatePercent);

      const fieldsToCheck = {
        ACSRebatePercent: parsedACS,
        CashRebatePercent: parsedCash,
        RebatePercent: parsedRebate,
        BronzeRebatePercent: parsedBronze,
        SilverRebatePercent: parsedSilver,
        GoldRebatePercent: parsedGold,
        PlatinumRebatePercent: parsedPlatinum
      };

      for (const [key, value] of Object.entries(fieldsToCheck)) {
        if (value !== null) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ 
              error: 'Validation failed', 
              details: `${key} must be between 0 and 100 or left blank` 
            });
          }
        }
      }

      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('GroupId', sql.NVarChar(10), GroupId)
        .input('ACSRebatePercent', sql.Decimal(5, 2), parsedACS)
        .input('CashRebatePercent', sql.Decimal(5, 2), parsedCash)
        .input('RebatePercent', sql.Decimal(5, 2), parsedRebate)
        .input('BronzeRebatePercent', sql.Decimal(5, 2), parsedBronze)
        .input('SilverRebatePercent', sql.Decimal(5, 2), parsedSilver)
        .input('GoldRebatePercent', sql.Decimal(5, 2), parsedGold)
        .input('PlatinumRebatePercent', sql.Decimal(5, 2), parsedPlatinum)
        .input('ProgramYear', sql.Int, parseInt(ProgramYear))
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[GroupRebate]
          SET GroupId = @GroupId,
              ACSRebatePercent = @ACSRebatePercent,
              CashRebatePercent = @CashRebatePercent,
              RebatePercent = @RebatePercent,
              BronzeRebatePercent = @BronzeRebatePercent,
              SilverRebatePercent = @SilverRebatePercent,
              GoldRebatePercent = @GoldRebatePercent,
              PlatinumRebatePercent = @PlatinumRebatePercent,
              ProgramYear = @ProgramYear,
              ModifiedBy = @ModifiedBy,
              ModifiedDate = @ModifiedDate
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'Group rebate updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/group-rebates):', error.message);
      res.status(500).json({ error: 'Failed to update group rebate', details: error.message });
    }
  });

  app.delete('/api/group-rebates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[GroupRebate] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Group rebate deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/group-rebates):', error.message);
      res.status(500).json({ error: 'Failed to delete group rebate', details: error.message });
    }
  });

  // Global Rebates Endpoints
  app.get('/api/global-rebates', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT * FROM tcpp.[GlobalRebates] ORDER BY ProgramYear DESC');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/global-rebates):', error.message);
      res.status(500).json({ error: 'Failed to fetch global rebates', details: error.message });
    }
  });

  app.post('/api/global-rebates', async (req, res) => {
    try {
      const { 
        ManagementFeePercent,
        ACSRebatePercent, CashRebatePercent, RebatePercent,
        ProgramYear 
      } = req.body;

      const parsedMF = parseNullableFloat(ManagementFeePercent);
      const parsedACS = parseNullableFloat(ACSRebatePercent);
      const parsedCash = parseNullableFloat(CashRebatePercent);
      const parsedRebate = parseNullableFloat(RebatePercent);

      const fieldsToCheck = {
        ManagementFeePercent: parsedMF,
        ACSRebatePercent: parsedACS,
        CashRebatePercent: parsedCash,
        RebatePercent: parsedRebate,
      };

      for (const [key, value] of Object.entries(fieldsToCheck)) {
        if (value !== null) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ 
              error: 'Validation failed', 
              details: `${key} must be between 0 and 100 or left blank` 
            });
          }
        }
      }

      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('MF', sql.Decimal(5, 2), parsedMF)
        .input('ACS', sql.Decimal(5, 2), parsedACS)
        .input('Cash', sql.Decimal(5, 2), parsedCash)
        .input('Rebate', sql.Decimal(5, 2), parsedRebate)
        .input('Year', sql.Int, parseInt(ProgramYear))
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[GlobalRebates] (
            ManagementFeePercent,
            ACSRebatePercent, CashRebatePercent, RebatePercent,
            ProgramYear, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (@MF, @ACS, @Cash, @Rebate, @Year, @User, @Now, @User, @Now)
        `);
      res.status(201).json({ message: 'Global rebate created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/global-rebates):', error.message);
      res.status(500).json({ error: 'Failed to create global rebate', details: error.message });
    }
  });

  app.put('/api/global-rebates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        ManagementFeePercent,
        ACSRebatePercent, CashRebatePercent, RebatePercent,
        ProgramYear 
      } = req.body;

      const parsedMF = parseNullableFloat(ManagementFeePercent);
      const parsedACS = parseNullableFloat(ACSRebatePercent);
      const parsedCash = parseNullableFloat(CashRebatePercent);
      const parsedRebate = parseNullableFloat(RebatePercent);

      const fieldsToCheck = {
        ManagementFeePercent: parsedMF,
        ACSRebatePercent: parsedACS,
        CashRebatePercent: parsedCash,
        RebatePercent: parsedRebate,
      };

      for (const [key, value] of Object.entries(fieldsToCheck)) {
        if (value !== null) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ 
              error: 'Validation failed', 
              details: `${key} must be between 0 and 100 or left blank` 
            });
          }
        }
      }

      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('MF', sql.Decimal(5, 2), parsedMF)
        .input('ACS', sql.Decimal(5, 2), parsedACS)
        .input('Cash', sql.Decimal(5, 2), parsedCash)
        .input('Rebate', sql.Decimal(5, 2), parsedRebate)
        .input('Year', sql.Int, parseInt(ProgramYear))
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[GlobalRebates]
          SET ManagementFeePercent = @MF,
              ACSRebatePercent = @ACS,
              CashRebatePercent = @Cash,
              RebatePercent = @Rebate,
              ProgramYear = @Year,
              ModifiedBy = @User,
              ModifiedDate = @Now
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'Global rebate updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/global-rebates):', error.message);
      res.status(500).json({ error: 'Failed to update global rebate', details: error.message });
    }
  });

  app.delete('/api/global-rebates/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[GlobalRebates] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Global rebate deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/global-rebates):', error.message);
      res.status(500).json({ error: 'Failed to delete global rebate', details: error.message });
    }
  });

  // Product Exclusions Endpoints
  app.get('/api/product-exclusions', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT * FROM tcpp.[ProductExclusion] ORDER BY ProductCode, ProgramYear DESC');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/product-exclusions):', error.message);
      res.status(500).json({ error: 'Failed to fetch product exclusions', details: error.message });
    }
  });

  app.get('/api/product-categories', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query("SELECT ProductCategory FROM ref.ProductScreenCategory WHERE ScreenName = 'UDC_56_EQ' ORDER BY ProductCategory");
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/product-categories):', error.message);
      res.status(500).json({ error: 'Failed to fetch product categories', details: error.message });
    }
  });

  // Non-US Rebate Criteria Endpoints
  app.get('/api/non-us-rebate-criteria', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT * FROM tcpp.[NonUSRebateCriteria] ORDER BY ProductCode, ProgramYear DESC');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/non-us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to fetch Non-US rebate criteria', details: error.message });
    }
  });

  app.get('/api/non-us-product-categories', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query("SELECT ProductCategory FROM ref.ProductScreenCategory WHERE ScreenName = 'UDC_57_T1_CA' ORDER BY ProductCategory");
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/non-us-product-categories):', error.message);
      res.status(500).json({ error: 'Failed to fetch Non-US product categories', details: error.message });
    }
  });

  app.post('/api/non-us-rebate-criteria', async (req, res) => {
    try {
      const { ProductCode, ProgramYear, TargetCriteria, TargetThreshold, Notes } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Criteria', sql.NVarChar(32), TargetCriteria)
        .input('Threshold', sql.Decimal(12, 2), parseFloat(TargetThreshold))
        .input('Notes', sql.NVarChar(200), Notes || null)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[NonUSRebateCriteria] (
            ProductCode, ProgramYear, TargetCriteria, TargetThreshold, Notes, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (@Code, @Year, @Criteria, @Threshold, @Notes, @User, @Now, @User, @Now)
        `);
      res.status(201).json({ message: 'Non-US rebate criteria created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/non-us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to create Non-US rebate criteria', details: error.message });
    }
  });

  app.put('/api/non-us-rebate-criteria/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { ProductCode, ProgramYear, TargetCriteria, TargetThreshold, Notes } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Criteria', sql.NVarChar(32), TargetCriteria)
        .input('Threshold', sql.Decimal(12, 2), parseFloat(TargetThreshold))
        .input('Notes', sql.NVarChar(200), Notes || null)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[NonUSRebateCriteria]
          SET ProductCode = @Code,
              ProgramYear = @Year,
              TargetCriteria = @Criteria,
              TargetThreshold = @Threshold,
              Notes = @Notes,
              ModifiedBy = @User,
              ModifiedDate = @Now
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'Non-US rebate criteria updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/non-us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to update Non-US rebate criteria', details: error.message });
    }
  });

  app.delete('/api/non-us-rebate-criteria/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[NonUSRebateCriteria] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Non-US rebate criteria deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/non-us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to delete Non-US rebate criteria', details: error.message });
    }
  });

  // US Rebate Criteria Endpoints
  app.get('/api/us-rebate-criteria', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT * FROM tcpp.[USRebateCriteria] ORDER BY ProductCode, ProgramYear DESC');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to fetch US rebate criteria', details: error.message });
    }
  });

  app.get('/api/us-product-categories', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query("SELECT ProductCategory FROM ref.ProductScreenCategory WHERE ScreenName = 'UDC_57_TT_US' ORDER BY ProductCategory");
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/us-product-categories):', error.message);
      res.status(500).json({ error: 'Failed to fetch US product categories', details: error.message });
    }
  });

  app.get('/api/target-categories', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT TargetCategory FROM ref.TargetCategory ORDER BY TargetCategory');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/target-categories):', error.message);
      res.status(500).json({ error: 'Failed to fetch target categories', details: error.message });
    }
  });

  app.post('/api/us-rebate-criteria', async (req, res) => {
    try {
      const { ProductCode, ProgramYear, TargetCriteria, TargetThreshold, Notes } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Criteria', sql.NVarChar(32), TargetCriteria)
        .input('Threshold', sql.Decimal(12, 2), parseFloat(TargetThreshold))
        .input('Notes', sql.NVarChar(200), Notes || null)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[USRebateCriteria] (
            ProductCode, ProgramYear, TargetCriteria, TargetThreshold, Notes, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (@Code, @Year, @Criteria, @Threshold, @Notes, @User, @Now, @User, @Now)
        `);
      res.status(201).json({ message: 'US rebate criteria created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to create US rebate criteria', details: error.message });
    }
  });

  app.put('/api/us-rebate-criteria/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { ProductCode, ProgramYear, TargetCriteria, TargetThreshold, Notes } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Criteria', sql.NVarChar(32), TargetCriteria)
        .input('Threshold', sql.Decimal(12, 2), parseFloat(TargetThreshold))
        .input('Notes', sql.NVarChar(200), Notes || null)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[USRebateCriteria]
          SET ProductCode = @Code,
              ProgramYear = @Year,
              TargetCriteria = @Criteria,
              TargetThreshold = @Threshold,
              Notes = @Notes,
              ModifiedBy = @User,
              ModifiedDate = @Now
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'US rebate criteria updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to update US rebate criteria', details: error.message });
    }
  });

  app.delete('/api/us-rebate-criteria/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[USRebateCriteria] WHERE SS_ID = @SS_ID');
      res.json({ message: 'US rebate criteria deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/us-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to delete US rebate criteria', details: error.message });
    }
  });

  // SEFA Rebate Criteria Endpoints
  app.get('/api/sefa-rebate-criteria', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT * FROM tcpp.[SEFARebateCriteria] ORDER BY ProductCode, ProgramYear DESC');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/sefa-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to fetch SEFA rebate criteria', details: error.message });
    }
  });

  app.get('/api/sefa-product-categories', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query("SELECT ProductCategory FROM ref.ProductScreenCategory WHERE ScreenName = 'SEFA_YOY' ORDER BY ProductCategory");
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/sefa-product-categories):', error.message);
      res.status(500).json({ error: 'Failed to fetch SEFA product categories', details: error.message });
    }
  });

  app.post('/api/sefa-rebate-criteria', async (req, res) => {
    try {
      const { ProductCode, ProgramYear, ExclusionReason, TargetThresholdPercent } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Reason', sql.NVarChar(200), ExclusionReason || null)
        .input('Threshold', sql.Decimal(5, 2), TargetThresholdPercent)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[SEFARebateCriteria] (
            ProductCode, ProgramYear, ExclusionReason, TargetThresholdPercent, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (@Code, @Year, @Reason, @Threshold, @User, @Now, @User, @Now)
        `);
      res.status(201).json({ message: 'SEFA rebate criteria created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/sefa-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to create SEFA rebate criteria', details: error.message });
    }
  });

  app.put('/api/sefa-rebate-criteria/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { ProductCode, ProgramYear, ExclusionReason, TargetThresholdPercent } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Reason', sql.NVarChar(200), ExclusionReason || null)
        .input('Threshold', sql.Decimal(5, 2), TargetThresholdPercent)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[SEFARebateCriteria]
          SET ProductCode = @Code,
              ProgramYear = @Year,
              ExclusionReason = @Reason,
              TargetThresholdPercent = @Threshold,
              ModifiedBy = @User,
              ModifiedDate = @Now
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'SEFA rebate criteria updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/sefa-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to update SEFA rebate criteria', details: error.message });
    }
  });

  app.delete('/api/sefa-rebate-criteria/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[SEFARebateCriteria] WHERE SS_ID = @SS_ID');
      res.json({ message: 'SEFA rebate criteria deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/sefa-rebate-criteria):', error.message);
      res.status(500).json({ error: 'Failed to delete SEFA rebate criteria', details: error.message });
    }
  });

  app.post('/api/product-exclusions', async (req, res) => {
    try {
      const { 
        ProductCode, ProgramYear, ExclusionReason 
      } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Reason', sql.NVarChar(200), ExclusionReason || null)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[ProductExclusion] (
            ProductCode, ProgramYear, ExclusionReason, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (@Code, @Year, @Reason, @User, @Now, @User, @Now)
        `);
      res.status(201).json({ message: 'Product exclusion created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/product-exclusions):', error.message);
      res.status(500).json({ error: 'Failed to create product exclusion', details: error.message });
    }
  });

  app.put('/api/product-exclusions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        ProductCode, ProgramYear, ExclusionReason 
      } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('Code', sql.NVarChar(64), ProductCode)
        .input('Year', sql.SmallInt, parseInt(ProgramYear))
        .input('Reason', sql.NVarChar(200), ExclusionReason || null)
        .input('User', sql.NVarChar(50), combinedUser)
        .input('Now', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[ProductExclusion]
          SET ProductCode = @Code,
              ProgramYear = @Year,
              ExclusionReason = @Reason,
              ModifiedBy = @User,
              ModifiedDate = @Now
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'Product exclusion updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/product-exclusions):', error.message);
      res.status(500).json({ error: 'Failed to update product exclusion', details: error.message });
    }
  });

  app.delete('/api/product-exclusions/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[ProductExclusion] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Product exclusion deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/product-exclusions):', error.message);
      res.status(500).json({ error: 'Failed to delete product exclusion', details: error.message });
    }
  });

  // Customer Group Membership API Routes
  app.get('/api/customer-group-membership', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT m.*, cm.CustomerName, g.GroupName 
        FROM tcpp.[CustomerGroupMembership] m
        LEFT JOIN ref.[CustomerMaster] cm ON m.CustomerId = cm.CustomerId
        LEFT JOIN tcpp.[Groups] g ON m.GroupId = g.GroupId
        ORDER BY m.DateEffective DESC, cm.CustomerName
      `);
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-group-membership):', error.message);
      res.status(500).json({ error: 'Failed to fetch memberships', details: error.message });
    }
  });

  app.post('/api/customer-group-membership', async (req, res) => {
    try {

      const { 
        CustomerId, GroupId, 
        DateEffective, DateExpired, Notes 
      } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('GroupId', sql.NVarChar(10), GroupId)
        .input('DateEffective', sql.Date, DateEffective)
        .input('DateExpired', sql.Date, DateExpired || null)
        .input('Notes', sql.NVarChar(500), Notes || null)
        .input('CreatedBy', sql.NVarChar(50), combinedUser)
        .input('CreatedDate', sql.DateTime2, now)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[CustomerGroupMembership] (
            CustomerId, GroupId, 
            DateEffective, DateExpired, Notes, 
            CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (
            @CustomerId, @GroupId, 
            @DateEffective, @DateExpired, @Notes, 
            @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
          )
        `);
      res.status(201).json({ message: 'Membership created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/customer-group-membership):', error.message);
      res.status(500).json({ error: 'Failed to create membership', details: error.message });
    }
  });

  app.put('/api/customer-group-membership/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const { 
        CustomerId, GroupId, 
        DateEffective, DateExpired, Notes 
      } = req.body;
      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('MembershipId', sql.Int, id)
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('GroupId', sql.NVarChar(10), GroupId)
        .input('DateEffective', sql.Date, DateEffective)
        .input('DateExpired', sql.Date, DateExpired || null)
        .input('Notes', sql.NVarChar(500), Notes || null)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[CustomerGroupMembership]
          SET CustomerId = @CustomerId,
              GroupId = @GroupId,
              DateEffective = @DateEffective,
              DateExpired = @DateExpired,
              Notes = @Notes,
              ModifiedBy = @ModifiedBy,
              ModifiedDate = @ModifiedDate
          WHERE MembershipId = @MembershipId
        `);
      res.json({ message: 'Membership updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/customer-group-membership):', error.message);
      res.status(500).json({ error: 'Failed to update membership', details: error.message });
    }
  });

  app.delete('/api/customer-group-membership/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('MembershipId', sql.Int, id)
        .query('DELETE FROM tcpp.[CustomerGroupMembership] WHERE MembershipId = @MembershipId');
      res.json({ message: 'Membership deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/customer-group-membership):', error.message);
      res.status(500).json({ error: 'Failed to delete membership', details: error.message });
    }
  });

  // Tiers Reference Data
  app.get('/api/tiers', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query('SELECT * FROM ref.[Tier] ORDER BY TierCode');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/tiers):', error.message);
      res.status(500).json({ error: 'Failed to fetch tiers', details: error.message });
    }
  });

  // Customer Tier Overrides API Routes
  app.get('/api/customer-tier-overrides', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT o.*, c.DealerName 
        FROM tcpp.[CustomerTierOverride] o
        LEFT JOIN tcpp.[Customer] c ON o.CustomerId = c.CustomerId
        ORDER BY o.ProgramYear DESC, c.DealerName
      `);
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-tier-overrides):', error.message);
      res.status(500).json({ error: 'Failed to fetch overrides', details: error.message });
    }
  });

  app.post('/api/customer-tier-overrides', async (req, res) => {
    try {

      const { 
        CustomerId, ProgramYear, OverrideTierCode, 
        OverrideReason, ApprovedBy, IsActive 
      } = req.body;
      const user = req.headers['x-user-email'] || 'None';
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.SmallInt, parseInt(ProgramYear))
        .input('OverrideTierCode', sql.NVarChar(20), OverrideTierCode)
        .input('OverrideReason', sql.NVarChar(500), OverrideReason)
        .input('ApprovedBy', sql.NVarChar(100), ApprovedBy)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('CreatedBy', sql.NVarChar(50), user)
        .input('CreatedDate', sql.DateTime2, now)
        .input('ModifiedBy', sql.NVarChar(50), user)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[CustomerTierOverride] (
            CustomerId, ProgramYear, OverrideTierCode, 
            OverrideReason, ApprovedBy, IsActive, 
            CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
          )
          VALUES (
            @CustomerId, @ProgramYear, @OverrideTierCode, 
            @OverrideReason, @ApprovedBy, @IsActive, 
            @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate
          )
        `);
      res.status(201).json({ message: 'Override created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/customer-tier-overrides):', error.message);
      res.status(500).json({ error: 'Failed to create override', details: error.message });
    }
  });

  app.put('/api/customer-tier-overrides/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const { 
        CustomerId, ProgramYear, OverrideTierCode, 
        OverrideReason, ApprovedBy, IsActive 
      } = req.body;
      const user = req.headers['x-user-email'] || 'None';
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('OverrideId', sql.Int, id)
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.SmallInt, parseInt(ProgramYear))
        .input('OverrideTierCode', sql.NVarChar(20), OverrideTierCode)
        .input('OverrideReason', sql.NVarChar(500), OverrideReason)
        .input('ApprovedBy', sql.NVarChar(100), ApprovedBy)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('ModifiedBy', sql.NVarChar(50), user)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[CustomerTierOverride]
          SET CustomerId = @CustomerId,
              ProgramYear = @ProgramYear,
              OverrideTierCode = @OverrideTierCode,
              OverrideReason = @OverrideReason,
              ApprovedBy = @ApprovedBy,
              IsActive = @IsActive,
              ModifiedBy = @ModifiedBy,
              ModifiedDate = @ModifiedDate
          WHERE OverrideId = @OverrideId
        `);
      res.json({ message: 'Override updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/customer-tier-overrides):', error.message);
      res.status(500).json({ error: 'Failed to update override', details: error.message });
    }
  });

  app.delete('/api/customer-tier-overrides/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('OverrideId', sql.Int, id)
        .query('DELETE FROM tcpp.[CustomerTierOverride] WHERE OverrideId = @OverrideId');
      res.json({ message: 'Override deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/customer-tier-overrides):', error.message);
      res.status(500).json({ error: 'Failed to delete override', details: error.message });
    }
  });

  // Customer Specific Rebate API Routes
  app.get('/api/customer-specific-rebates', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT r.*, c.DealerName 
        FROM tcpp.[CustomerSpecificRebate] r
        LEFT JOIN tcpp.[Customer] c ON r.CustomerId = c.CustomerId
        ORDER BY r.ProgramYear DESC, c.DealerName
      `);
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-specific-rebates):', error.message);
      res.status(500).json({ error: 'Failed to fetch specific rebates', details: error.message });
    }
  });

  app.post('/api/customer-specific-rebates', async (req, res) => {
    try {

      const { 
        CustomerId, ProgramYear, RebateCode, 
        Notes, IsActive 
      } = req.body;
      const user = req.headers['x-user-email'] || 'None';
      const now = new Date();

      const pool = await getPool();
      await pool.request()
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.SmallInt, parseInt(ProgramYear))
        .input('RebateCode', sql.NVarChar(5), RebateCode)
        .input('Notes', sql.NVarChar(200), Notes || null)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .input('CreatedBy', sql.NVarChar(50), user)
        .input('CreatedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[CustomerSpecificRebate] (
            CustomerId, ProgramYear, RebateCode, 
            Notes, IsActive, 
            CreatedBy, CreatedDate
          )
          VALUES (
            @CustomerId, @ProgramYear, @RebateCode, 
            @Notes, @IsActive, 
            @CreatedBy, @CreatedDate
          )
        `);
      res.status(201).json({ message: 'Specific rebate created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/customer-specific-rebates):', error.message);
      res.status(500).json({ error: 'Failed to create specific rebate', details: error.message });
    }
  });

  app.put('/api/customer-specific-rebates/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const { 
        CustomerId, ProgramYear, RebateCode, 
        Notes, IsActive 
      } = req.body;

      const pool = await getPool();
      await pool.request()
        .input('SpecificRebateId', sql.Int, id)
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.SmallInt, parseInt(ProgramYear))
        .input('RebateCode', sql.NVarChar(5), RebateCode)
        .input('Notes', sql.NVarChar(200), Notes || null)
        .input('IsActive', sql.Bit, IsActive ? 1 : 0)
        .query(`
          UPDATE tcpp.[CustomerSpecificRebate]
          SET CustomerId = @CustomerId,
              ProgramYear = @ProgramYear,
              RebateCode = @RebateCode,
              Notes = @Notes,
              IsActive = @IsActive
          WHERE SpecificRebateId = @SpecificRebateId
        `);
      res.json({ message: 'Specific rebate updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/customer-specific-rebates):', error.message);
      res.status(500).json({ error: 'Failed to update specific rebate', details: error.message });
    }
  });

  app.delete('/api/customer-specific-rebates/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SpecificRebateId', sql.Int, id)
        .query('DELETE FROM tcpp.[CustomerSpecificRebate] WHERE SpecificRebateId = @SpecificRebateId');
      res.json({ message: 'Specific rebate deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/customer-specific-rebates):', error.message);
      res.status(500).json({ error: 'Failed to delete specific rebate', details: error.message });
    }
  });

  // Customer TCPP Qualifiers API Routes
  app.get('/api/customer-tcpp-qualifiers', async (req, res) => {
    try {

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT q.*, cm.CustomerName 
        FROM tcpp.[CustomerTCPPQualifier] q
        LEFT JOIN ref.[CustomerMaster] cm ON q.CustomerId = cm.CustomerId
        ORDER BY cm.CustomerName, q.ProgramYear DESC
      `);
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/customer-tcpp-qualifiers):', error.message);
      res.status(500).json({ error: 'Failed to fetch qualifiers', details: error.message });
    }
  });

  app.post('/api/customer-tcpp-qualifiers', async (req, res) => {
    try {

      const { 
        CustomerId, ProgramYear, PolicyComplianceQualifier, 
        MarketingSupportQualifier, AccessAndTrainingQualifier, 
        CarrierQualifier, AvoidAssessorialCharges,
        NegotiatedProgram, StrategicRebate
      } = req.body;

      const pYear = parseInt(ProgramYear);
      if (isNaN(pYear) || pYear < 2025 || pYear > 2050) {
        return res.status(400).json({ error: 'Validation failed', details: 'Program Year must be between 2025 and 2050.' });
      }

      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();

      // Unique constraint check (CustomerId + ProgramYear)
      const existingCheck = await pool.request()
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.Int, pYear)
        .query('SELECT SS_ID FROM tcpp.[CustomerTCPPQualifier] WHERE CustomerId = @CustomerId AND ProgramYear = @ProgramYear');

      if (existingCheck.recordset.length > 0) {
        return res.status(400).json({ 
          error: 'Duplicate record', 
          details: `A qualifier record for this customer (ID ${CustomerId}) and Program Year ${pYear} already exists.` 
        });
      }

      await pool.request()
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.Int, pYear)
        .input('PolicyComplianceQualifier', sql.Char(1), PolicyComplianceQualifier || null)
        .input('MarketingSupportQualifier', sql.Char(1), MarketingSupportQualifier || null)
        .input('AccessAndTrainingQualifier', sql.Char(1), AccessAndTrainingQualifier || null)
        .input('CarrierQualifier', sql.Char(1), CarrierQualifier || null)
        .input('AvoidAssessorialCharges', sql.Char(1), AvoidAssessorialCharges || null)
        .input('NegotiatedProgram', sql.Char(1), NegotiatedProgram || null)
        .input('StrategicRebate', sql.Char(1), StrategicRebate || null)
        .input('CreatedBy', sql.NVarChar(50), combinedUser)
        .input('CreatedDate', sql.DateTime2, now)
        .query(`
          INSERT INTO tcpp.[CustomerTCPPQualifier] (
            CustomerId, ProgramYear, PolicyComplianceQualifier, 
            MarketingSupportQualifier, AccessAndTrainingQualifier, 
            CarrierQualifier, AvoidAssessorialCharges,
            NegotiatedProgram, StrategicRebate,
            CreatedBy, CreatedDate
          )
          VALUES (
            @CustomerId, @ProgramYear, @PolicyComplianceQualifier, 
            @MarketingSupportQualifier, @AccessAndTrainingQualifier, 
            @CarrierQualifier, @AvoidAssessorialCharges,
            @NegotiatedProgram, @StrategicRebate,
            @CreatedBy, @CreatedDate
          )
        `);
      res.status(201).json({ message: 'Qualifier record created successfully' });
    } catch (error: any) {
      console.error('SQL Server error (POST /api/customer-tcpp-qualifiers):', error.message);
      res.status(500).json({ error: 'Failed to create qualifier', details: error.message });
    }
  });

  app.put('/api/customer-tcpp-qualifiers/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const { 
        CustomerId, ProgramYear, PolicyComplianceQualifier, 
        MarketingSupportQualifier, AccessAndTrainingQualifier, 
        CarrierQualifier, AvoidAssessorialCharges,
        NegotiatedProgram, StrategicRebate
      } = req.body;

      const pYear = parseInt(ProgramYear);
      if (isNaN(pYear) || pYear < 2025 || pYear > 2050) {
        return res.status(400).json({ error: 'Validation failed', details: 'Program Year must be between 2025 and 2050.' });
      }

      const userName = req.headers['x-user-name'] || 'None';
      const userEmail = req.headers['x-user-email'] || 'None';
      const combinedUser = userName !== 'None' && userEmail !== 'None' ? `${userName} (${userEmail})` : (userName !== 'None' ? userName : userEmail);
      const now = new Date();

      const pool = await getPool();

      // Check unique constraint excluding current record
      const dupCheck = await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.Int, pYear)
        .query('SELECT SS_ID FROM tcpp.[CustomerTCPPQualifier] WHERE CustomerId = @CustomerId AND ProgramYear = @ProgramYear AND SS_ID <> @SS_ID');

      if (dupCheck.recordset.length > 0) {
        return res.status(400).json({ 
          error: 'Duplicate record', 
          details: `A qualifier record for this customer (ID ${CustomerId}) and Program Year ${pYear} already exists.` 
        });
      }

      await pool.request()
        .input('SS_ID', sql.Int, id)
        .input('CustomerId', sql.Int, parseInt(CustomerId))
        .input('ProgramYear', sql.Int, pYear)
        .input('PolicyComplianceQualifier', sql.Char(1), PolicyComplianceQualifier || null)
        .input('MarketingSupportQualifier', sql.Char(1), MarketingSupportQualifier || null)
        .input('AccessAndTrainingQualifier', sql.Char(1), AccessAndTrainingQualifier || null)
        .input('CarrierQualifier', sql.Char(1), CarrierQualifier || null)
        .input('AvoidAssessorialCharges', sql.Char(1), AvoidAssessorialCharges || null)
        .input('NegotiatedProgram', sql.Char(1), NegotiatedProgram || null)
        .input('StrategicRebate', sql.Char(1), StrategicRebate || null)
        .input('ModifiedBy', sql.NVarChar(50), combinedUser)
        .input('ModifiedDate', sql.DateTime2, now)
        .query(`
          UPDATE tcpp.[CustomerTCPPQualifier]
          SET CustomerId = @CustomerId,
              ProgramYear = @ProgramYear,
              PolicyComplianceQualifier = @PolicyComplianceQualifier,
              MarketingSupportQualifier = @MarketingSupportQualifier,
              AccessAndTrainingQualifier = @AccessAndTrainingQualifier,
              CarrierQualifier = @CarrierQualifier,
              AvoidAssessorialCharges = @AvoidAssessorialCharges,
              NegotiatedProgram = @NegotiatedProgram,
              StrategicRebate = @StrategicRebate,
              ModifiedBy = @ModifiedBy,
              ModifiedDate = @ModifiedDate
          WHERE SS_ID = @SS_ID
        `);
      res.json({ message: 'Qualifier record updated successfully' });
    } catch (error: any) {
      console.error('SQL Server error (PUT /api/customer-tcpp-qualifiers):', error.message);
      res.status(500).json({ error: 'Failed to update qualifier', details: error.message });
    }
  });

  app.delete('/api/customer-tcpp-qualifiers/:id', async (req, res) => {
    try {

      const { id } = req.params;
      const pool = await getPool();
      await pool.request()
        .input('SS_ID', sql.Int, id)
        .query('DELETE FROM tcpp.[CustomerTCPPQualifier] WHERE SS_ID = @SS_ID');
      res.json({ message: 'Qualifier record deleted successfully' });
    } catch (error: any) {
      console.error('SQL Server error (DELETE /api/customer-tcpp-qualifiers):', error.message);
      res.status(500).json({ error: 'Failed to delete qualifier', details: error.message });
    }
  });

  app.get('/api/sales-data', requireAdmin, async (req, res) => {
    try {
      const pool = await getPool();

      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: "select * from PRD_INT_TIERED_REBATES.INT_TCPP_SALES_ORDER_BASE_90 where ADDRESS_NUMBER in ('39958', '40244', '39901', '132516', '128881', '39289' ) and DATE_FOR_G_L_AND_VOUCHER > DATE('12/31/2022','MM/DD/YYYY') limit 500;",
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to execute query in Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }
            res.json(rows);
          }
        });
      } catch (err: any) {
          console.error('Snowflake connection failed:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message,
            code: (err as any).code
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/customers', async (req, res) => {
    try {
      const searchTerm = req.query.q ? String(req.query.q).trim() : '';
      if (!searchTerm) {
        return res.json([]);
      }

      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: "select distinct ADDRESS_BOOK AS CUSTOMER_NUMBER, DEALER_NAME as CUSTOMER_NAME, GROUP_NAME from PRD_STAGE_BUSINESS_MAPPINGS.STG_BM_TCPP_CUSTOMER_LOOKUP where DEALER_NAME ilike :1 and ADDRESS_BOOK is not null and len(ADDRESS_BOOK) > 0;",
          binds: [`${searchTerm}%`],
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to execute customer lookup in Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }
            res.json(rows);
          }
        });
      } catch (err: any) {
          console.error('Snowflake customer lookup connection failed:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message 
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/entity', async (req, res) => {
    try {
      const groupName = req.query.groupName ? String(req.query.groupName).trim() : '';
      if (!groupName) {
        return res.json({ tableName: null, message: 'No Group Name specified.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        const sqlPattern = `TIERED_QUARTERLY_REPORT_${groupName.toUpperCase()}%`;

        connection.execute({
          sqlText: "SELECT table_name FROM TIERED_REBATES_SANDBOX.INFORMATION_SCHEMA.TABLES WHERE table_schema = 'PRD_DATA_EXPORTS' AND table_type = 'BASE TABLE' and table_name ilike :1;",
          binds: [sqlPattern],
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to execute entity query in Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }
            if (rows && rows.length > 0) {
              const row = rows[0];
              const tableName = row.TABLE_NAME || row.table_name || Object.values(row)[0];
              res.json({ tableName });
            } else {
              res.json({ tableName: null, message: `No matching table found for pattern '${sqlPattern}'.` });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake entity lookup connection failed:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message 
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/group-table', async (req, res) => {
    try {
      const groupId = req.query.groupId ? String(req.query.groupId).trim() : '';
      if (!groupId) {
        return res.status(400).json({ error: 'GroupId is required.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        const sqlPattern = `%${groupId}`;

        connection.execute({
          sqlText: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PRD_DATA_EXPORTS' AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE :1",
          binds: [sqlPattern],
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to execute group table query in Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }
            if (rows && rows.length > 0) {
              const tableNames = rows.map(row => row.TABLE_NAME || row.table_name || Object.values(row)[0]);
              res.json({ tableNames });
            } else {
              res.json({ tableNames: [] });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake group table lookup connection failed:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message 
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/all-groups-tables', async (req, res) => {
    try {
      try {
        const connection = await getSnowflakeConnection();

        const sqlQuery = `
          SELECT TABLE_NAME, ROW_COUNT
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'PRD_DATA_EXPORTS'
          AND TABLE_TYPE = 'BASE TABLE'
          AND ROW_COUNT > 0
          ORDER BY TABLE_NAME
        `;

        connection.execute({
          sqlText: sqlQuery,
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to execute all groups tables query in Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }
            res.json({ tables: rows || [] });
          }
        });
      } catch (err: any) {
          console.error('Snowflake all groups tables lookup connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/all-groups-export', async (req, res) => {
    try {
      const tableName = req.query.tableName ? String(req.query.tableName).trim() : '';
      if (!tableName) {
        return res.status(400).json({ error: 'Table name is required.' });
      }

      if (!/^[a-zA-Z0-9_]+$/i.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name format.' });
      }

      const templateName = 'Quarterly_Report_Template.xlsm';
      const templatePath = path.join(process.cwd(), templateName);
      const destName = `${tableName}.xlsm`;
      const destPath = path.join(process.cwd(), destName);

      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, destPath);
      }

      try {
        const connection = await getSnowflakeConnection();

        const sqlQuery = `
          select START_DATE_PREV_QUARTER, END_DATE_PREV_QUARTER, GROUP_CODE, GROUP_NAME, CUSTOMER_NUMBER, CUSTOMER_NAME, IS_ACS_FAMILY, CITY, STATE, CUSTOMER_PO, GL_DATE, INVOICE_NUMBER, PRODUCT_SALES, CASH_DISCOUNT, NET_SALES, MANAGEMENT_FEE, REBATE_PERCENT, REBATE_DUE
          from PRD_DATA_EXPORTS.${tableName}
        `;

        connection.execute({
          sqlText: sqlQuery,
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error(`Failed to execute query for ${tableName}:`, err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            try {
              let workbook;
              if (fs.existsSync(destPath)) {
                workbook = await XlsxPopulate.fromFileAsync(destPath);
              } else {
                console.warn(`Template file not found at ${templatePath}. Creating a blank workbook.`);
                workbook = await XlsxPopulate.fromBlankAsync();
                workbook.addSheet('Snowflake_Data');
                const firstSheet = workbook.sheet(0);
                firstSheet.name('Quarter_Summary');
                firstSheet.cell('A1').value('Placeholder Summary Tab');
              }

              let worksheet = workbook.sheet('Snowflake_Data');
              if (!worksheet) {
                worksheet = workbook.sheet(0) || workbook.addSheet('Snowflake_Data');
              } else {
                const usedRange = worksheet.usedRange();
                if (usedRange) {
                  usedRange.value(undefined);
                }
              }

              if (rows && rows.length > 0) {
                const headers = Object.keys(rows[0]);
                headers.forEach((header, colIdx) => {
                  worksheet.cell(1, colIdx + 1).value(header).style('bold', true);
                });

                rows.forEach((row, rowIdx) => {
                  headers.forEach((key, colIdx) => {
                    worksheet.cell(rowIdx + 2, colIdx + 1).value(row[key]);
                  });
                });
              } else {
                worksheet.cell(1, 1).value('No dynamic report data currently retrieved from Snowflake.');
              }

              await workbook.toFileAsync(destPath);

              res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
              res.setHeader('Content-Disposition', `attachment; filename="${tableName}.xlsm"`);
              res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

              res.download(destPath, `${tableName}.xlsm`, (downloadErr) => {
                if (downloadErr) {
                  console.error('Error in res.download for all-groups-export:', downloadErr);
                }
                try {
                  if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                  }
                } catch (unlinkErr) {
                  console.error('Error deleting temp file:', unlinkErr);
                }
              });

            } catch (xlsxErr: any) {
              console.error('Failed to write and export group spreadsheet:', xlsxErr);
              res.status(500).json({ error: 'Failed to generate Excel file', details: xlsxErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake connection failed for all-groups export:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }

    } catch (error: any) {
      console.error('Error in all-groups export handler:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/group-export', async (req, res) => {
    try {
      const tableName = req.query.tableName ? String(req.query.tableName).trim() : '';
      if (!tableName) {
        return res.status(400).json({ error: 'Table name is required.' });
      }

      // Safeguard against SQL injection on the table name since it is dynamically interpolated
      if (!/^[a-zA-Z0-9_]+$/i.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name format.' });
      }

      // 1. Copy Quarterly_Report_Template.xlsm and rename the copy to <selected_table_name>.xlsm — do not modify the original.
      const templateName = 'Quarterly_Report_Template.xlsm';
      const templatePath = path.join(process.cwd(), templateName);
      const destName = `${tableName}.xlsm`;
      const destPath = path.join(process.cwd(), destName);

      let hasValidTemplate = fs.existsSync(templatePath);
      if (hasValidTemplate) {
        fs.copyFileSync(templatePath, destPath);
      }

      // 2. Run SELECT * FROM PRD_DATA_EXPORTS.<selected_table_name> against Snowflake.
      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: `SELECT * FROM PRD_DATA_EXPORTS.${tableName}`,
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error(`Failed to execute query SELECT * FROM PRD_DATA_EXPORTS.${tableName}:`, err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            try {
              // 3. Using the xlsx-populate library, open the renamed copy, navigate to the existing tab named Snowflake_Data
              let workbook;
              if (fs.existsSync(destPath)) {
                workbook = await XlsxPopulate.fromFileAsync(destPath);
              } else {
                console.warn(`Template file not found at ${templatePath}. Creating a blank workbook.`);
                workbook = await XlsxPopulate.fromBlankAsync();
                workbook.addSheet('Snowflake_Data');
                const firstSheet = workbook.sheet(0);
                firstSheet.name('Quarter_Summary');
                firstSheet.cell('A1').value('Placeholder Summary Tab');
                firstSheet.cell('A2').value('This is a fallback summary sheet because the custom template file was not found.');
              }

              let worksheet = workbook.sheet('Snowflake_Data');
              if (!worksheet) {
                worksheet = workbook.sheet(0) || workbook.addSheet('Snowflake_Data');
              } else {
                // Clear any existing data in Snowflake_Data to overlay fresh database records
                const usedRange = worksheet.usedRange();
                if (usedRange) {
                  usedRange.value(undefined);
                }
              }

              // 4. Write the query results starting at cell A1 — column headers in row 1, data rows immediately below.
              if (rows && rows.length > 0) {
                const headers = Object.keys(rows[0]);
                // Write header row
                headers.forEach((header, colIdx) => {
                  worksheet.cell(1, colIdx + 1).value(header).style('bold', true);
                });

                // Write data rows
                rows.forEach((row, rowIdx) => {
                  headers.forEach((key, colIdx) => {
                    worksheet.cell(rowIdx + 2, colIdx + 1).value(row[key]);
                  });
                });
              } else {
                worksheet.cell(1, 1).value('No dynamic report data currently retrieved from Snowflake.');
              }

              // 5. Save the file when done (to the renamed copy destination)
              await workbook.toFileAsync(destPath);

              // 6. And then download the data
              res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
              res.setHeader('Content-Disposition', `attachment; filename="${tableName}.xlsm"`);
              res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

              res.download(destPath, `${tableName}.xlsm`, (downloadErr) => {
                if (downloadErr) {
                  console.error('Error in res.download for group-export:', downloadErr);
                }
              });

            } catch (xlsxErr: any) {
              console.error('Failed to write and export group spreadsheet:', xlsxErr);
              res.status(500).json({ error: 'Failed to generate Excel file', details: xlsxErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake connection failed for group export:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message 
          });
      }

    } catch (error: any) {
      console.error('Error in group export handler:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/quarterly/data', async (req, res) => {
    try {
      const tableName = req.query.tableName ? String(req.query.tableName).trim() : '';
      const customerNumber = req.query.customerNumber ? String(req.query.customerNumber).trim() : '';

      if (!tableName) {
        return res.status(400).json({ error: 'Table name is required.' });
      }
      if (!customerNumber) {
        return res.status(400).json({ error: 'Customer number is required.' });
      }

      // Safeguard against SQL injection on the table name since it cannot be bound
      if (!/^TIERED_QUARTERLY_REPORT_[a-zA-Z0-9_]+$/i.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name format.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: `select * from PRD_DATA_EXPORTS.${tableName} where CUSTOMER_NUMBER = :1;`,
          binds: [customerNumber],
          complete: (err, stmt, rows) => {
            if (err) {
              console.error(`Failed to execute quarterly data query in Snowflake on table ${tableName}:`, err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }
            res.json(rows || []);
          }
        });
      } catch (err: any) {
          console.error('Snowflake connection failed for quarterly data:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message 
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/finance/groups', async (req, res) => {
    try {

      const pool = await getPool();
      await ensureGroupMasterTables(pool);
      const result = await pool.request().query('SELECT DISTINCT GroupId, GroupName FROM tcpp.Groups ORDER BY GroupName, GroupId');
      res.json(result.recordset);
    } catch (error: any) {
      console.error('SQL Server error (GET /api/reports/finance/groups):', error.message);
      res.status(500).json({ error: 'Failed to fetch groups from master table', details: error.message });
    }
  });

  app.post('/api/reports/finance/export', async (req, res) => {
    try {
      const { groupId, groupName } = req.body;
      if (!groupId) {
        return res.status(400).json({ error: 'GroupId is required.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        const sqlText = `
          select * from PRD_ANALYTICS_TIERED_REBATES.TCPP_FINANCE_REBATE_HISTORY
          where group_code = :1
        `;

        connection.execute({
          sqlText,
          binds: [groupId],
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error('Failed to execute Snowflake query for Finance Reports:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            try {
              const templateName = 'TCPP_Finance_Report_Template.xlsx';
              const templatePath = path.join(process.cwd(), templateName);

              const hasValidTemplate = fs.existsSync(templatePath) && fs.statSync(templatePath).size > 0;
              let workbook;
              if (hasValidTemplate) {
                workbook = await XlsxPopulate.fromFileAsync(templatePath);
              } else {
                console.warn(`Template file ${templateName} not found or empty at root path ${templatePath}. Creating temporary workbook.`);
                workbook = await XlsxPopulate.fromBlankAsync();
                workbook.addSheet('Group_Data');
                const firstSheet = workbook.sheet(0);
                if (firstSheet.name() !== 'Group_Data') {
                  firstSheet.name('Summary');
                  firstSheet.cell('A1').value('Finance Report Summary');
                  firstSheet.cell('A2').value('This is a placeholder. Please upload your real TCPP_Finance_Report_Template.xlsx to the root.');
                }
              }

              let worksheet = workbook.sheet('Group_Data');
              if (!worksheet) {
                worksheet = workbook.addSheet('Group_Data');
              }

              const usedRange = worksheet.usedRange();
              if (usedRange) {
                const startCell = usedRange.startCell();
                const endCell = usedRange.endCell();
                const numRows = endCell.rowNumber();
                const numCols = Math.max(endCell.columnNumber(), 49); // up to AW
                if (numRows >= 2) {
                  worksheet.range(2, 1, numRows, numCols).value(undefined);
                }
              }

              if (rows && rows.length > 0) {
                const keys = Object.keys(rows[0]);

                const isPlaceholder = !hasValidTemplate || !worksheet.cell(1, 1).value();
                if (isPlaceholder) {
                  keys.forEach((key, colIdx) => {
                    worksheet.cell(1, colIdx + 1).value(key).style('bold', true);
                  });
                  worksheet.cell(1, 49).value('Quarter_Formula').style('bold', true);
                }

                rows.forEach((row, rowIdx) => {
                  const currentExcelRow = rowIdx + 2;
                  
                  keys.forEach((key, colIdx) => {
                    let cellVal = row[key];
                    worksheet.cell(currentExcelRow, colIdx + 1).value(cellVal);
                  });

                  const formula = `=IF(ISBLANK(C${currentExcelRow}), "", TEXT(C${currentExcelRow}, "yyyy") & " - " & CHOOSE(ROUNDUP(MONTH(C${currentExcelRow})/3,0), "Q1", "Q2", "Q3", "Q4") & " (H" & ROUNDUP(MONTH(C${currentExcelRow})/6,0) & ")")`;
                  worksheet.cell(currentExcelRow, 49).formula(formula);
                });
              } else {
                if (!hasValidTemplate) {
                  worksheet.cell(1, 1).value('No dynamic report data currently retrieved from Snowflake directory.');
                }
              }

              const formattedGroupId = (groupId || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
              const formattedGroupName = (groupName || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
              const suffix = [formattedGroupId, formattedGroupName].filter(Boolean).join('_');
              const downloadFilename = suffix ? `TCPP_Finance_Report_${suffix}.xlsx` : 'TCPP_Finance_Report.xlsx';

              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
              res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

              const buffer = await workbook.outputAsync();
              res.send(buffer);

            } catch (exportErr: any) {
              console.error('Failed to write and export Finance Report spreadsheet:', exportErr);
              res.status(500).json({ error: 'Failed to generate Excel report file', details: exportErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake connection failed for Finance Reports:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message 
          });
      }

    } catch (error: any) {
      console.error('Export error in Finance Report route:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/reports/quarterly/export', async (req, res) => {
    try {
      const { reportData, customerName } = req.body;

      if (!Array.isArray(reportData)) {
        return res.status(400).json({ error: 'reportData must be an array.' });
      }

      const templateName = 'Quarterly_Report_Template.xlsm';
      const templatePath = path.join(process.cwd(), templateName);

      let workbook;
      if (fs.existsSync(templatePath)) {
        workbook = await XlsxPopulate.fromFileAsync(templatePath);
      } else {
        // Safe graceful behavior if the user hasn't uploaded their custom template spreadsheet yet:
        console.warn(`Template file ${templateName} not found at root path ${templatePath}. Creating temporary workbook.`);
        workbook = await XlsxPopulate.fromBlankAsync();
        workbook.addSheet('Snowflake_Data');
        const backupSheet = workbook.sheet(0); // rename first sheet
        backupSheet.name('Quarter_Summary');
        
        backupSheet.cell('A1').value('Placeholder Summary Tab');
        backupSheet.cell('A2').value('This tab is a placeholder for the template. Place your real Quarterly_Report_Template.xlsm in the root folder with 2 tabs: "Snowflake_Data" and another tab.');
      }

      // Retrieve/create the target 'Snowflake_Data' worksheet
      let worksheet = workbook.sheet('Snowflake_Data');
      if (!worksheet) {
        worksheet = workbook.sheet(0) || workbook.addSheet('Snowflake_Data');
      } else {
        // Clear all existing data in Snowflake_Data to overlay fresh database records
        const usedRange = worksheet.usedRange();
        if (usedRange) {
          usedRange.value(undefined);
        }
      }

      // Populating database rows
      if (reportData.length > 0) {
        const headers = Object.keys(reportData[0]);
        // Write header row
        headers.forEach((header, colIdx) => {
          worksheet.cell(1, colIdx + 1).value(header).style('bold', true);
        });
        
        // Write data rows
        reportData.forEach((row, rowIdx) => {
          headers.forEach((key, colIdx) => {
            worksheet.cell(rowIdx + 2, colIdx + 1).value(row[key]);
          });
        });
      } else {
        worksheet.cell(1, 1).value('No dynamic report data currently retrieved from Snowflake directory.');
      }

      // Build the download client filename: Quarterly_Report_<Customer_Name>.xlsm
      const formattedCustomerName = (customerName || 'Customer')
        .replace(/[^a-zA-Z0-9_\- ]/g, '') // sanitize filename
        .trim();
      const downloadFilename = `Quarterly_Report_${formattedCustomerName}.xlsm`;

      res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);

      const buffer = await workbook.outputAsync();
      res.send(buffer);

    } catch (error: any) {
      console.error('Error exporting Quarterly report template to Excel:', error);
      res.status(500).json({ error: 'Excel generation failed.', details: error.message });
    }
  });

  app.post('/api/sync', requireAdmin, async (req, res) => {
    try {
      const secrets = getSecrets();
      
      // SQL Server Connection Configuration
      const serverRaw = (secrets.SQL_SERVER_SERVER || '').trim();
      const [host, instance] = serverRaw.split('\\');


      // 1. Fetch data from Snowflake
      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: "select * from PRD_INT_TIERED_REBATES.INT_TCPP_SALES_ORDER_BASE_90 where ADDRESS_NUMBER in ('39958', '40244', '39901', '132516', '128881', '39289' ) and DATE_FOR_G_L_AND_VOUCHER > DATE('12/31/2022','MM/DD/YYYY');",
          complete: async (err, stmt, rows) => {
            if (err) {
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            if (!rows || rows.length === 0) {
              return res.json({ message: 'No data to sync' });
            }

            // 2. Insert data into SQL Server
            try {
              const pool = await getPool();
              
              // Create table if not exists (optional, but good for demo)
              // Assuming columns match Snowflake rows. For a real app, we'd define schema.
              // Let's assume some basic columns or just try to insert.
              
              const transaction = new sql.Transaction(pool);
              await transaction.begin();

              try {
                const request = new sql.Request(transaction);
                
                // Clear existing data or append? Usually sync implies overwrite or upsert.
                // For simplicity, let's append or overwrite based on a simple logic.
                // Let's overwrite for this demo.
                await request.query('DELETE FROM sales_data');

                for (const row of rows as any[]) {
                  const insertRequest = new sql.Request(transaction);
                  const columns = Object.keys(row);
                  const paramNames: string[] = [];
                  
                  columns.forEach((col, index) => {
                    const paramName = `p${index}`;
                    let val = row[col];
                    
                    // Handle Date objects specifically for SQL Server
                    if (val instanceof Date) {
                      val = val.toISOString();
                    }
                    
                    insertRequest.input(paramName, val);
                    paramNames.push(`@${paramName}`);
                  });

                  const query = `INSERT INTO sales_data (${columns.join(', ')}) VALUES (${paramNames.join(', ')})`;
                  await insertRequest.query(query);
                }

                await transaction.commit();
                res.json({ message: `Successfully synced ${rows.length} records to SQL Server.` });
              } catch (err: any) {
                await transaction.rollback();
                throw err;
              }
            } catch (sqlErr: any) {
              console.error('SQL Server error:', sqlErr.message);
              res.status(500).json({ error: 'SQL Server sync failed', details: sqlErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake sync connection failed:', err);
          return res.status(500).json({ 
            error: 'Snowflake connection failed', 
            details: err.message,
            code: (err as any).code
          });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ================= CUSTOMER MASTER SYNC =================

  interface CustomerMasterSyncStatus {
    status: 'idle' | 'fetching_snowflake' | 'syncing_sqlserver' | 'completed' | 'failed';
    totalRecords: number;
    processedRecords: number;
    error?: string;
    startTime?: string;
    endTime?: string;
  }

  let customerMasterSyncStatus: CustomerMasterSyncStatus = {
    status: 'idle',
    totalRecords: 0,
    processedRecords: 0
  };

  async function ensureCustomerMasterTables(pool: sql.ConnectionPool) {
    // Ensure schema 'ref' exists
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'ref')
        BEGIN
          EXEC('CREATE SCHEMA ref')
        END
      `);
    } catch (err) {
      console.error('Error creating schema ref:', err);
    }

    // Ensure ref.CustomerMaster exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'ref.CustomerMaster') AND type in (N'U'))
      BEGIN
        CREATE TABLE ref.CustomerMaster (
          [SS_ID] [int] IDENTITY(1,1) NOT NULL,
          [CustomerId] [int] NOT NULL,
          [CustomerName] [nvarchar](150) NOT NULL,
          [CreatedBy] [nvarchar](50) NOT NULL,
          [CreatedDate] [datetime2](7) NOT NULL,
          [ModifiedBy] [nvarchar](50) NULL,
          [ModifiedDate] [datetime2](7) NULL
        )
      END
    `);

    // Ensure ref.LastUpdates exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'ref.LastUpdates') AND type in (N'U'))
      BEGIN
        CREATE TABLE ref.LastUpdates (
          [SS_ID] [int] IDENTITY(1,1) NOT NULL,
          TableUpdated [nvarchar](150) NOT NULL,
          LastUpdatedDate [datetime2](7) NOT NULL,
          [CreatedBy] [nvarchar](50) NOT NULL,
          [CreatedDate] [datetime2](7) NOT NULL,
          [ModifiedBy] [nvarchar](50) NULL,
          [ModifiedDate] [datetime2](7) NULL
        )
      END
    `);
  }

  async function insertCustomerMasterBatch(pool: sql.ConnectionPool, batch: any[], userEmail: string) {
    const request = pool.request();
    const now = new Date();
    const valuesClauses: string[] = [];

    batch.forEach((row, rowIndex) => {
      const val = row.CUSTOMERID || row.CustomerID || row.address_number;
      const customerId = parseInt(String(val).trim(), 10);
      const customerName = String(row.CUSTOMERNAME || row.CustomerName || row.NAME_ALPHA || '').slice(0, 150);

      request.input(`id_${rowIndex}`, sql.Int, customerId);
      request.input(`name_${rowIndex}`, sql.NVarChar(150), customerName);
      request.input(`user_${rowIndex}`, sql.NVarChar(50), userEmail);
      request.input(`date_${rowIndex}`, sql.DateTime2(7), now);

      valuesClauses.push(`(@id_${rowIndex}, @name_${rowIndex}, @user_${rowIndex}, @date_${rowIndex})`);
    });

    const query = `
      INSERT INTO ref.CustomerMaster (CustomerId, CustomerName, CreatedBy, CreatedDate)
      VALUES ${valuesClauses.join(', ')}
    `;

    await request.query(query);
  }

  async function runCustomerMasterSyncInBackground(userEmail: string) {
    try {

      const fetchFromSnowflake = async (): Promise<any[]> => {
        let connection: any;
        try {
          connection = await getSnowflakeConnection();
        } catch (err: any) {
          throw new Error(`Snowflake connection failed: ${err.message}`);
        }

        return new Promise((resolve, reject) => {
          const sqlText = `
            select distinct address_number as CustomerID, NAME_ALPHA as CustomerName
            from PRD_STAGE_JDE90.STG_JDE90_F0101_ADDRESS_BOOK_MASTER
          `;

          connection.execute({
            sqlText,
            complete: (err, stmt, rows) => {
              try {
                connection.destroy((destroyErr: any) => {
                  if (destroyErr) console.error('Error destroying Snowflake connection:', destroyErr);
                });
              } catch (e) {
                console.error(e);
              }

              if (err) {
                return reject(new Error(`Snowflake query failed: ${err.message}`));
              }
              resolve(rows || []);
            }
          });
        });
      };

      const rows = await fetchFromSnowflake();

      // Filter out rows where CustomerId cannot be parsed as a valid integer
      const validRows = rows.filter(row => {
        const val = row.CUSTOMERID || row.CustomerID || row.address_number;
        if (val === undefined || val === null) return false;
        const parsed = parseInt(String(val).trim(), 10);
        return !isNaN(parsed);
      });

      customerMasterSyncStatus.status = 'syncing_sqlserver';
      customerMasterSyncStatus.totalRecords = validRows.length;
      customerMasterSyncStatus.processedRecords = 0;

      const pool = await getPool();
      await ensureCustomerMasterTables(pool);

      try {
        await pool.request().query('TRUNCATE TABLE ref.CustomerMaster');
      } catch (err) {
        await pool.request().query('DELETE FROM ref.CustomerMaster');
      }

      const batchSize = 100;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        await insertCustomerMasterBatch(pool, batch, userEmail);
        customerMasterSyncStatus.processedRecords += batch.length;
      }

      const now = new Date();
      await pool.request()
        .input('LastUpdatedDate', sql.DateTime2(7), now)
        .input('CreatedBy', sql.NVarChar(50), userEmail)
        .input('CreatedDate', sql.DateTime2(7), now)
        .input('ModifiedBy', sql.NVarChar(50), userEmail)
        .input('ModifiedDate', sql.DateTime2(7), now)
        .query(`
          MERGE INTO ref.LastUpdates AS target
          USING (SELECT 'CustomerMaster' AS TableUpdated) AS source
          ON target.TableUpdated = source.TableUpdated
          WHEN MATCHED THEN
            UPDATE SET LastUpdatedDate = @LastUpdatedDate, ModifiedBy = @ModifiedBy, ModifiedDate = @ModifiedDate
          WHEN NOT MATCHED THEN
            INSERT (TableUpdated, LastUpdatedDate, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate)
            VALUES ('CustomerMaster', @LastUpdatedDate, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate);
        `);

      customerMasterSyncStatus.status = 'completed';
      customerMasterSyncStatus.endTime = new Date().toISOString();

    } catch (err: any) {
      console.error('Customer Master sync background task failed:', err);
      customerMasterSyncStatus.status = 'failed';
      customerMasterSyncStatus.error = err.message || 'Unknown error occurred during synchronization';
      customerMasterSyncStatus.endTime = new Date().toISOString();
    }
  }

  app.get('/api/customer-master/last-update', requireAdmin, async (req, res) => {
    try {
      const pool = await getPool();
      await ensureCustomerMasterTables(pool);

      const result = await pool.request().query(`
        SELECT LastUpdatedDate 
        FROM ref.LastUpdates 
        WHERE TableUpdated = 'CustomerMaster'
      `);

      if (result.recordset && result.recordset.length > 0) {
        return res.json({ lastUpdatedDate: result.recordset[0].LastUpdatedDate });
      } else {
        return res.json({ lastUpdatedDate: null });
      }
    } catch (err: any) {
      console.error('Failed to fetch customer master last update:', err);
      res.json({ lastUpdatedDate: null });
    }
  });

  app.get('/api/customer-master/sync-status', requireAdmin, (req, res) => {
    res.json(customerMasterSyncStatus);
  });

  app.post('/api/customer-master/sync', requireAdmin, (req, res) => {
    const userName = String(req.headers['x-user-name'] || 'None');
    const userEmail = String(req.headers['x-user-email'] || 'None');
    let combinedUser = 'System';
    if (userName !== 'None' && userEmail !== 'None') {
      combinedUser = `${userName} (${userEmail})`;
    } else if (userName !== 'None') {
      combinedUser = userName;
    } else if (userEmail !== 'None') {
      combinedUser = userEmail;
    }
    // Truncate to 50 characters to fit ref.CustomerMaster.CreatedBy (nvarchar(50))
    const userDisplay = combinedUser.slice(0, 50);
    
    if (
      customerMasterSyncStatus.status === 'fetching_snowflake' || 
      customerMasterSyncStatus.status === 'syncing_sqlserver'
    ) {
      return res.status(400).json({ error: 'Sync is already in progress' });
    }

    customerMasterSyncStatus = {
      status: 'fetching_snowflake',
      totalRecords: 0,
      processedRecords: 0,
      startTime: new Date().toISOString(),
    };

    runCustomerMasterSyncInBackground(userDisplay);

    res.json({ message: 'Synchronization process started successfully in the background' });
  });

  // ================= GROUP MASTER SYNC =================

  interface GroupMasterSyncStatus {
    status: 'idle' | 'fetching_snowflake' | 'syncing_sqlserver' | 'completed' | 'failed';
    totalRecords: number;
    processedRecords: number;
    error?: string;
    startTime?: string;
    endTime?: string;
  }

  let groupMasterSyncStatus: GroupMasterSyncStatus = {
    status: 'idle',
    totalRecords: 0,
    processedRecords: 0
  };

  async function ensureGroupMasterTables(pool: sql.ConnectionPool) {
    // Ensure schema 'ref' exists
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'ref')
        BEGIN
          EXEC('CREATE SCHEMA ref')
        END
      `);
    } catch (err) {
      console.error('Error creating schema ref:', err);
    }

    // Ensure ref.GroupMaster exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'ref.GroupMaster') AND type in (N'U'))
      BEGIN
        CREATE TABLE ref.GroupMaster (
          [SS_ID] [int] IDENTITY(1,1) NOT NULL,
          [GroupId] [nvarchar](10) NOT NULL,
          [GroupName] [nvarchar](150) NOT NULL,
          [CreatedBy] [nvarchar](50) NOT NULL,
          [CreatedDate] [datetime2](7) NOT NULL,
          [ModifiedBy] [nvarchar](50) NULL,
          [ModifiedDate] [datetime2](7) NULL
        )
      END
    `);

    // Ensure ref.LastUpdates exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'ref.LastUpdates') AND type in (N'U'))
      BEGIN
        CREATE TABLE ref.LastUpdates (
          [SS_ID] [int] IDENTITY(1,1) NOT NULL,
          TableUpdated [nvarchar](150) NOT NULL,
          LastUpdatedDate [datetime2](7) NOT NULL,
          [CreatedBy] [nvarchar](50) NOT NULL,
          [CreatedDate] [datetime2](7) NOT NULL,
          [ModifiedBy] [nvarchar](50) NULL,
          [ModifiedDate] [datetime2](7) NULL
        )
      END
    `);
  }

  async function insertGroupMasterBatch(pool: sql.ConnectionPool, batch: any[], userEmail: string) {
    const request = pool.request();
    const now = new Date();
    const valuesClauses: string[] = [];

    batch.forEach((row, rowIndex) => {
      const val = row.GROUPID || row.GroupId || row.CATEGORY_CODE_ADDRESS_BOOK_08;
      const groupId = String(val).trim().slice(0, 10);
      const groupName = String(row.GROUPNAME || row.GroupName || row.CATEGORY_CODE_ADDRESS_BOOK_08_DESCRIPTION || '').slice(0, 150);

      request.input(`id_${rowIndex}`, sql.NVarChar(10), groupId);
      request.input(`name_${rowIndex}`, sql.NVarChar(150), groupName);
      request.input(`user_${rowIndex}`, sql.NVarChar(50), userEmail);
      request.input(`date_${rowIndex}`, sql.DateTime2(7), now);

      valuesClauses.push(`(@id_${rowIndex}, @name_${rowIndex}, @user_${rowIndex}, @date_${rowIndex})`);
    });

    const query = `
      INSERT INTO ref.GroupMaster (GroupId, GroupName, CreatedBy, CreatedDate)
      VALUES ${valuesClauses.join(', ')}
    `;

    await request.query(query);
  }

  async function runGroupMasterSyncInBackground(userEmail: string) {
    try {

      const fetchFromSnowflake = async (): Promise<any[]> => {
        let connection: any;
        try {
          connection = await getSnowflakeConnection();
        } catch (err: any) {
          throw new Error(`Snowflake connection failed: ${err.message}`);
        }

        return new Promise((resolve, reject) => {
          const sqlText = `
            select distinct CATEGORY_CODE_ADDRESS_BOOK_08 as GroupID, CATEGORY_CODE_ADDRESS_BOOK_08_DESCRIPTION as GroupName
            from PRD_STAGE_JDE90.STG_JDE90_F0101_ADDRESS_BOOK_MASTER 
            where len(CATEGORY_CODE_ADDRESS_BOOK_08) > 0
          `;

          connection.execute({
            sqlText,
            complete: (err, stmt, rows) => {
              try {
                connection.destroy((destroyErr: any) => {
                  if (destroyErr) console.error('Error destroying Snowflake connection:', destroyErr);
                });
              } catch (e) {
                console.error(e);
              }

              if (err) {
                return reject(new Error(`Snowflake query failed: ${err.message}`));
              }
              resolve(rows || []);
            }
          });
        });
      };

      const rows = await fetchFromSnowflake();

      // Filter out rows where GroupId is missing or empty
      const validRows = rows.filter(row => {
        const val = row.GROUPID || row.GroupId || row.CATEGORY_CODE_ADDRESS_BOOK_08;
        if (val === undefined || val === null) return false;
        const strVal = String(val).trim();
        return strVal.length > 0;
      });

      groupMasterSyncStatus.status = 'syncing_sqlserver';
      groupMasterSyncStatus.totalRecords = validRows.length;
      groupMasterSyncStatus.processedRecords = 0;

      const pool = await getPool();
      await ensureGroupMasterTables(pool);

      try {
        await pool.request().query('TRUNCATE TABLE ref.GroupMaster');
      } catch (err) {
        await pool.request().query('DELETE FROM ref.GroupMaster');
      }

      const batchSize = 100;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        await insertGroupMasterBatch(pool, batch, userEmail);
        groupMasterSyncStatus.processedRecords += batch.length;
      }

      const now = new Date();
      await pool.request()
        .input('LastUpdatedDate', sql.DateTime2(7), now)
        .input('CreatedBy', sql.NVarChar(50), userEmail)
        .input('CreatedDate', sql.DateTime2(7), now)
        .input('ModifiedBy', sql.NVarChar(50), userEmail)
        .input('ModifiedDate', sql.DateTime2(7), now)
        .query(`
          MERGE INTO ref.LastUpdates AS target
          USING (SELECT 'GroupMaster' AS TableUpdated) AS source
          ON target.TableUpdated = source.TableUpdated
          WHEN MATCHED THEN
            UPDATE SET LastUpdatedDate = @LastUpdatedDate, ModifiedBy = @ModifiedBy, ModifiedDate = @ModifiedDate
          WHEN NOT MATCHED THEN
            INSERT (TableUpdated, LastUpdatedDate, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate)
            VALUES ('GroupMaster', @LastUpdatedDate, @CreatedBy, @CreatedDate, @ModifiedBy, @ModifiedDate);
        `);

      groupMasterSyncStatus.status = 'completed';
      groupMasterSyncStatus.endTime = new Date().toISOString();

    } catch (err: any) {
      console.error('Group Master sync background task failed:', err);
      groupMasterSyncStatus.status = 'failed';
      groupMasterSyncStatus.error = err.message || 'Unknown error occurred during synchronization';
      groupMasterSyncStatus.endTime = new Date().toISOString();
    }
  }

  app.get('/api/group-master/last-update', requireAdmin,  async (req, res) => {
    try {
      const pool = await getPool();
      await ensureGroupMasterTables(pool);

      const result = await pool.request().query(`
        SELECT LastUpdatedDate 
        FROM ref.LastUpdates 
        WHERE TableUpdated = 'GroupMaster'
      `);

      if (result.recordset && result.recordset.length > 0) {
        return res.json({ lastUpdatedDate: result.recordset[0].LastUpdatedDate });
      } else {
        return res.json({ lastUpdatedDate: null });
      }
    } catch (err: any) {
      console.error('Failed to fetch group master last update:', err);
      res.json({ lastUpdatedDate: null });
    }
  });

  app.get('/api/group-master/sync-status', requireAdmin, (req, res) => {
    res.json(groupMasterSyncStatus);
  });

  app.post('/api/group-master/sync', requireAdmin, (req, res) => {
    const userName = String(req.headers['x-user-name'] || 'None');
    const userEmail = String(req.headers['x-user-email'] || 'None');
    let combinedUser = 'System';
    if (userName !== 'None' && userEmail !== 'None') {
      combinedUser = `${userName} (${userEmail})`;
    } else if (userName !== 'None') {
      combinedUser = userName;
    } else if (userEmail !== 'None') {
      combinedUser = userEmail;
    }
    const userDisplay = combinedUser.slice(0, 50);
    
    if (
      groupMasterSyncStatus.status === 'fetching_snowflake' || 
      groupMasterSyncStatus.status === 'syncing_sqlserver'
    ) {
      return res.status(400).json({ error: 'Sync is already in progress' });
    }

    groupMasterSyncStatus = {
      status: 'fetching_snowflake',
      totalRecords: 0,
      processedRecords: 0,
      startTime: new Date().toISOString(),
    };

    runGroupMasterSyncInBackground(userDisplay);

    res.json({ message: 'Synchronization process started successfully in the background' });
  });

  app.get('/api/reports/scorecard/customers', async (req, res) => {
    try {
      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: 'select distinct TCPP_PARENT_NAME from PRD_REPORTING_LAYER.TCPP_SCORECARD_US_PIVOT where TCPP_PARENT_NAME is not null order by TCPP_PARENT_NAME;',
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to query customers from Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            const customers = rows ? rows.map(r => r.TCPP_PARENT_NAME) : [];
            res.json(customers);
          }
        });
      } catch (err: any) {
          console.error('Snowflake scorecard customers connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      console.error('Error in /api/reports/scorecard/customers:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });

  app.post('/api/reports/scorecard/export', async (req, res) => {
    try {
      const { customerName } = req.body;
      if (!customerName) {
        return res.status(400).json({ error: 'customerName is required.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        const escapedCustomer = customerName.replace(/'/g, "''");
        connection.execute({
          sqlText: `select * from PRD_REPORTING_LAYER.TCPP_SCORECARD_US_PIVOT where TCPP_PARENT_NAME = '${escapedCustomer}' order by REPORT_SECTION_SEQ`,
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error('Failed to query scorecard rows from Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            try {
              const templateName = 'TIERED_REBATES_SCORECARD_US_Template.xlsm';
              const templatePath = path.join(process.cwd(), templateName);

              const cleanCustomer = customerName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
              const targetFilename = `Tiered_Rebates_Scorecard_${cleanCustomer}.xlsm`;
              const targetPath = path.join(process.cwd(), targetFilename);

              // Copy the template file to the new renamed file path BEFORE editing and appending
              if (fs.existsSync(templatePath)) {
                fs.copyFileSync(templatePath, targetPath);
              } else {
                console.warn(`Template file ${templateName} not found at ${templatePath}.`);
              }

              let workbook;
              if (fs.existsSync(targetPath)) {
                workbook = await XlsxPopulate.fromFileAsync(targetPath);
              } else {
                console.warn('Creating a blank fallback workbook.');
                workbook = await XlsxPopulate.fromBlankAsync();
              }

              // Retrieve or create 'Snowflake_Data' worksheet
              let worksheet = workbook.sheet('Snowflake_Data');
              if (!worksheet) {
                worksheet = workbook.sheet(0) || workbook.addSheet('Snowflake_Data');
                worksheet.name('Snowflake_Data');
              } else {
                // Since starting at row 2, let's clear existing rows from row 2 onwards to prevent overlapping
                const usedRange = worksheet.usedRange();
                if (usedRange) {
                  // We can clear cells starting from row 2 if we want to be safe, or clear all and write headers if we want fresh.
                  // But the user specifically said: "append the rows to the Snowflake_Data tab starting at row 2".
                  // To avoid clearing row 1, we can just write from row 2 onwards.
                }
              }

              // Append rows starting at row 2, leaving row 1 (headers) intact (or write headers if fallback)
              if (rows && rows.length > 0) {
                const headers = Object.keys(rows[0]);

                // If fallback workbook with no existing headers, write them to row 1
                const hasExistingHeaders = fs.existsSync(templatePath);
                if (!hasExistingHeaders) {
                  headers.forEach((header, colIdx) => {
                    worksheet.cell(1, colIdx + 1).value(header).style('bold', true);
                  });
                  worksheet.cell(1, 32).value("AF_Formula").style('bold', true);
                  worksheet.cell(1, 33).value("AG_Formula").style('bold', true);
                  worksheet.cell(1, 34).value("AH_Formula").style('bold', true);
                }

                // Append rows starting at row 2
                rows.forEach((row, rowIdx) => {
                  const currentExcelRow = rowIdx + 2;
                  headers.forEach((key, colIdx) => {
                    worksheet.cell(currentExcelRow, colIdx + 1).value(row[key]);
                  });

                  // Generate dynamic formulas matching the row number
                  const formulaAF = `=_xlfn.IFS(ISNUMBER(SEARCH("_net_sales", L${currentExcelRow})), "Sales Greater Than Target", ISNUMBER(SEARCH("_silver_qualifier", L${currentExcelRow})), "Sales Less Then Target = Bronze, Greater Then Target = Silver, Gold or Platinum", A${currentExcelRow}="overall", "Total Points Earned", A${currentExcelRow}="growth", " Exceeds Nominal Growth", AND(A${currentExcelRow}="leads", J${currentExcelRow}="LEAD_SCORECARD_QUALIFIER"), "Meet Smallwares and 1 out of 4 equipment", A${currentExcelRow}="leads", "Leads With Vollrath", A${currentExcelRow}="new products", "New Product Support", A${currentExcelRow}="drop ship", "Meets Drop Ship Requirements", AND(A${currentExcelRow}="qualifiers", L${currentExcelRow}="order_performance_qualifier"), "Allows Carrier Selection and Avoids Accessorial Charges", AND(A${currentExcelRow}="qualifiers", L${currentExcelRow}="marketing_support_qualifier"), "Approved Marketing Plan/Usage of co-op funds", AND(A${currentExcelRow}="qualifiers", L${currentExcelRow}="access_and_training_qualifier"), "Access to End Users", TRUE, "")`;
                  const formulaAG = `=_xlfn.IFS(UPPER(C${currentExcelRow})="QUALIFIED TIER LEVEL",FALSE,UPPER(J${currentExcelRow})="TIER LEVEL",FALSE,OR(AND(UPPER(C${currentExcelRow})="ACCESS & TRAINING",B${currentExcelRow}="07-30",UPPER(AF${currentExcelRow})="ACCESS TO END USERS",UPPER(Z${currentExcelRow})="Y",ISBLANK(K${currentExcelRow})=TRUE)=TRUE,AND(UPPER(C${currentExcelRow})="MARKETING SUPPORT",B${currentExcelRow}="07-20",UPPER(AF${currentExcelRow})="APPROVED MARKETING PLAN/USAGE OF CO-OP FUNDS",UPPER(Z${currentExcelRow})="N",ISBLANK(K${currentExcelRow})=TRUE),AND(UPPER(C${currentExcelRow})="VOLRATH_CARRIER_MET=Y AVOID_ACESSORIAL_CHARGES_MET=Y",B${currentExcelRow}="07-10",UPPER(AF${currentExcelRow})="ALLOWS CARRIER SELECTION AND AVOIDS ACCESSORIALS",UPPER(Z${currentExcelRow})="Y",ISBLANK(K${currentExcelRow})=TRUE)=TRUE),FALSE,UPPER(AF${currentExcelRow})="APPROVED MARKETING PLAN/USAGE OF CO-OP FUNDS",FALSE,TRUE,TRUE)`;
                  const formulaAH = `=_xlfn.IFS(UPPER(C${currentExcelRow})="QUALIFIED TIER LEVEL",FALSE,UPPER(J${currentExcelRow})="TIER QUALIFIER",FALSE,UPPER(H${currentExcelRow})<>"SUMMARY",FALSE,TRUE,TRUE)`;

                  worksheet.cell(currentExcelRow, 32).formula(formulaAF);
                  worksheet.cell(currentExcelRow, 33).formula(formulaAG);
                  worksheet.cell(currentExcelRow, 34).formula(formulaAH);
                });
              } else {
                worksheet.cell(2, 1).value('No rows found for this customer in Snowflake.');
              }

              // Save the renamed spreadsheet
              await workbook.toFileAsync(targetPath);

              // Send the file to client and delete the local copy afterward
              res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
              res.setHeader('Content-Disposition', `attachment; filename="${targetFilename}"`);
              res.download(targetPath, targetFilename, (downloadErr) => {
                if (downloadErr) {
                  console.error('Error downloading the file:', downloadErr);
                }
                // Cleanup the local copied file
                try {
                  if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                  }
                } catch (unlinkErr) {
                  console.error('Error deleting temp export file:', unlinkErr);
                }
              });

            } catch (xlsxErr: any) {
              console.error('Error manipulating spreadsheet:', xlsxErr);
              res.status(500).json({ error: 'Spreadsheet generation failed', details: xlsxErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake scorecard export connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      console.error('Error in /api/reports/scorecard/export:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });

  app.get('/api/reports/scorecard-ca/customers', async (req, res) => {
    try {
      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: 'select distinct TCPP_PARENT_NAME from PRD_REPORTING_LAYER.TCPP_SCORECARD_CA_PIVOT where TCPP_PARENT_NAME is not null order by TCPP_PARENT_NAME;',
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to query CA customers from Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            const customers = rows ? rows.map(r => r.TCPP_PARENT_NAME) : [];
            res.json(customers);
          }
        });
      } catch (err: any) {
          console.error('Snowflake CA scorecard customers connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      console.error('Error in /api/reports/scorecard-ca/customers:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });

  app.post('/api/reports/scorecard-ca/export', async (req, res) => {
    try {
      const { customerName } = req.body;
      if (!customerName) {
        return res.status(400).json({ error: 'customerName is required.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        const escapedCustomer = customerName.replace(/'/g, "''");
        connection.execute({
          sqlText: `select REPORT_SECTION, REPORT_SECTION_SEQ, REPORT_SECTION_HEADER,
       TCPP_PARENT_CODE, TCPP_PARENT_NAME, TCPP_SEFA_FILTER,
       TCPP_REPORT_TYPE, SCORECARD_FILTER, REPORT_DATE,
       PRODUCT_CATEGORY, PRODUCT_SUB_CATEGORY, SCORECARD_METRIC_NAME,
       PREVIOUS_YEAR3_SALES, PREVIOUS_YEAR2_SALES,
       PREVIOUS_YEAR_SALES, THREE_YEAR_AVG, PREVIOUS_YEAR_VARIANCE,
       PREVIOUS_YEAR_3YEAR_AVG_VARIANCE, TARGET_VALUE, ACTUAL_VALUE,
       TARGET_AMOUNT, ACTUAL_AMOUNT, TARGET_METRIC_CNT, SCORECARD_METRIC_CNT,
       SCORECARD_TALLY_CNT, SCORECARD_METRIC_MET, TOTAL_METRIC_MET_CNT,
       PERCENT_TO_TARGET, AMOUNT_REMAINING, QUALIFIED_LEVEL, LAST_UPDATE
from PRD_REPORTING_LAYER.TCPP_SCORECARD_CA_PIVOT where TCPP_PARENT_NAME = '${escapedCustomer}' order by REPORT_SECTION_SEQ`,
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error('Failed to query CA scorecard rows from Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            try {
              const templateName = 'TIERED_REBATES_SCORECARD_CA_Template.xlsm';
              const templatePath = path.join(process.cwd(), templateName);

              const cleanCustomer = customerName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
              const targetFilename = `Tiered_Rebates_Scorecard_${cleanCustomer}.xlsm`;
              const targetPath = path.join(process.cwd(), targetFilename);

              // Copy the template file to the new renamed file path BEFORE editing and appending
              if (fs.existsSync(templatePath)) {
                fs.copyFileSync(templatePath, targetPath);
              } else {
                console.warn(`Template file ${templateName} not found at ${templatePath}.`);
              }

              let workbook;
              if (fs.existsSync(targetPath)) {
                workbook = await XlsxPopulate.fromFileAsync(targetPath);
              } else {
                console.warn('Creating a blank fallback workbook.');
                workbook = await XlsxPopulate.fromBlankAsync();
              }

              // Retrieve or create 'Snowflake_Data' worksheet
              let worksheet = workbook.sheet('Snowflake_Data');
              if (!worksheet) {
                worksheet = workbook.sheet(0) || workbook.addSheet('Snowflake_Data');
                worksheet.name('Snowflake_Data');
              }

              // Column definitions for CA
              const caColumns = [
                'REPORT_SECTION', 'REPORT_SECTION_SEQ', 'REPORT_SECTION_HEADER',
                'TCPP_PARENT_CODE', 'TCPP_PARENT_NAME', 'TCPP_SEFA_FILTER',
                'TCPP_REPORT_TYPE', 'SCORECARD_FILTER', 'REPORT_DATE',
                'PRODUCT_CATEGORY', 'PRODUCT_SUB_CATEGORY', 'SCORECARD_METRIC_NAME',
                'PREVIOUS_YEAR3_SALES', 'PREVIOUS_YEAR2_SALES',
                'PREVIOUS_YEAR_SALES', 'THREE_YEAR_AVG', 'PREVIOUS_YEAR_VARIANCE',
                'PREVIOUS_YEAR_3YEAR_AVG_VARIANCE', 'TARGET_VALUE', 'ACTUAL_VALUE',
                'TARGET_AMOUNT', 'ACTUAL_AMOUNT', 'TARGET_METRIC_CNT', 'SCORECARD_METRIC_CNT',
                'SCORECARD_TALLY_CNT', 'SCORECARD_METRIC_MET', 'TOTAL_METRIC_MET_CNT',
                'PERCENT_TO_TARGET', 'AMOUNT_REMAINING', 'QUALIFIED_LEVEL', 'LAST_UPDATE'
              ];

              // Append rows starting at row 2, leaving row 1 (headers) intact (or write headers if fallback)
              if (rows && rows.length > 0) {
                const hasExistingHeaders = fs.existsSync(templatePath);
                if (!hasExistingHeaders) {
                  caColumns.forEach((header, colIdx) => {
                    worksheet.cell(1, colIdx + 1).value(header).style('bold', true);
                  });
                  worksheet.cell(1, 32).value("AF_Formula").style('bold', true);
                  worksheet.cell(1, 33).value("AG_Formula").style('bold', true);
                  worksheet.cell(1, 34).value("AH_Formula").style('bold', true);
                }

                // Append rows starting at row 2
                rows.forEach((row, rowIdx) => {
                  const currentExcelRow = rowIdx + 2;
                  caColumns.forEach((key, colIdx) => {
                    worksheet.cell(currentExcelRow, colIdx + 1).value(row[key]);
                  });

                  // Generate dynamic formulas matching the row number
                  const formulaAF = `=_xlfn.IFS(ISNUMBER(SEARCH("_net_sales", L${currentExcelRow})), "Sales Greater Than Target", ISNUMBER(SEARCH("_silver_qualifier", L${currentExcelRow})), "Sales Less Then Target = Bronze, Greater Then Target = Silver, Gold or Platinum", A${currentExcelRow}="overall", "Total Points Earned", A${currentExcelRow}="growth", " Exceeds Nominal Growth", AND(A${currentExcelRow}="leads", J${currentExcelRow}="LEAD_SCORECARD_QUALIFIER"), "Meet Smallwares and 1 out of 4 equipment", A${currentExcelRow}="leads", "Leads With Vollrath", A${currentExcelRow}="new products", "New Product Support", A${currentExcelRow}="drop ship", "Meets Drop Ship Requirements", AND(A${currentExcelRow}="qualifiers", L${currentExcelRow}="order_performance_qualifier"), "Allows Carrier Selection and Avoids Accessorial Charges", AND(A${currentExcelRow}="qualifiers", L${currentExcelRow}="marketing_support_qualifier"), "Approved Marketing Plan/Usage of co-op funds", AND(A${currentExcelRow}="qualifiers", L${currentExcelRow}="access_and_training_qualifier"), "Access to End Users", TRUE, "")`;
                  const formulaAG = `=_xlfn.IFS(UPPER(C${currentExcelRow})="QUALIFIED TIER LEVEL",FALSE,UPPER(J${currentExcelRow})="TIER LEVEL",FALSE,OR(AND(UPPER(C${currentExcelRow})="ACCESS & TRAINING",B${currentExcelRow}="07-30",UPPER(AF${currentExcelRow})="ACCESS TO END USERS",UPPER(Z${currentExcelRow})="Y",ISBLANK(K${currentExcelRow})=TRUE)=TRUE,AND(UPPER(C${currentExcelRow})="MARKETING SUPPORT",B${currentExcelRow}="07-20",UPPER(AF${currentExcelRow})="APPROVED MARKETING PLAN/USAGE OF CO-OP FUNDS",UPPER(Z${currentExcelRow})="N",ISBLANK(K${currentExcelRow})=TRUE),AND(UPPER(C${currentExcelRow})="VOLRATH_CARRIER_MET=Y AVOID_ACESSORIAL_CHARGES_MET=Y",B${currentExcelRow}="07-10",UPPER(AF${currentExcelRow})="ALLOWS CARRIER SELECTION AND AVOIDS ACCESSORIALS",UPPER(Z${currentExcelRow})="Y",ISBLANK(K${currentExcelRow})=TRUE)=TRUE),FALSE,UPPER(AF${currentExcelRow})="APPROVED MARKETING PLAN/USAGE of co-op funds",FALSE,TRUE,TRUE)`;
                  const formulaAH = `=_xlfn.IFS(UPPER(C${currentExcelRow})="QUALIFIED TIER LEVEL",FALSE,UPPER(J${currentExcelRow})="TIER QUALIFIER",FALSE,UPPER(H${currentExcelRow})<>"SUMMARY",FALSE,TRUE,TRUE)`;

                  worksheet.cell(currentExcelRow, 32).formula(formulaAF);
                  worksheet.cell(currentExcelRow, 33).formula(formulaAG);
                  worksheet.cell(currentExcelRow, 34).formula(formulaAH);
                });
              } else {
                worksheet.cell(2, 1).value('No rows found for this customer in Snowflake.');
              }

              // Save the renamed spreadsheet
              await workbook.toFileAsync(targetPath);

              // Send the file to client and delete the local copy afterward
              res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
              res.setHeader('Content-Disposition', `attachment; filename="${targetFilename}"`);
              res.download(targetPath, targetFilename, (downloadErr) => {
                if (downloadErr) {
                  console.error('Error downloading the file:', downloadErr);
                }
                // Cleanup the local copied file
                try {
                  if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                  }
                } catch (unlinkErr) {
                  console.error('Error deleting temp CA export file:', unlinkErr);
                }
              });

            } catch (xlsxErr: any) {
              console.error('Error manipulating CA spreadsheet:', xlsxErr);
              res.status(500).json({ error: 'Spreadsheet generation failed', details: xlsxErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake CA scorecard export connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      console.error('Error in /api/reports/scorecard-ca/export:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });

  app.get('/api/reports/scorecard-sefa/customers', async (req, res) => {
    try {
      try {
        const connection = await getSnowflakeConnection();

        connection.execute({
          sqlText: 'select distinct TCPP_PARENT_NAME from PRD_REPORTING_LAYER.TCPP_SCORECARD_SEFA_PIVOT where TCPP_PARENT_NAME is not null order by TCPP_PARENT_NAME;',
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to query SEFA customers from Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            const customers = rows ? rows.map(r => r.TCPP_PARENT_NAME) : [];
            res.json(customers);
          }
        });
      } catch (err: any) {
          console.error('Snowflake SEFA scorecard customers connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      console.error('Error in /api/reports/scorecard-sefa/customers:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });

  app.post('/api/reports/scorecard-sefa/export', async (req, res) => {
    try {
      const { customerName } = req.body;
      if (!customerName) {
        return res.status(400).json({ error: 'customerName is required.' });
      }

      try {
        const connection = await getSnowflakeConnection();

        const escapedCustomer = customerName.replace(/'/g, "''");
        connection.execute({
          sqlText: `select REPORT_SECTION, REPORT_SECTION_SEQ, REPORT_SECTION_HEADER,
       TCPP_PARENT_CODE, TCPP_PARENT_NAME, TCPP_SEFA_FILTER,
       TCPP_REPORT_TYPE, SCORECARD_FILTER, REPORT_DATE,
       PRODUCT_CATEGORY, PRODUCT_SUB_CATEGORY, SCORECARD_METRIC_NAME,
       PREVIOUS_YEAR3_SALES, PREVIOUS_YEAR2_SALES,
       PREVIOUS_YEAR_SALES, THREE_YEAR_AVG, PREVIOUS_YEAR_VARIANCE,
       PREVIOUS_YEAR_3YEAR_AVG_VARIANCE, TARGET_VALUE, ACTUAL_VALUE,
       TARGET_AMOUNT, ACTUAL_AMOUNT, TARGET_METRIC_CNT, SCORECARD_METRIC_CNT,
       SCORECARD_TALLY_CNT, SCORECARD_METRIC_MET, TOTAL_METRIC_MET_CNT,
       PERCENT_TO_TARGET, AMOUNT_REMAINING, QUALIFIED_LEVEL, LAST_UPDATE
from PRD_REPORTING_LAYER.TCPP_SCORECARD_SEFA_PIVOT where TCPP_PARENT_NAME = '${escapedCustomer}' order by REPORT_SECTION_SEQ`,
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error('Failed to query SEFA scorecard rows from Snowflake:', err.message);
              return res.status(500).json({ error: 'Snowflake query failed', details: err.message });
            }

            try {
              const templateName = 'TIERED_REBATES_SCORECARD_SEFA_Template.xlsm';
              const templatePath = path.join(process.cwd(), templateName);

              const cleanCustomer = customerName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
              const targetFilename = `Tiered_Rebates_Scorecard_${cleanCustomer}.xlsm`;
              const targetPath = path.join(process.cwd(), targetFilename);

              // Copy the template file to the new renamed file path BEFORE editing and appending
              if (fs.existsSync(templatePath)) {
                fs.copyFileSync(templatePath, targetPath);
              } else {
                console.warn(`Template file ${templateName} not found at ${templatePath}. Checking US template as fallback...`);
                const fallbackTemplate = 'TIERED_REBATES_SCORECARD_US_Template.xlsm';
                const fallbackPath = path.join(process.cwd(), fallbackTemplate);
                if (fs.existsSync(fallbackPath)) {
                  fs.copyFileSync(fallbackPath, targetPath);
                } else {
                  console.warn(`Fallback US Template also not found.`);
                }
              }

              let workbook;
              if (fs.existsSync(targetPath)) {
                workbook = await XlsxPopulate.fromFileAsync(targetPath);
              } else {
                console.warn('Creating a blank fallback workbook.');
                workbook = await XlsxPopulate.fromBlankAsync();
              }

              // Retrieve or create 'Snowflake_Data' worksheet
              let worksheet = workbook.sheet('Snowflake_Data');
              if (!worksheet) {
                worksheet = workbook.sheet(0) || workbook.addSheet('Snowflake_Data');
                worksheet.name('Snowflake_Data');
              }

              // Column definitions for SEFA
              const sefaColumns = [
                'REPORT_SECTION', 'REPORT_SECTION_SEQ', 'REPORT_SECTION_HEADER',
                'TCPP_PARENT_CODE', 'TCPP_PARENT_NAME', 'TCPP_SEFA_FILTER',
                'TCPP_REPORT_TYPE', 'SCORECARD_FILTER', 'REPORT_DATE',
                'PRODUCT_CATEGORY', 'PRODUCT_SUB_CATEGORY', 'SCORECARD_METRIC_NAME',
                'PREVIOUS_YEAR3_SALES', 'PREVIOUS_YEAR2_SALES',
                'PREVIOUS_YEAR_SALES', 'THREE_YEAR_AVG', 'PREVIOUS_YEAR_VARIANCE',
                'PREVIOUS_YEAR_3YEAR_AVG_VARIANCE', 'TARGET_VALUE', 'ACTUAL_VALUE',
                'TARGET_AMOUNT', 'ACTUAL_AMOUNT', 'TARGET_METRIC_CNT', 'SCORECARD_METRIC_CNT',
                'SCORECARD_TALLY_CNT', 'SCORECARD_METRIC_MET', 'TOTAL_METRIC_MET_CNT',
                'PERCENT_TO_TARGET', 'AMOUNT_REMAINING', 'QUALIFIED_LEVEL', 'LAST_UPDATE'
              ];

              // Append rows starting at row 2, leaving row 1 (headers) intact (or write headers if fallback)
              if (rows && rows.length > 0) {
                const hasExistingHeaders = fs.existsSync(templatePath) || fs.existsSync(path.join(process.cwd(), 'TIERED_REBATES_SCORECARD_US_Template.xlsm'));
                if (!hasExistingHeaders) {
                  sefaColumns.forEach((header, colIdx) => {
                    worksheet.cell(1, colIdx + 1).value(header).style('bold', true);
                  });
                  worksheet.cell(1, 32).value("AF_Formula").style('bold', true);
                  worksheet.cell(1, 33).value("AG_Formula").style('bold', true);
                  worksheet.cell(1, 34).value("AH_Formula").style('bold', true);
                }

                // Append rows starting at row 2
                rows.forEach((row, rowIdx) => {
                  const currentExcelRow = rowIdx + 2;
                  sefaColumns.forEach((key, colIdx) => {
                    worksheet.cell(currentExcelRow, colIdx + 1).value(row[key]);
                  });

                  // Generate dynamic formulas matching the row number
                  const formulaAF = `=IF(ISNUMBER(SEARCH("_net_sales", LOWER(L${currentExcelRow}))), "Sales Greater Than Target", IF(ISNUMBER(SEARCH("_silver_qualifier", LOWER(L${currentExcelRow}))), "Sales Less Then Target = Bronze, Greater Then Target = Silver, Gold or Platinum", IF(LOWER(A${currentExcelRow})="overall", "Total Points Earned", IF(LOWER(A${currentExcelRow})="growth", " Exceeds Nominal Growth", IF(AND(LOWER(A${currentExcelRow})="yoy", UPPER(J${currentExcelRow})="SERVING SYS & COMPONENTS"), "Growth in 1 of 1 Categories", IF(AND(LOWER(A${currentExcelRow})="yoy", UPPER(J${currentExcelRow})="YOY GROWTH"), "TOTAL GROWTH", IF(LOWER(A${currentExcelRow})="yoy", "Growth in 2 of 3 Categories", IF(LOWER(A${currentExcelRow})="new products", "New Product Support", IF(LOWER(A${currentExcelRow})="drop ship", "Meets Drop Ship Requirements", IF(AND(LOWER(A${currentExcelRow})="qualifiers", LOWER(L${currentExcelRow})="order_performance_qualifier"), "Allows Carrier Selection and Avoids Accessorial Charges", IF(AND(LOWER(A${currentExcelRow})="qualifiers", LOWER(L${currentExcelRow})="marketing_support_qualifier"), "Approved Marketing Plan/Usage of co-op funds", IF(AND(LOWER(A${currentExcelRow})="qualifiers", LOWER(L${currentExcelRow})="access_and_training_qualifier"), "Access to End Users", ""))))))))))))`;
                  const formulaAG = `=_xlfn.IFS(UPPER(C${currentExcelRow})="QUALIFIED TIER LEVEL",FALSE,UPPER(J${currentExcelRow})="TIER LEVEL",FALSE,OR(UPPER(AF${currentExcelRow})="ACCESS TO END USERS",UPPER(AF${currentExcelRow})="ALLOWS CARRIER SELECTION AND AVOIDS ACCESSORIAL CHARGES",UPPER(AF${currentExcelRow})="APPROVED MARKETING PLAN/USAGE OF CO-OP FUNDS",UPPER(AF${currentExcelRow})="SALES LESS THAN TARGET = BRONZE, GREATER THAN TARGET = SILVER, GOLD OR PLATINUM",UPPER(AF${currentExcelRow})="TOTAL POINTS EARNED")=TRUE,FALSE,TRUE,TRUE)`;
                  const formulaAH = `=_xlfn.IFS(UPPER(C${currentExcelRow})="QUALIFIED TIER LEVEL",FALSE,UPPER(J${currentExcelRow})="TIER QUALIFIER",FALSE,UPPER(H${currentExcelRow})<>"SUMMARY",FALSE,TRUE,TRUE)`;

                  worksheet.cell(currentExcelRow, 32).formula(formulaAF);
                  worksheet.cell(currentExcelRow, 33).formula(formulaAG);
                  worksheet.cell(currentExcelRow, 34).formula(formulaAH);
                });
              } else {
                worksheet.cell(2, 1).value('No rows found for this customer in Snowflake.');
              }

              // Save the renamed spreadsheet
              await workbook.toFileAsync(targetPath);

              // Send the file to client and delete the local copy afterward
              res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
              res.setHeader('Content-Disposition', `attachment; filename="${targetFilename}"`);
              res.download(targetPath, targetFilename, (downloadErr) => {
                if (downloadErr) {
                  console.error('Error downloading the file:', downloadErr);
                }
                // Cleanup the local copied file
                try {
                  if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                  }
                } catch (unlinkErr) {
                  console.error('Error deleting temp SEFA export file:', unlinkErr);
                }
              });

            } catch (xlsxErr: any) {
              console.error('Error manipulating SEFA spreadsheet:', xlsxErr);
              res.status(500).json({ error: 'Spreadsheet generation failed', details: xlsxErr.message });
            }
          }
        });
      } catch (err: any) {
          console.error('Snowflake SEFA scorecard export connection failed:', err);
          return res.status(500).json({
            error: 'Snowflake connection failed',
            details: err.message
          });
      }
    } catch (error: any) {
      console.error('Error in /api/reports/scorecard-sefa/export:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });

  app.get('/api/spreadsheet-views/finance-customer-rebate', async (req, res) => {
    try {
      const pool = await getPool();
      
      const result = await pool.request().query(`
        SELECT [Finance_Customer_Rebate] as Customer_ID
            ,[Customer_Name]
            ,[Rebate_Percent]
            ,[Rebate_Percent_Explanation]
            ,[ACS_Rebate]
            ,[ACSRebate_Percent_Explanation]
            ,[Cash_Rebate]
            ,[Cash_Rebate_Percent_Explanation]
            ,[Group_Number]
            ,[Date_Effective]
            ,[Date_Expired]
            ,[Updated_By]
            ,[Updated_Date]
        FROM [tcpp].[TCPP_FINANCE_CUSTOMER_REBATE_TVFView]
      `);
      
      res.json(result.recordset);
    } catch (error: any) {
      console.error('Error in /api/spreadsheet-views/finance-customer-rebate:', error);
      res.status(500).json({ error: 'SQL Server query failed', details: error.message });
    }
  });

  app.get('/api/spreadsheet-views/customer-lookup', async (req, res) => {
    try {
      const pool = await getPool();
      
      const result = await pool.request().query(`
        SELECT [Address_Book] as Customer_ID
            ,[Dealer_Name] as Customer_Name
            ,[Group_Name]
            ,[Territory]
            ,[Region]
            ,[Specific_Rebate_Code]
            ,[Sales]
            ,[Tier]
        FROM [exports].[TCPP_CUSTOMER_LOOKUP_View]
      `);
      
      res.json(result.recordset);
    } catch (error: any) {
      console.error('Error in /api/spreadsheet-views/customer-lookup:', error);
      res.status(500).json({ error: 'SQL Server query failed', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
