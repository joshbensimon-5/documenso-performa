#!/usr/bin/env node

// Comprehensive Database Migration Script
// This script replicates all essential migrations to ensure database schema consistency
// It will create missing tables and add missing columns to match the Prisma schema

const { Client } = require('pg');

async function comprehensiveDatabaseMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_PRIVATE_URL || process.env.NEXT_PRIVATE_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Create all required ENUMs first
    await createEnums(client);

    // Create and fix all core tables
    await ensureUserTable(client);
    await ensureAccountTable(client);
    await ensureSessionTable(client);
    await ensureTeamTables(client);
    await ensureDocumentTables(client);
    await ensureSubscriptionTable(client);
    await ensureOtherEssentialTables(client);

    // Add indexes for performance
    await addEssentialIndexes(client);

    console.log('✅ Comprehensive database migration completed successfully');
  } catch (error) {
    console.error('❌ Error during database migration:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function createEnums(client) {
  console.log('📋 Creating/checking ENUMs...');

  const enums = [
    `CREATE TYPE "IdentityProvider" AS ENUM ('DOCUMENSO', 'GOOGLE')`,
    `CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER')`,
    `CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'REJECTED')`,
    `CREATE TYPE "DocumentSource" AS ENUM ('DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_LINK')`,
    `CREATE TYPE "DocumentVisibility" AS ENUM ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')`,
    `CREATE TYPE "ReadStatus" AS ENUM ('NOT_OPENED', 'OPENED')`,
    `CREATE TYPE "SendStatus" AS ENUM ('NOT_SENT', 'SENT')`,
    `CREATE TYPE "SigningStatus" AS ENUM ('NOT_SIGNED', 'SIGNED')`,
    `CREATE TYPE "RecipientRole" AS ENUM ('SIGNER', 'VIEWER', 'APPROVER', 'CC', 'ASSISTANT')`,
    `CREATE TYPE "FieldType" AS ENUM ('SIGNATURE', 'FREE_SIGNATURE', 'DATE', 'TEXT', 'EMAIL', 'NAME', 'NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN', 'INITIALS')`,
    `CREATE TYPE "TeamMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER')`,
    `CREATE TYPE "TeamMemberInviteStatus" AS ENUM ('ACCEPTED', 'PENDING')`,
    `CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'INACTIVE')`,
    `CREATE TYPE "TemplateType" AS ENUM ('PUBLIC', 'PRIVATE')`,
    `CREATE TYPE "DocumentDataType" AS ENUM ('S3_PATH', 'BYTES', 'BYTES_64')`,
    `CREATE TYPE "DocumentSigningOrder" AS ENUM ('PARALLEL', 'SEQUENTIAL')`,
    `CREATE TYPE "DocumentDistributionMethod" AS ENUM ('EMAIL', 'NONE')`,
    `CREATE TYPE "ApiTokenAlgorithm" AS ENUM ('SHA512')`,
    `CREATE TYPE "WebhookTriggerEvents" AS ENUM ('DOCUMENT_CREATED', 'DOCUMENT_SENT', 'DOCUMENT_OPENED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED', 'DOCUMENT_REJECTED', 'DOCUMENT_CANCELLED')`,
    `CREATE TYPE "WebhookCallStatus" AS ENUM ('SUCCESS', 'FAILED')`,
    `CREATE TYPE "UserSecurityAuditLogType" AS ENUM ('ACCOUNT_PROFILE_UPDATE', 'ACCOUNT_SSO_LINK', 'AUTH_2FA_DISABLE', 'AUTH_2FA_ENABLE', 'PASSKEY_CREATED', 'PASSKEY_DELETED', 'PASSKEY_UPDATED', 'PASSWORD_RESET', 'PASSWORD_UPDATE', 'SIGN_OUT', 'SIGN_IN', 'SIGN_IN_FAIL', 'SIGN_IN_2FA_FAIL', 'SIGN_IN_PASSKEY_FAIL')`,
    `CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`,
    `CREATE TYPE "BackgroundJobTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`,
    `CREATE TYPE "FolderType" AS ENUM ('DOCUMENT', 'TEMPLATE')`,
  ];

  for (const enumSQL of enums) {
    try {
      await client.query(enumSQL);
      console.log(`✅ Created enum: ${enumSQL.split('"')[1]}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Enum already exists: ${enumSQL.split('"')[1]}`);
      } else {
        console.error(`❌ Error creating enum:`, error.message);
      }
    }
  }
}

