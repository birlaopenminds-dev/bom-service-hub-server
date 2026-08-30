import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    take: 10,
    select: {
      id: true,
      email: true,
      name: true,
      password_hash: true,
      is_active: true,
      role: true,
    },
  });

  console.log(`--- Found ${users.length} sample users in PostgreSQL ---`);
  users.forEach((u) => {
    console.log({
      id: u.id,
      email: u.email,
      name: u.name,
      hashLength: u.password_hash ? u.password_hash.length : 0,
      hashPrefix: u.password_hash ? u.password_hash.substring(0, 10) : 'NULL',
      hashFull: u.password_hash,
      is_active: u.is_active,
    });
  });
}

checkUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
