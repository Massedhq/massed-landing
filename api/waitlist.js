import { sql } from '@vercel/postgres';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await sql`SELECT COUNT(*) as count FROM signups`;
    const claimed = parseInt(r.rows[0].count);
    const total = 48000;
    return res.status(200).json({ total, claimed, remaining: total-claimed, percent: Math.round(claimed/total*100) });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
