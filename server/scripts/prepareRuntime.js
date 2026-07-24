const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('ALLOW_SCHEMA_MIGRATION=true is required');
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
    throw new Error('BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    for (const filename of fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
      await pool.query(fs.readFileSync(path.join(migrationsDir, filename), 'utf8'));
    }
    const password = await bcrypt.hash(process.env.PROVISION_ADMIN_PASSWORD, 12);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [process.env.PROVISION_ADMIN_NAME, process.env.PROVISION_ADMIN_EMAIL, password]
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Runtime preparation failed: ${error.message}`);
  process.exit(1);
});
