const https = require('https');

function query(connectionString, sql, params) {
  return new Promise((resolve, reject) => {
    const url = new URL(connectionString);
    const body = JSON.stringify({ query: sql, params });
    const options = {
      hostname: url.hostname,
      port: 443,
      path: '/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${url.password}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const b = req.body;
  const finalName     = b.full_name || b.fullName || b.name || '';
  const finalEmail    = b.email || b.email_address || b.emailAddress || '';
  const finalPhone    = b.phone || b.phone_number || b.phoneNumber || '';
  const finalUsername = b.username || b.user_name || b.userName || '';
  const finalReferral = b.referral_code || b.referralCode || b.referral || '';

  if (!finalName)     return res.status(400).json({ error: 'Full name is required.' });
  if (!finalEmail)    return res.status(400).json({ error: 'Email is required.' });
  if (!finalUsername) return res.status(400).json({ error: 'Username is required.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(finalUsername))
    return res.status(400).json({ error: 'Username must be 3-30 characters.' });

  const db = process.env.POSTGRES_URL;
  if (!db) return res.status(500).json({ error: 'Database not configured' });

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: db, ssl: { rejectUnauthorized: false } });

    // Check username taken
    const taken = await pool.query('SELECT id FROM signups WHERE LOWER(username)=LOWER($1) LIMIT 1', [finalUsername]);
    if (taken.rows.length) { await pool.end(); return res.status(409).json({ error: 'That username is already taken. Try another!' }); }

    // Check email taken
    const emailTaken = await pool.query('SELECT id FROM signups WHERE LOWER(email)=LOWER($1) LIMIT 1', [finalEmail]);
    if (emailTaken.rows.length) { await pool.end(); return res.status(409).json({ error: 'That email is already registered.' }); }

    // Check referral code is valid (mandatory)
    if (!finalReferral) {
      await pool.end();
      return res.status(400).json({ error: 'A referral code is required to join.' });
    }

    const adminCodes = ['MASSED-ADMIN', 'MASSED-COORDINATOR'];
    if (!adminCodes.includes(finalReferral.toUpperCase())) {
      const validRef = await pool.query(
        'SELECT id FROM signups WHERE UPPER(referral_code)=UPPER($1) LIMIT 1',
        [finalReferral]
      );
      if (!validRef.rows.length) {
        await pool.end();
        return res.status(400).json({ error: 'Invalid referral code. Please check and try again.' });
      }
    }

    // Get waitlist position
    const countRes = await pool.query('SELECT COUNT(*) as count FROM signups');
    const waitlist_pos = parseInt(countRes.rows[0].count) + 1;
    const spotsLeft = 48000 - waitlist_pos;

    // Save signup
    const insertResult = await pool.query(
      'INSERT INTO signups (full_name, email, phone, username, referral_code, waitlist_pos, email_sent) VALUES ($1,$2,$3,$4,$5,$6,FALSE) RETURNING id',
      [finalName, finalEmail.toLowerCase(), finalPhone||null, finalUsername.toLowerCase(), finalReferral?finalReferral.toUpperCase():null, waitlist_pos]
    );

    await pool.end();

    return res.status(200).json({
      success: true,
      username: finalUsername,
      waitlist_pos,
      spots_remaining: spotsLeft,
      email_sent: false
    });

  } catch(err) {
    console.error(err);
    if (err.message?.includes('username')) return res.status(409).json({ error: 'That username is already taken.' });
    if (err.message?.includes('email'))    return res.status(409).json({ error: 'That email is already registered.' });
    return res.status(500).json({ error: err.message });
  }
};
