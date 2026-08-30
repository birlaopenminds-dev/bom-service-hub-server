import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function testUserLogin() {
  const emailInput = process.argv[2];
  const passwordInput = process.argv[3];

  if (!emailInput || !passwordInput) {
    console.log('Usage: npx ts-node prisma/test-login-hash.ts <email> <password>');
    console.log('Example: npx ts-node prisma/test-login-hash.ts it.support@birlaopenminds.com Welcome@123');
    process.exit(1);
  }

  const cleanEmail = emailInput.trim().toLowerCase();
  console.log(`\n🔍 Searching for user with email: "${cleanEmail}"...`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  });

  if (!user) {
    console.error(`❌ USER NOT FOUND in PostgreSQL database!`);
    console.log(`Searching for similar emails...`);
    const allUsers = await prisma.user.findMany({ select: { email: true }, take: 10 });
    console.log(`Sample emails in database:`, allUsers.map((u) => u.email));
    process.exit(1);
  }

  console.log(`✅ User Found!`);
  console.log(`   - ID: ${user.id}`);
  console.log(`   - Exact Email in DB: "${user.email}"`);
  console.log(`   - Is Active: ${user.is_active}`);
  console.log(`   - Password Hash in DB: "${user.password_hash}"`);
  console.log(`   - Hash Length: ${user.password_hash.length}`);

  if (!user.is_active) {
    console.error(`❌ USER ACCOUNT IS INACTIVE (is_active = false/0)`);
  }

  console.log(`\n--- Testing Password Matching Algorithms ---`);

  // 1. Direct Bcrypt Compare
  try {
    const isBcryptMatch = await bcrypt.compare(passwordInput, user.password_hash);
    console.log(`   1. Standard Bcrypt Compare: ${isBcryptMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
  } catch (e: any) {
    console.log(`   1. Standard Bcrypt Compare Error: ${e.message}`);
  }

  // 2. MD5 Compare
  const md5Hash = crypto.createHash('md5').update(passwordInput).digest('hex');
  console.log(`   2. MD5 Hash of input: "${md5Hash}"`);
  console.log(`      MD5 Match: ${md5Hash.toLowerCase() === user.password_hash.toLowerCase() ? '✅ MATCH' : '❌ NO MATCH'}`);

  // 3. SHA1 Compare
  const sha1Hash = crypto.createHash('sha1').update(passwordInput).digest('hex');
  console.log(`   3. SHA1 Hash of input: "${sha1Hash}"`);
  console.log(`      SHA1 Match: ${sha1Hash.toLowerCase() === user.password_hash.toLowerCase() ? '✅ MATCH' : '❌ NO MATCH'}`);

  // 4. Plaintext Compare
  console.log(`   4. Plaintext Match: ${passwordInput === user.password_hash ? '✅ MATCH' : '❌ NO MATCH'}`);
}

testUserLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