async function ensureUserTable(client) {
  console.log('👤 Ensuring User table is complete...');

  // Create User table if it doesn't exist
  const createUserTable = `
    CREATE TABLE IF NOT EXISTS "User" (
      "id" SERIAL NOT NULL,
      "name" TEXT,
      "customerId" TEXT,
      "email" TEXT NOT NULL,
      "emailVerified" TIMESTAMP(3),
      "password" TEXT,
      "source" TEXT,
      "signature" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSignedIn" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',
      "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[],
      "identityProvider" "IdentityProvider" NOT NULL DEFAULT 'DOCUMENSO',
      "avatarImageId" TEXT,
      "disabled" BOOLEAN NOT NULL DEFAULT false,
      "twoFactorSecret" TEXT,
      "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
      "twoFactorBackupCodes" TEXT,
      "url" TEXT,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    );`;

  await client.query(createUserTable);
  console.log('✅ User table created/verified');

  // Add missing columns to User table
  const userColumns = [
    { name: 'customerId', sql: 'ALTER TABLE "User" ADD COLUMN "customerId" TEXT' },
    { name: 'url', sql: 'ALTER TABLE "User" ADD COLUMN "url" TEXT' },
    { name: 'signature', sql: 'ALTER TABLE "User" ADD COLUMN "signature" TEXT' },
    {
      name: 'createdAt',
      sql: 'ALTER TABLE "User" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    {
      name: 'updatedAt',
      sql: 'ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    {
      name: 'lastSignedIn',
      sql: 'ALTER TABLE "User" ADD COLUMN "lastSignedIn" TIMESTAMP(3) NOT NULL DEFAULT \'1970-01-01 00:00:00 +00:00\'',
    },
    {
      name: 'roles',
      sql: 'ALTER TABLE "User" ADD COLUMN "roles" "Role"[] DEFAULT ARRAY[\'USER\']::"Role"[]',
    },
    { name: 'twoFactorSecret', sql: 'ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT' },
    {
      name: 'twoFactorEnabled',
      sql: 'ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false',
    },
    {
      name: 'twoFactorBackupCodes',
      sql: 'ALTER TABLE "User" ADD COLUMN "twoFactorBackupCodes" TEXT',
    },
    { name: 'avatarImageId', sql: 'ALTER TABLE "User" ADD COLUMN "avatarImageId" TEXT' },
    {
      name: 'disabled',
      sql: 'ALTER TABLE "User" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false',
    },
  ];

  for (const column of userColumns) {
    try {
      const checkResult = await client.query(
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = $1
      `,
        [column.name],
      );

      if (checkResult.rows.length === 0) {
        await client.query(column.sql);
        console.log(`✅ Added User.${column.name} column`);
      } else {
        console.log(`⚠️  User.${column.name} already exists`);
      }
    } catch (error) {
      console.error(`❌ Error adding User.${column.name}:`, error.message);
    }
  }

  // Add unique constraints
  const userConstraints = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_customerId_key" ON "User"("customerId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_url_key" ON "User"("url")',
    'CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email")',
  ];

  for (const constraint of userConstraints) {
    try {
      await client.query(constraint);
      console.log(`✅ User constraint: ${constraint.split('"')[1]}`);
    } catch (error) {
      console.error(`❌ Error creating User constraint:`, error.message);
    }
  }
}

async function ensureAccountTable(client) {
  console.log('🔐 Ensuring Account table...');

  const createAccountTable = `
    CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL,
      "userId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "created_at" INTEGER,
      "ext_expires_in" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      "password" TEXT,
      CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
    );`;

  await client.query(createAccountTable);

  const accountConstraints = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId")',
  ];

  for (const constraint of accountConstraints) {
    try {
      await client.query(constraint);
    } catch (error) {
      console.error(`❌ Error creating Account constraint:`, error.message);
    }
  }

  console.log('✅ Account table created/verified');
}

async function ensureSessionTable(client) {
  console.log('📱 Ensuring Session table...');

  const createSessionTable = `
    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL,
      "sessionToken" TEXT NOT NULL,
      "userId" INTEGER NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
    );`;

  await client.query(createSessionTable);

  const sessionConstraints = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken")',
  ];

  for (const constraint of sessionConstraints) {
    try {
      await client.query(constraint);
    } catch (error) {
      console.error(`❌ Error creating Session constraint:`, error.message);
    }
  }

  console.log('✅ Session table created/verified');
}

async function ensureTeamTables(client) {
  console.log('👥 Ensuring Team tables...');

  // Create Team table with all required columns
  const createTeamTable = `
    CREATE TABLE IF NOT EXISTS "Team" (
      "id" SERIAL NOT NULL,
      "name" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "avatarImageId" TEXT,
      "customerId" TEXT,
      "ownerUserId" INTEGER NOT NULL,
      CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
    );`;

  await client.query(createTeamTable);
  console.log('✅ Team table created/verified');

  // Add missing columns to Team table
  const teamColumns = [
    { name: 'customerId', sql: 'ALTER TABLE "Team" ADD COLUMN "customerId" TEXT' },
    {
      name: 'ownerUserId',
      sql: 'ALTER TABLE "Team" ADD COLUMN "ownerUserId" INTEGER NOT NULL DEFAULT 1',
    },
    { name: 'avatarImageId', sql: 'ALTER TABLE "Team" ADD COLUMN "avatarImageId" TEXT' },
  ];

  for (const column of teamColumns) {
    try {
      const checkResult = await client.query(
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Team' AND column_name = $1
      `,
        [column.name],
      );

      if (checkResult.rows.length === 0) {
        await client.query(column.sql);
        console.log(`✅ Added Team.${column.name} column`);
      } else {
        console.log(`⚠️  Team.${column.name} already exists`);
      }
    } catch (error) {
      console.error(`❌ Error adding Team.${column.name}:`, error.message);
    }
  }

  // Create related team tables
  const teamRelatedTables = [
    `CREATE TABLE IF NOT EXISTS "TeamMember" (
      "id" SERIAL NOT NULL,
      "teamId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "role" "TeamMemberRole" NOT NULL,
      "userId" INTEGER NOT NULL,
      CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "TeamEmail" (
      "teamId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      CONSTRAINT "TeamEmail_pkey" PRIMARY KEY ("teamId")
    )`,
    `CREATE TABLE IF NOT EXISTS "TeamMemberInvite" (
      "id" SERIAL NOT NULL,
      "teamId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "email" TEXT NOT NULL,
      "status" "TeamMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
      "role" "TeamMemberRole" NOT NULL,
      "token" TEXT NOT NULL,
      CONSTRAINT "TeamMemberInvite_pkey" PRIMARY KEY ("id")
    )`,
  ];

  for (const tableSQL of teamRelatedTables) {
    try {
      await client.query(tableSQL);
      console.log(`✅ Team related table created`);
    } catch (error) {
      console.error(`❌ Error creating team table:`, error.message);
    }
  }

  // Add Team constraints
  const teamConstraints = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "Team_url_key" ON "Team"("url")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Team_customerId_key" ON "Team"("customerId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "TeamEmail_email_key" ON "TeamEmail"("email")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "TeamMemberInvite_token_key" ON "TeamMemberInvite"("token")',
  ];

  for (const constraint of teamConstraints) {
    try {
      await client.query(constraint);
    } catch (error) {
      console.error(`❌ Error creating Team constraint:`, error.message);
    }
  }
}

