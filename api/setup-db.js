module.exports = async function handler(req, res) {
  if (req.query.secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const db = process.env.POSTGRES_URL;
  if (!db) return res.status(500).json({ error: 'POSTGRES_URL not set' });

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: db, ssl: { rejectUnauthorized: false } });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS signups (
        id            SERIAL PRIMARY KEY,
        full_name     TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        phone         TEXT,
        username      TEXT NOT NULL UNIQUE,
        referral_code TEXT,
        waitlist_pos  INTEGER,
        email_sent    BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMP WITH TIME ZONE,
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id          SERIAL PRIMARY KEY,
        code        TEXT NOT NULL UNIQUE,
        created_by  TEXT DEFAULT 'admin',
        use_limit   INTEGER DEFAULT 50,
        use_count   INTEGER DEFAULT 0,
        active      BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      INSERT INTO referral_codes (code, created_by)
      VALUES ('REF-ALPHA','Nicky2U'),('REF-BETA','Nicky2U'),('REF-GAMMA','Nicky2U'),('REF-DELTA','Nicky2U')
      ON CONFLICT (code) DO NOTHING
    `);

    await pool.end();
    return res.status(200).json({ success: true, message: 'Database ready!' });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};

