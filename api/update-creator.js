module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, full_name, email, phone, referral_code } = req.body;
  if (!id) return res.status(400).json({ error: 'ID required' });

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
    await pool.query(
      'UPDATE signups SET full_name=$1, email=$2, phone=$3, referral_code=$4 WHERE id=$5',
      [full_name, email?.toLowerCase(), phone||null, referral_code||null, id]
    );
    await pool.end();
    return res.status(200).json({ success: true });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