async function ensureDocumentTables(client) {
  console.log('📄 Ensuring Document tables...');

  const documentTables = [
    `CREATE TABLE IF NOT EXISTS "Document" (
      "id" SERIAL NOT NULL,
      "userId" INTEGER NOT NULL,
      "teamId" INTEGER,
      "title" TEXT NOT NULL,
      "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
      "document" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "source" "DocumentSource" NOT NULL DEFAULT 'DOCUMENT',
      "templateId" INTEGER,
      "visibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
      "authOptions" JSONB,
      "externalId" TEXT,
      "folderId" TEXT,
      CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "DocumentData" (
      "id" TEXT NOT NULL,
      "type" "DocumentDataType" NOT NULL,
      "data" TEXT NOT NULL,
      "initialData" TEXT NOT NULL,
      "documentId" INTEGER NOT NULL,
      CONSTRAINT "DocumentData_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "Recipient" (
      "id" SERIAL NOT NULL,
      "documentId" INTEGER,
      "templateId" INTEGER,
      "email" VARCHAR(255) NOT NULL,
      "name" VARCHAR(255) NOT NULL DEFAULT '',
      "token" TEXT NOT NULL,
      "expired" TIMESTAMP(3),
      "readStatus" "ReadStatus" NOT NULL DEFAULT 'NOT_OPENED',
      "signingStatus" "SigningStatus" NOT NULL DEFAULT 'NOT_SIGNED',
      "sendStatus" "SendStatus" NOT NULL DEFAULT 'NOT_SENT',
      "role" "RecipientRole" NOT NULL DEFAULT 'SIGNER',
      "rejectionReason" TEXT,
      "signingOrder" INTEGER,
      "authOptions" JSONB,
      CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "Field" (
      "id" SERIAL NOT NULL,
      "secondaryId" TEXT NOT NULL,
      "documentId" INTEGER,
      "templateId" INTEGER,
      "recipientId" INTEGER,
      "type" "FieldType" NOT NULL,
      "page" INTEGER NOT NULL,
      "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "width" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "height" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "customText" TEXT NOT NULL,
      "inserted" BOOLEAN NOT NULL,
      "fieldMeta" JSONB,
      "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "Signature" (
      "id" SERIAL NOT NULL,
      "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "recipientId" INTEGER NOT NULL,
      "fieldId" INTEGER NOT NULL,
      "signatureImageAsBase64" TEXT,
      "typedSignature" TEXT,
      CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
    )`,
  ];

  for (const tableSQL of documentTables) {
    try {
      await client.query(tableSQL);
      console.log(`✅ Document table created`);
    } catch (error) {
      console.error(`❌ Error creating document table:`, error.message);
    }
  }
}

