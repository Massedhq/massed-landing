const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { full_name, email, phone, username, code, created_by } = req.body;
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

    // Save to signups table so they show in User Management
    const countRes = await pool.query('SELECT COUNT(*) as count FROM signups');
    const waitlist_pos = parseInt(countRes.rows[0].count) + 1;
    const finalUsername = (username || full_name).toLowerCase().replace(/\s/g,'').slice(0,20);
    const finalEmail = email || finalUsername+'@placeholder.com';

    await pool.query(
      'INSERT INTO signups (full_name, email, phone, username, referral_code, waitlist_pos, email_sent) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [full_name, finalEmail.toLowerCase(), phone||null, finalUsername, code.toUpperCase(), waitlist_pos, false]
    );

    // Send creator email if real email provided
    if (email) {
      const FROM = process.env.FROM_EMAIL || 'hello@massed.io';
      await resend.emails.send({
        from: `MASSED <${FROM}>`,
        to: email,
        subject: `Your MASSED referral code is ready! 🔐`,
        html: `<div style="max-width:560px;margin:40px auto;font-family:Georgia,serif;background:#0d0d0d;border:1px solid rgba(196,154,108,0.3);border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a1208,#0d0d0d);padding:32px;text-align:center;border-bottom:1px solid rgba(196,154,108,0.2);">
            <h1 style="font-size:2.5rem;font-weight:900;letter-spacing:0.3em;color:#C49A6C;margin:0;">MASSED</h1>
          </div>
          <div style="padding:36px;">
            <h2 style="color:#F5F0E8;font-size:1.3rem;margin:0 0 8px;">Your referral code is ready! 🎉</h2>
            <p style="color:#A0A8B0;margin:0 0 24px;">Hi ${full_name}, share this code with your audience so they can secure their spot on the MASSED waitlist.</p>
            <div style="background:rgba(196,154,108,0.08);border:1px solid rgba(196,154,108,0.25);border-radius:10px;padding:20px;text-align:center;">
              <p style="color:#A0A8B0;font-size:0.85rem;margin:0 0 6px;letter-spacing:0.1em;">YOUR REFERRAL CODE</p>
              <p style="color:#C49A6C;font-size:2rem;font-weight:700;margin:0;">${code.toUpperCase()}</p>
            </div>
            <p style="color:#A0A8B0;margin-top:20px;">Have your audience enter this code at massed.io when signing up.</p>
          </div>
        </div>`
      });

      await pool.query('UPDATE signups SET email_sent=TRUE, email_sent_at=NOW() WHERE referral_code=$1', [code.toUpperCase()]);
    }

    await pool.end();
    return res.status(200).json({ success: true, code: code.toUpperCase() });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
