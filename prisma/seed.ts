import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BOM ServiceHub Database...');

  // Password hash for seed users: Welcome@123
  const passwordHash = await bcrypt.hash('Welcome@123', 12);

  // ----------------------------------------------------
  // 1. Create / Upsert Departments
  // ----------------------------------------------------
  const itDept = await prisma.department.upsert({
    where: { name: 'Information Technology' },
    update: { is_active: true },
    create: {
      name: 'Information Technology',
      is_active: true,
    },
  });

  const marketingDept = await prisma.department.upsert({
    where: { name: 'Marketing' },
    update: { is_active: true },
    create: {
      name: 'Marketing',
      is_active: true,
    },
  });

  console.log('Departments created:', [itDept.name, marketingDept.name]);

  // ----------------------------------------------------
  // 2. Create / Upsert Super Admin User
  // ----------------------------------------------------
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'it.support@birlaopenminds.com' },
    update: {
      name: 'Super Admin',
      role: (Role as any).super_admin || 'super_admin',
      department_id: itDept.id,
      is_active: true,
    },
    create: {
      name: 'Super Admin',
      email: 'it.support@birlaopenminds.com',
      mobile: '+919999999999',
      password_hash: passwordHash,
      password_changed: true,
      role: (Role as any).super_admin || 'super_admin',
      department_id: itDept.id,
      is_active: true,
    },
  });

  console.log('Super Admin user created:', superAdminUser.email);

  // ----------------------------------------------------
  // 3. Create / Upsert Categories
  // ----------------------------------------------------

  // Categories under Information Technology
  const lmsCategory = await prisma.category.upsert({
    where: {
      department_id_name: {
        department_id: itDept.id,
        name: 'Birla Smart Path LMS',
      },
    },
    update: { is_active: true },
    create: {
      name: 'Birla Smart Path LMS',
      department_id: itDept.id,
      is_active: true,
    },
  });

  const emailSupportCategory = await prisma.category.upsert({
    where: {
      department_id_name: {
        department_id: itDept.id,
        name: 'Email Support',
      },
    },
    update: { is_active: true },
    create: {
      name: 'Email Support',
      department_id: itDept.id,
      is_active: true,
    },
  });

  const bomServiceHubCategory = await prisma.category.upsert({
    where: {
      department_id_name: {
        department_id: itDept.id,
        name: 'BOM ServiceHUB',
      },
    },
    update: { is_active: true },
    create: {
      name: 'BOM ServiceHUB',
      department_id: itDept.id,
      is_active: true,
    },
  });

  // Categories under Marketing
  const blogImageCat = await prisma.category.upsert({
    where: {
      department_id_name: {
        department_id: marketingDept.id,
        name: 'Blog Image Generation',
      },
    },
    update: { is_active: true },
    create: {
      name: 'Blog Image Generation',
      department_id: marketingDept.id,
      is_active: true,
    },
  });

  const logoGenCat = await prisma.category.upsert({
    where: {
      department_id_name: {
        department_id: marketingDept.id,
        name: 'Logo Generation',
      },
    },
    update: { is_active: true },
    create: {
      name: 'Logo Generation',
      department_id: marketingDept.id,
      is_active: true,
    },
  });

  const socialMediaCat = await prisma.category.upsert({
    where: {
      department_id_name: {
        department_id: marketingDept.id,
        name: 'Social Media Post',
      },
    },
    update: { is_active: true },
    create: {
      name: 'Social Media Post',
      department_id: marketingDept.id,
      is_active: true,
    },
  });

  console.log('Categories created successfully.');

  // ----------------------------------------------------
  // 4. Create / Upsert Sub-Categories
  // ----------------------------------------------------
  const subcategoriesData = [
    // --- Marketing -> Blog Image Generation ---
    {
      categoryId: blogImageCat.id,
      name: 'Generate Thumbnail',
      tatHours: 24,
    },
    {
      categoryId: blogImageCat.id,
      name: 'Generate Hero Banner',
      tatHours: 24,
    },
    {
      categoryId: blogImageCat.id,
      name: 'Generate Internal Blog Images',
      tatHours: 24,
    },

    // --- Marketing -> Logo Generation ---
    {
      categoryId: logoGenCat.id,
      name: 'Generate K12 Logo',
      tatHours: 48,
    },
    {
      categoryId: logoGenCat.id,
      name: 'Generate PreSchool Logo',
      tatHours: 48,
    },

    // --- Marketing -> Social Media Post ---
    {
      categoryId: socialMediaCat.id,
      name: 'Create Generic Posts',
      tatHours: 24,
    },
    {
      categoryId: socialMediaCat.id,
      name: 'Create Special Event Posts',
      tatHours: 24,
    },
    {
      categoryId: socialMediaCat.id,
      name: 'Admission Open Post',
      tatHours: 24,
    },

    // --- Information Technology -> Birla Smart Path LMS ---
    {
      categoryId: lmsCategory.id,
      name: 'Content Not Visible',
      tatHours: 12,
    },
    {
      categoryId: lmsCategory.id,
      name: 'New School Creation / Teachers / Student Logins',
      tatHours: 24,
    },
    {
      categoryId: lmsCategory.id,
      name: 'LMS Issue / Clarification Required',
      tatHours: 24,
    },

    // --- Information Technology -> BOM ServiceHUB ---
    {
      categoryId: bomServiceHubCategory.id,
      name: 'New Category Creation',
      tatHours: 24,
    },
    {
      categoryId: bomServiceHubCategory.id,
      name: 'New Sub-Category Creation',
      tatHours: 24,
    },
    {
      categoryId: bomServiceHubCategory.id,
      name: 'New User Creation',
      tatHours: 12,
    },

    // --- Information Technology -> Email Support ---
    {
      categoryId: emailSupportCategory.id,
      name: 'Email Access Support',
      tatHours: 12,
    },
    {
      categoryId: emailSupportCategory.id,
      name: 'Create Email',
      tatHours: 12,
    },
    {
      categoryId: emailSupportCategory.id,
      name: 'Email Password Reset',
      tatHours: 6,
    },
  ];

  for (const sub of subcategoriesData) {
    await prisma.subcategory.upsert({
      where: {
        category_id_name: {
          category_id: sub.categoryId,
          name: sub.name,
        },
      },
      update: {
        tat_hours: sub.tatHours,
        is_active: true,
      },
      create: {
        category_id: sub.categoryId,
        name: sub.name,
        tat_hours: sub.tatHours,
        is_active: true,
      },
    });
  }

  console.log(`Successfully seeded ${subcategoriesData.length} sub-categories.`);
  console.log('Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
