const { sql } = require('@vercel/postgres');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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
    return res.status(400).json({ error: 'Username must be 3-30 characters, letters/numbers/underscores only.' });

  try {
    const taken = await sql`SELECT id FROM signups WHERE LOWER(username)=LOWER(${finalUsername}) LIMIT 1`;
    if (taken.rows.length) return res.status(409).json({ error: 'That username is already taken. Try another!' });

    const emailTaken = await sql`SELECT id FROM signups WHERE LOWER(email)=LOWER(${finalEmail}) LIMIT 1`;
    if (emailTaken.rows.length) return res.status(409).json({ error: 'That email is already registered.' });

    if (finalReferral) {
      const code = await sql`SELECT use_count,use_limit,active FROM referral_codes WHERE UPPER(code)=UPPER(${finalReferral}) LIMIT 1`;
      if (!code.rows.length) return res.status(400).json({ error: 'Invalid referral code.' });
      const { active, use_count, use_limit } = code.rows[0];
      if (!active || use_count >= use_limit) return res.status(400).json({ error: 'This referral code has reached its limit.' });
    }

    const countRes = await sql`SELECT COUNT(*) as count FROM signups`;
    const waitlist_pos = parseInt(countRes.rows[0].count) + 1;
    const spotsLeft = 48000 - waitlist_pos;

    const insertResult = await sql`
      INSERT INTO signups (full_name, email, phone, username, referral_code, waitlist_pos, email_sent)
      VALUES (${finalName}, ${finalEmail.toLowerCase()}, ${finalPhone||null}, ${finalUsername.toLowerCase()}, ${finalReferral?finalReferral.toUpperCase():null}, ${waitlist_pos}, FALSE)
      RETURNING id;
    `;
    const signupId = insertResult.rows[0].id;

    if (finalReferral) {
      await sql`UPDATE referral_codes SET use_count=use_count+1 WHERE UPPER(code)=UPPER(${finalReferral})`;
    }

    let emailSent = false;
    const FROM = process.env.FROM_EMAIL || 'hello@massed.io';

    try {
      await resend.emails.send({
        from: `MASSED <${FROM}>`,
        to: finalEmail,
        subject: `Your username massed.io/${finalUsername} is reserved! 🔐`,
        html: `<div style="max-width:560px;margin:40px auto;font-family:Georgia,serif;background:#0d0d0d;border:1px solid rgba(196,154,108,0.3);border-radius:16px;overflow:hidden;"><div style="background:linear-gradient(135deg,#1a1208,#0d0d0d);padding:32px;text-align:center;border-bottom:1px solid rgba(196,154,108,0.2);"><h1 style="font-size:2.5rem;font-weight:900;letter-spacing:0.3em;color:#C49A6C;margin:0;">MASSED</h1><p style="color:#6a7080;font-size:0.6rem;letter-spacing:0.5em;margin:6px 0 0;">PRESENCE IS POWER</p></div><div style="padding:36px;"><h2 style="color:#F5F0E8;font-size:1.3rem;margin:0 0 8px;">Your username is reserved! 🎉</h2><p style="color:#A0A8B0;margin:0 0 24px;">Hi ${finalName}, you're officially on the MASSED waitlist.</p><div style="background:rgba(196,154,108,0.08);border:1px solid rgba(196,154,108,0.25);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center;"><p style="color:#A0A8B0;font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 8px;">Your Reserved Link</p><p style="color:#C49A6C;font-size:1.4rem;font-weight:700;margin:0;">massed.io/${finalUsername}</p></div><div style="background:rgba(196,154,108,0.05);border:1px solid rgba(196,154,108,0.15);border-radius:10px;padding:16px;margin-bottom:24px;text-align:center;"><p style="color:#A0A8B0;font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 6px;">Your Waitlist Position</p><p style="color:#C49A6C;font-size:2.2rem;font-weight:900;margin:0;">#${waitlist_pos}</p><p style="color:#6a7080;font-size:0.78rem;margin:4px 0 0;">${spotsLeft.toLocaleString()} spots remaining of 48,000</p></div><p style="color:#A0A8B0;font-size:0.88rem;line-height:1.7;">We'll be in touch soon. Stay ready.</p></div></div>`
      });
      emailSent = true;
      await sql`UPDATE signups SET email_sent=TRUE, email_sent_at=NOW() WHERE id=${signupId}`;
    } catch(emailErr) {
      console.error('Email failed:', emailErr);
    }

    return res.status(200).json({ success:true, username:finalUsername, waitlist_pos, spots_remaining:spotsLeft, email_sent:emailSent });

  } catch(err) {
    console.error(err);
    if (err.message?.includes('username')) return res.status(409).json({ error: 'That username is already taken.' });
    if (err.message?.includes('email'))    return res.status(409).json({ error: 'That email is already registered.' });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
