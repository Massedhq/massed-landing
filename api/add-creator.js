module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { full_name, code, created_by } = req.body;
  if (!full_name || !code) return res.status(400).json({ error: 'Name and code required' });

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

    // Check code not already taken
    const existing = await pool.query('SELECT id FROM referral_codes WHERE UPPER(code)=UPPER($1) LIMIT 1', [code]);
    if (existing.rows.length) { await pool.end(); return res.status(409).json({ error: 'That code already exists.' }); }

    // Save to referral_codes table
    await pool.query(
      'INSERT INTO referral_codes (code, created_by, use_limit, use_count, active) VALUES ($1,$2,$3,$4,$5)',
      [code.toUpperCase(), created_by || full_name, 50, 0, true]
    );

    await pool.end();
    return res.status(200).json({ success: true, code: code.toUpperCase() });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
