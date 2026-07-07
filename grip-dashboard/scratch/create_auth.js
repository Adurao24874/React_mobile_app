const { Client } = require('pg');

const emails = [
  "admin.pernem@grip-goa.online",
  "admin.bardez@grip-goa.online",
  "admin.tiswadi@grip-goa.online",
  "admin.bicholim@grip-goa.online",
  "admin.sattari@grip-goa.online",
  "admin.ponda@grip-goa.online",
  "admin.salcete@grip-goa.online",
  "admin.mormugao@grip-goa.online",
  "admin.quepem@grip-goa.online",
  "admin.sanguem@grip-goa.online",
  "admin.canacona@grip-goa.online",
  "admin.dharbandora@grip-goa.online"
];

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.ytmuudbkuhkfqkzchtce:GripGoaProject2026@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  });

  await client.connect();

  for (const email of emails) {
    try {
      const res = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email]);
      if (res.rows.length > 0) {
        await client.query(`
          UPDATE auth.users 
          SET encrypted_password = crypt('Password123!', gen_salt('bf')),
              email_confirmed_at = now()
          WHERE email = $1
        `, [email]);
        console.log(`Updated existing user: ${email}`);
      } else {
        await client.query(`
          INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
          ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1, crypt('Password123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now()
          )
        `, [email]);
        console.log(`Created new user: ${email}`);
      }
    } catch (e) {
      console.error(`Error processing ${email}:`, e.message);
    }
  }

  await client.end();
  console.log("Done!");
}

main();
