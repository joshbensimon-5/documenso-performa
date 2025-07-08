#!/usr/bin/env node

// This script will run in the Railway environment during startup
// It will add missing columns to both User and Team tables if they don't exist
// This replicates what the original migrations should have done

const { Client } = require('pg');

async function addMissingColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_PRIVATE_URL || process.env.NEXT_PRIVATE_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Fix User table columns
    await fixUserTable(client);

    // Fix Team table columns
    await fixTeamTable(client);

    console.log('✅ All table fixes completed successfully');
  } catch (error) {
    console.error('❌ Error fixing database columns:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

async function fixUserTable(client) {
  console.log('🔧 Checking User table...');

  // Check for missing User columns
  const userColumnsResult = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name IN ('customerId', 'url')
  `);

  const existingUserColumns = userColumnsResult.rows.map((row) => row.column_name);
  const needsCustomerId = !existingUserColumns.includes('customerId');
  const needsUrl = !existingUserColumns.includes('url');

  console.log('📋 User column status:', { needsCustomerId, needsUrl });

  // Add User.customerId column if missing (from migration 20231206073509_add_multple_subscriptions)
  if (needsCustomerId) {
    console.log('⚠️  User.customerId column does not exist. Adding it...');

    await client.query(`ALTER TABLE "User" ADD COLUMN "customerId" TEXT`);
    console.log('✅ User.customerId column added successfully');

    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_customerId_key" ON "User"("customerId")`,
    );
    console.log('✅ User.customerId unique constraint added successfully');
  } else {
    console.log('ℹ️  User.customerId column already exists');
  }

  // Add User.url column if missing (from migration 20240227111633_rework_user_profiles)
  if (needsUrl) {
    console.log('⚠️  User.url column does not exist. Adding it...');

    await client.query(`ALTER TABLE "User" ADD COLUMN "url" TEXT`);
    console.log('✅ User.url column added successfully');

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "User_url_key" ON "User"("url")`);
    console.log('✅ User.url unique constraint added successfully');
  } else {
    console.log('ℹ️  User.url column already exists');
  }

  // Verify User columns
  const verifyUserResult = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name IN ('customerId', 'url')
    ORDER BY column_name
  `);

  console.log('🔍 User column verification:', verifyUserResult.rows);
}

async function fixTeamTable(client) {
  console.log('🔧 Checking Team table...');

  // Check if Team table exists first
  const teamTableResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'Team'
  `);

  if (teamTableResult.rows.length === 0) {
    console.log('⚠️  Team table does not exist. Creating it...');

    // Create Team table (from migration 20240205040421_add_teams)
    await client.query(`
      CREATE TABLE "Team" (
        "id" SERIAL NOT NULL,
        "name" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "customerId" TEXT,
        "ownerUserId" INTEGER NOT NULL,

        CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✅ Team table created successfully');

    // Add Team table indexes
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "Team_url_key" ON "Team"("url")`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Team_customerId_key" ON "Team"("customerId")`,
    );
    console.log('✅ Team table indexes added successfully');

    return;
  }

  // Check for missing Team columns
  const teamColumnsResult = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'Team' AND column_name IN ('customerId', 'avatarImageId')
  `);

  const existingTeamColumns = teamColumnsResult.rows.map((row) => row.column_name);
  const needsCustomerId = !existingTeamColumns.includes('customerId');
  const needsAvatarImageId = !existingTeamColumns.includes('avatarImageId');

  console.log('📋 Team column status:', { needsCustomerId, needsAvatarImageId });

  // Add Team.customerId column if missing (from migration 20240205040421_add_teams)
  if (needsCustomerId) {
    console.log('⚠️  Team.customerId column does not exist. Adding it...');

    await client.query(`ALTER TABLE "Team" ADD COLUMN "customerId" TEXT`);
    console.log('✅ Team.customerId column added successfully');

    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Team_customerId_key" ON "Team"("customerId")`,
    );
    console.log('✅ Team.customerId unique constraint added successfully');
  } else {
    console.log('ℹ️  Team.customerId column already exists');
  }

  // Add Team.avatarImageId column if missing (from migration 20240627050809_add_avatar_image_model)
  if (needsAvatarImageId) {
    console.log('⚠️  Team.avatarImageId column does not exist. Adding it...');

    await client.query(`ALTER TABLE "Team" ADD COLUMN "avatarImageId" TEXT`);
    console.log('✅ Team.avatarImageId column added successfully');
  } else {
    console.log('ℹ️  Team.avatarImageId column already exists');
  }

  // Verify Team columns
  const verifyTeamResult = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'Team' AND column_name IN ('customerId', 'avatarImageId')
    ORDER BY column_name
  `);

  console.log('🔍 Team column verification:', verifyTeamResult.rows);
}

if (require.main === module) {
  addMissingColumns();
}

module.exports = { addMissingColumns };
