#!/usr/bin/env node

// This script will run in the Railway environment during startup
// It will add the missing customerId column to the User table

const { Client } = require('pg');

async function addCustomerIdColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_PRIVATE_URL || process.env.NEXT_PRIVATE_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check if the column exists
    const checkResult = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'customerId'
    `);

    if (checkResult.rows.length === 0) {
      console.log('⚠️  customerId column does not exist. Adding it...');

      // Add the customerId column
      await client.query(`ALTER TABLE "User" ADD COLUMN "customerId" TEXT`);
      console.log('✅ customerId column added successfully');

      // Add the unique constraint
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_customerId_key" ON "User"("customerId")`,
      );
      console.log('✅ Unique constraint added successfully');
    } else {
      console.log('ℹ️  customerId column already exists');
    }

    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'customerId'
    `);

    console.log('🔍 Column verification:', verifyResult.rows);
  } catch (error) {
    console.error('❌ Error fixing customerId column:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

if (require.main === module) {
  addCustomerIdColumn();
}

module.exports = { addCustomerIdColumn };
