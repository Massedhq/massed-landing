const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const result = await sql`
      SELECT id, full_name, email, phone, username, referral_code,
             waitlist_pos, email_sent, email_sent_at, created_at
      FROM signups ORDER BY created_at DESC;
    `;
    return res.status(200).json({ signups: result.rows });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
