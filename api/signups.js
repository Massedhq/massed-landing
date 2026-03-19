module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const db = process.env.POSTGRES_URL;
  if (!db) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: db, ssl: { rejectUnauthorized: false } });
    const result = await pool.query('SELECT id, full_name, email, phone, username, referral_code, waitlist_pos, email_sent, email_sent_at, created_at FROM signups ORDER BY created_at DESC');
    await pool.end();
    return res.status(200).json({ signups: result.rows });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
