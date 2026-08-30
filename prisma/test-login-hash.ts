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

  // 1. Standard Bcrypt Compare
  try {
    const isBcryptMatch = await bcrypt.compare(passwordInput, user.password_hash);
    console.log(`   1. Standard Bcrypt Compare ($2y$): ${isBcryptMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

    if (!isBcryptMatch && user.password_hash.startsWith('$2y$')) {
      const hash2a = user.password_hash.replace(/^\$2y\$/, '$2a$');
      const is2aMatch = await bcrypt.compare(passwordInput, hash2a);
      console.log(`      Bcrypt Compare with $2a$ prefix: ${is2aMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

      const hash2b = user.password_hash.replace(/^\$2y\$/, '$2b$');
      const is2bMatch = await bcrypt.compare(passwordInput, hash2b);
      console.log(`      Bcrypt Compare with $2b$ prefix: ${is2bMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    }
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

  // 5. Test Common Default Passwords
  console.log(`\n--- Testing Common Default Passwords against DB Hash ---`);
  const commonPasswords = [
    'Welcome@123',
    'welcome@123',
    'Welcome@1234',
    'Welcome123',
    'welcome123',
    'Welcome@1',
    'Admin@123',
    'admin@123',
    'Password@123',
    'password',
    '123456',
    'Birla@123',
    'birla123',
    'Swapnil@123',
    'swapnil123',
  ];

  let foundMatch = false;
  for (const common of commonPasswords) {
    if (await bcrypt.compare(common, user.password_hash)) {
      console.log(`🎉 FOUND EXACT MATCHING PASSWORD IN DB: "${common}"`);
      foundMatch = true;
      break;
    }
  }

  if (!foundMatch) {
    console.log(`   None of the common default passwords matched. The hash requires the user's specific password.`);
  }
}

testUserLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
