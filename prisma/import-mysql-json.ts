import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importData() {
  const jsonFilePath = path.join(process.cwd(), 'it_ticketing.json');

  if (!fs.existsSync(jsonFilePath)) {
    console.error(`Error: File not found at ${jsonFilePath}`);
    console.log(`Please export your database from phpMyAdmin in JSON format, name it 'it_ticketing.json', and place it in the server/ directory.`);
    process.exit(1);
  }

  console.log('Reading database export file...');
  const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
  const dbData = JSON.parse(fileContent);

  // Helper to extract array for table from phpMyAdmin JSON structure
  const getTableData = (tableName: string): any[] => {
    if (Array.isArray(dbData)) {
      // Find object matching type === 'table' and name === tableName
      const tableObj = dbData.find(
        (item: any) =>
          item &&
          (item.type === 'table' || item.type === 'table_data' || !item.type) &&
          item.name &&
          item.name.toLowerCase() === tableName.toLowerCase(),
      );
      if (tableObj && Array.isArray(tableObj.data)) {
        return tableObj.data;
      }
    }

    if (dbData && typeof dbData === 'object' && !Array.isArray(dbData)) {
      if (dbData[tableName] && Array.isArray(dbData[tableName])) {
        return dbData[tableName];
      }
      for (const key of Object.keys(dbData)) {
        if (key.toLowerCase() === tableName.toLowerCase() && Array.isArray(dbData[key])) {
          return dbData[key];
        }
      }
    }
    return [];
  };

  // Inspect and log detected keys/tables in json file
  if (Array.isArray(dbData)) {
    const tableNamesFound = dbData
      .filter((item: any) => item && item.name)
      .map((item: any) => `${item.name} (${item.type || 'array'})`);
    console.log(`Found entities in JSON file: ${tableNamesFound.join(', ')}`);
  } else if (dbData && typeof dbData === 'object') {
    console.log(`Found keys in JSON object: ${Object.keys(dbData).join(', ')}`);
  }

  try {
    console.log('--- Starting Data Migration ---');

    // 1. Departments
    const departments = getTableData('departments');
    if (departments.length > 0) {
      console.log(`Importing ${departments.length} departments...`);
      for (const d of departments) {
        await prisma.department.upsert({
          where: { id: Number(d.id) },
          update: { name: d.name, is_active: Boolean(Number(d.is_active)) },
          create: {
            id: Number(d.id),
            name: d.name,
            is_active: Boolean(Number(d.is_active)),
            created_at: d.created_at ? new Date(d.created_at) : new Date(),
          },
        });
      }
    }

    // 2. Users (Pass 1: Create all user accounts without self-referencing foreign keys)
    const users = getTableData('users');
    if (users.length > 0) {
      console.log(`Importing ${users.length} users (Pass 1: User Accounts)...`);
      for (const u of users) {
        await prisma.user.upsert({
          where: { id: Number(u.id) },
          update: {
            name: u.name,
            email: u.email,
            mobile: u.mobile || null,
            password_hash: u.password_hash,
            password_changed: Boolean(Number(u.password_changed)),
            role: u.role as any,
            department_id: u.department_id ? Number(u.department_id) : null,
            reporting_manager_id: null,
            hod_id: null,
            is_active: Boolean(Number(u.is_active)),
          },
          create: {
            id: Number(u.id),
            name: u.name,
            email: u.email,
            mobile: u.mobile || null,
            password_hash: u.password_hash,
            password_changed: Boolean(Number(u.password_changed)),
            role: u.role as any,
            department_id: u.department_id ? Number(u.department_id) : null,
            reporting_manager_id: null,
            hod_id: null,
            is_active: Boolean(Number(u.is_active)),
            created_at: u.created_at ? new Date(u.created_at) : new Date(),
          },
        });
      }

      console.log(`Linking user relations (Pass 2: Managers & HODs)...`);
      for (const u of users) {
        if (u.reporting_manager_id || u.hod_id) {
          await prisma.user.update({
            where: { id: Number(u.id) },
            data: {
              reporting_manager_id: u.reporting_manager_id ? Number(u.reporting_manager_id) : null,
              hod_id: u.hod_id ? Number(u.hod_id) : null,
            },
          });
        }
      }
    }

    // 3. Categories
    const categories = getTableData('categories');
    if (categories.length > 0) {
      console.log(`Importing ${categories.length} categories...`);
      for (const c of categories) {
        await prisma.category.upsert({
          where: { id: Number(c.id) },
          update: {
            department_id: Number(c.department_id),
            name: c.name,
            is_active: Boolean(Number(c.is_active)),
          },
          create: {
            id: Number(c.id),
            department_id: Number(c.department_id),
            name: c.name,
            is_active: Boolean(Number(c.is_active)),
            created_at: c.created_at ? new Date(c.created_at) : new Date(),
          },
        });
      }
    }

    // 4. Subcategories
    const subcategories = getTableData('subcategories');
    if (subcategories.length > 0) {
      console.log(`Importing ${subcategories.length} subcategories...`);
      for (const s of subcategories) {
        await prisma.subcategory.upsert({
          where: { id: Number(s.id) },
          update: {
            category_id: Number(s.category_id),
            name: s.name,
            default_assignee_id: s.default_assignee_id ? Number(s.default_assignee_id) : null,
            tat_hours: Number(s.tat_hours || 24),
            is_active: Boolean(Number(s.is_active)),
          },
          create: {
            id: Number(s.id),
            category_id: Number(s.category_id),
            name: s.name,
            default_assignee_id: s.default_assignee_id ? Number(s.default_assignee_id) : null,
            tat_hours: Number(s.tat_hours || 24),
            is_active: Boolean(Number(s.is_active)),
            created_at: s.created_at ? new Date(s.created_at) : new Date(),
          },
        });
      }
    }

    // 5. Tickets
    const tickets = getTableData('tickets');
    if (tickets.length > 0) {
      console.log(`Importing ${tickets.length} tickets...`);
      for (const t of tickets) {
        await prisma.ticket.upsert({
          where: { id: Number(t.id) },
          update: {
            ticket_no: t.ticket_no,
            user_id: Number(t.user_id),
            department_id: Number(t.department_id),
            category_id: Number(t.category_id),
            subcategory_id: Number(t.subcategory_id),
            priority: t.priority as any,
            subject: t.subject,
            description: t.description,
            assigned_to: t.assigned_to ? Number(t.assigned_to) : null,
            status: t.status as any,
            due_at: t.due_at ? new Date(t.due_at) : new Date(),
            resolved_at: t.resolved_at ? new Date(t.resolved_at) : null,
            escalated_at: t.escalated_at ? new Date(t.escalated_at) : null,
          },
          create: {
            id: Number(t.id),
            ticket_no: t.ticket_no,
            user_id: Number(t.user_id),
            department_id: Number(t.department_id),
            category_id: Number(t.category_id),
            subcategory_id: Number(t.subcategory_id),
            priority: t.priority as any,
            subject: t.subject,
            description: t.description,
            assigned_to: t.assigned_to ? Number(t.assigned_to) : null,
            status: t.status as any,
            due_at: t.due_at ? new Date(t.due_at) : new Date(),
            resolved_at: t.resolved_at ? new Date(t.resolved_at) : null,
            escalated_at: t.escalated_at ? new Date(t.escalated_at) : null,
            created_at: t.created_at ? new Date(t.created_at) : new Date(),
            updated_at: t.updated_at ? new Date(t.updated_at) : new Date(),
          },
        });
      }
    }

    // 6. Ticket Attachments
    const attachments = getTableData('ticket_attachments');
    if (attachments.length > 0) {
      console.log(`Importing ${attachments.length} ticket attachments...`);
      for (const a of attachments) {
        await prisma.ticketAttachment.upsert({
          where: { id: Number(a.id) },
          update: {
            ticket_id: Number(a.ticket_id),
            original_name: a.original_name,
            stored_name: a.stored_name,
            file_size: Number(a.file_size),
          },
          create: {
            id: Number(a.id),
            ticket_id: Number(a.ticket_id),
            original_name: a.original_name,
            stored_name: a.stored_name,
            file_size: Number(a.file_size),
            uploaded_at: a.uploaded_at ? new Date(a.uploaded_at) : new Date(),
          },
        });
      }
    }

    // 7. Ticket Logs
    const logs = getTableData('ticket_logs');
    if (logs.length > 0) {
      console.log(`Importing ${logs.length} ticket logs...`);
      for (const l of logs) {
        let detailsJson: any = null;
        if (l.details) {
          try {
            detailsJson = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
          } catch {
            detailsJson = { message: l.details };
          }
        }
        await prisma.ticketLog.upsert({
          where: { id: Number(l.id) },
          update: {
            ticket_id: Number(l.ticket_id),
            user_id: Number(l.user_id),
            action: l.action,
            details: detailsJson,
          },
          create: {
            id: Number(l.id),
            ticket_id: Number(l.ticket_id),
            user_id: Number(l.user_id),
            action: l.action,
            details: detailsJson,
            created_at: l.created_at ? new Date(l.created_at) : new Date(),
          },
        });
      }
    }

    // Reset sequences in PostgreSQL
    console.log('Resetting PostgreSQL auto-increment sequences...');
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Department"', 'id'), coalesce(max(id), 1)) FROM "Department";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Category"', 'id'), coalesce(max(id), 1)) FROM "Category";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Subcategory"', 'id'), coalesce(max(id), 1)) FROM "Subcategory";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 1)) FROM "User";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Ticket"', 'id'), coalesce(max(id), 1)) FROM "Ticket";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"TicketAttachment"', 'id'), coalesce(max(id), 1)) FROM "TicketAttachment";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"TicketLog"', 'id'), coalesce(max(id), 1)) FROM "TicketLog";`);

    console.log('🎉 Migration Completed Successfully! All data imported to PostgreSQL.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
