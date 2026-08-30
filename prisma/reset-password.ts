import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('Usage: npx ts-node prisma/reset-password.ts <email> <newPassword>');
    console.log('Example: npx ts-node prisma/reset-password.ts user@birlaopenminds.com Welcome@123');
    process.exit(1);
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  });

  if (!user) {
    console.error(`User with email "${cleanEmail}" not found in database!`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
      is_active: true,
    },
  });

  console.log(`✅ Successfully updated password for user "${user.email}" (ID: ${user.id}).`);
}

resetPassword()
  .catch((e) => {
    console.error('Error resetting password:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
