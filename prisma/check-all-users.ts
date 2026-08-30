import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function checkAllUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      password_hash: true,
      password_changed: true,
      is_active: true,
    },
  });

  console.log(`Total users in DB: ${users.length}`);

  let defaultWelcomeCount = 0;
  let customPasswordCount = 0;

  for (const u of users) {
    const isWelcomeMatch = await bcrypt.compare('Welcome@123', u.password_hash);
    if (isWelcomeMatch) {
      defaultWelcomeCount++;
    } else {
      customPasswordCount++;
      if (customPasswordCount <= 5) {
        console.log(`Sample user with custom password: ID ${u.id} | Email: ${u.email} | Hash: ${u.password_hash.substring(0, 20)}...`);
      }
    }
  }

  console.log(`\n--- Password Analysis Summary ---`);
  console.log(`Users with default password 'Welcome@123': ${defaultWelcomeCount}`);
  console.log(`Users with custom changed passwords: ${customPasswordCount}`);
}

checkAllUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
