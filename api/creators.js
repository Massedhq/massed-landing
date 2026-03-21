module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
    const result = await pool.query('SELECT * FROM referral_codes ORDER BY created_at DESC');
    await pool.end();
    return res.status(200).json({ creators: result.rows });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
