const { sql } = require('@vercel/postgres');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { signup_id } = req.body;
  if (!signup_id) return res.status(400).json({ error: 'signup_id required' });

  try {
    const result = await sql`SELECT id, full_name, email, username, waitlist_pos, referral_code FROM signups WHERE id=${signup_id} LIMIT 1`;
    if (!result.rows.length) return res.status(404).json({ error: 'Signup not found' });

    const { full_name, email, username, waitlist_pos, referral_code } = result.rows[0];
    const spotsLeft = 48000 - waitlist_pos;
    const FROM = process.env.FROM_EMAIL || 'hello@massed.io';

    await resend.emails.send({
      from: `MASSED <${FROM}>`,
      to: email,
      subject: `Your username massed.io/${username} is reserved! 🔐`,
      html: `<div style="max-width:560px;margin:40px auto;font-family:Georgia,serif;background:#0d0d0d;border:1px solid rgba(196,154,108,0.3);border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1208,#0d0d0d);padding:32px;text-align:center;border-bottom:1px solid rgba(196,154,108,0.2);">
          <h1 style="font-size:2.5rem;font-weight:900;letter-spacing:0.3em;color:#C49A6C;margin:0;">MASSED</h1>
        </div>
        <div style="padding:36px;">
          <h2 style="color:#F5F0E8;font-size:1.3rem;margin:0 0 8px;">Your username is reserved! 🎉</h2>
          <p style="color:#A0A8B0;margin:0 0 24px;">Hi ${full_name}, you're officially on the MASSED waitlist.</p>
          <div style="background:rgba(196,154,108,0.08);border:1px solid rgba(196,154,108,0.25);border-radius:10px;padding:20px;text-align:center;">
            <p style="color:#C49A6C;font-size:1.4rem;font-weight:700;margin:0;">massed.io/${username}</p>
          </div>
          ${referral_code ? `
          <div style="background:rgba(196,154,108,0.08);border:1px solid rgba(196,154,108,0.25);border-radius:10px;padding:20px;text-align:center;margin-top:16px;">
            <p style="color:#A0A8B0;font-size:0.85rem;margin:0 0 6px;letter-spacing:0.1em;">YOUR REFERRAL CODE</p>
            <p style="color:#C49A6C;font-size:1.4rem;font-weight:700;margin:0;">${referral_code}</p>
          </div>` : ''}
          <p style="color:#A0A8B0;margin-top:20px;">Position: #${waitlist_pos} · ${spotsLeft.toLocaleString()} spots remaining</p>
        </div>
      </div>`
    });

    await sql`UPDATE signups SET email_sent=TRUE, email_sent_at=NOW() WHERE id=${signup_id}`;
    return res.status(200).json({ success: true, message: 'Email resent successfully' });
  } catch(err) {
    return res.status(500).json({ error: 'Failed to resend email: ' + err.message });
  }
};