async function ensureSubscriptionTable(client) {
  console.log('💳 Ensuring Subscription table...');

  const createSubscriptionTable = `
    CREATE TABLE IF NOT EXISTS "Subscription" (
      "id" SERIAL NOT NULL,
      "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
      "planId" TEXT NOT NULL,
      "priceId" TEXT NOT NULL,
      "periodEnd" TIMESTAMP(3),
      "userId" INTEGER,
      "teamId" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
    );`;

  await client.query(createSubscriptionTable);

  const subscriptionConstraints = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_planId_key" ON "Subscription"("planId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_teamId_key" ON "Subscription"("teamId")',
    'CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId")',
  ];

  for (const constraint of subscriptionConstraints) {
    try {
      await client.query(constraint);
    } catch (error) {
      console.error(`❌ Error creating Subscription constraint:`, error.message);
    }
  }

  console.log('✅ Subscription table created/verified');
}

async function ensureOtherEssentialTables(client) {
  console.log('🔧 Ensuring other essential tables...');

  const otherTables = [
    `CREATE TABLE IF NOT EXISTS "Template" (
      "id" SERIAL NOT NULL,
      "externalId" TEXT,
      "type" "TemplateType" NOT NULL DEFAULT 'PRIVATE',
      "title" TEXT NOT NULL,
      "userId" INTEGER NOT NULL,
      "teamId" INTEGER,
      "visibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
      "authOptions" JSONB,
      "templateDocumentDataId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "publicTitle" TEXT NOT NULL DEFAULT '',
      "publicDescription" TEXT NOT NULL DEFAULT '',
      "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT false,
      "folderId" TEXT,
      CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "VerificationToken" (
      "id" SERIAL NOT NULL,
      "secondaryId" TEXT NOT NULL,
      "identifier" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "completed" BOOLEAN NOT NULL DEFAULT false,
      "expires" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" INTEGER NOT NULL,
      CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "ApiToken" (
      "id" SERIAL NOT NULL,
      "name" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "algorithm" "ApiTokenAlgorithm" NOT NULL DEFAULT 'SHA512',
      "expires" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" INTEGER,
      "teamId" INTEGER,
      CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "Webhook" (
      "id" TEXT NOT NULL,
      "webhookUrl" TEXT NOT NULL,
      "eventTriggers" "WebhookTriggerEvents"[],
      "secret" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" INTEGER NOT NULL,
      "teamId" INTEGER,
      CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
    )`,
  ];

  for (const tableSQL of otherTables) {
    try {
      await client.query(tableSQL);
      console.log(`✅ Essential table created`);
    } catch (error) {
      console.error(`❌ Error creating essential table:`, error.message);
    }
  }
}

async function addEssentialIndexes(client) {
  console.log('📊 Adding essential indexes...');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS "Document_userId_idx" ON "Document"("userId")',
    'CREATE INDEX IF NOT EXISTS "Document_status_idx" ON "Document"("status")',
    'CREATE INDEX IF NOT EXISTS "Field_documentId_idx" ON "Field"("documentId")',
    'CREATE INDEX IF NOT EXISTS "Field_recipientId_idx" ON "Field"("recipientId")',
    'CREATE INDEX IF NOT EXISTS "Recipient_documentId_idx" ON "Recipient"("documentId")',
    'CREATE INDEX IF NOT EXISTS "Recipient_token_idx" ON "Recipient"("token")',
    'CREATE INDEX IF NOT EXISTS "Signature_recipientId_idx" ON "Signature"("recipientId")',
  ];

  for (const indexSQL of indexes) {
    try {
      await client.query(indexSQL);
    } catch (error) {
      console.error(`❌ Error creating index:`, error.message);
    }
  }

  console.log('✅ Essential indexes created');
}

// Run the migration
if (require.main === module) {
  comprehensiveDatabaseMigration()
    .then(() => {
      console.log('🎉 Database migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database migration failed:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveDatabaseMigration };
