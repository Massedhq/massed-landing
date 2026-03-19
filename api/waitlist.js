module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const db = process.env.POSTGRES_URL;
  if (!db) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: db, ssl: { rejectUnauthorized: false } });
    const r = await pool.query('SELECT COUNT(*) as count FROM signups');
    await pool.end();
    const claimed = parseInt(r.rows[0].count);
    const total = 48000;
    return res.status(200).json({ total, claimed, remaining: total-claimed, percent: Math.round(claimed/total*100) });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
