#!/usr/bin/env node

// This script will run in the Railway environment during startup
// It will add missing columns to the User table if they don't exist

const { Client } = require('pg');

async function addMissingUserColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_PRIVATE_URL || process.env.NEXT_PRIVATE_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check for missing columns
    const columnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name IN ('customerId', 'url')
    `);

    const existingColumns = columnsResult.rows.map((row) => row.column_name);
    const needsCustomerId = !existingColumns.includes('customerId');
    const needsUrl = !existingColumns.includes('url');

    console.log('📋 Column status:', { needsCustomerId, needsUrl });

    // Add customerId column if missing
    if (needsCustomerId) {
      console.log('⚠️  customerId column does not exist. Adding it...');

      await client.query(`ALTER TABLE "User" ADD COLUMN "customerId" TEXT`);
      console.log('✅ customerId column added successfully');

      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_customerId_key" ON "User"("customerId")`,
      );
      console.log('✅ customerId unique constraint added successfully');
    } else {
      console.log('ℹ️  customerId column already exists');
    }

    // Add url column if missing
    if (needsUrl) {
      console.log('⚠️  url column does not exist. Adding it...');

      await client.query(`ALTER TABLE "User" ADD COLUMN "url" TEXT`);
      console.log('✅ url column added successfully');

      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "User_url_key" ON "User"("url")`);
      console.log('✅ url unique constraint added successfully');
    } else {
      console.log('ℹ️  url column already exists');
    }

    // Verify all columns are now present
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name IN ('customerId', 'url')
      ORDER BY column_name
    `);

    console.log('🔍 Column verification:', verifyResult.rows);
  } catch (error) {
    console.error('❌ Error fixing User table columns:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

if (require.main === module) {
  addMissingUserColumns();
}

module.exports = { addMissingUserColumns };
