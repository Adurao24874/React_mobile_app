import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // This is the magic block that allows Next.js to talk to Supabase
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;