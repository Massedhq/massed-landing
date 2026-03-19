module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { username } = req.query;
  if (!username || username.length < 3) return res.status(200).json({ available: false, message: 'At least 3 characters required' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return res.status(200).json({ available: false, message: 'Letters, numbers and underscores only' });
  const db = process.env.POSTGRES_URL;
  if (!db) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: db, ssl: { rejectUnauthorized: false } });
    const r = await pool.query('SELECT id FROM signups WHERE LOWER(username)=LOWER($1) LIMIT 1', [username]);
    await pool.end();
    const available = r.rows.length === 0;
    return res.status(200).json({ available, message: available ? `massed.io/${username} is available!` : 'Username already taken' });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
