import { PrismaClient, Role, Priority, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BOM ServiceHub Database...');

  // Password hash for all initial seed users: Welcome@123
  const passwordHash = await bcrypt.hash('Welcome@123', 12);
  const now = new Date();

  // ----------------------------------------------------
  // 1. Create / Upsert Departments
  // ----------------------------------------------------
  const itDept = await prisma.department.upsert({
    where: { name: 'Information Technology' },
    update: {},
    create: {
      name: 'Information Technology',
      is_active: true,
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: 'Human Resources' },
    update: {},
    create: {
      name: 'Human Resources',
      is_active: true,
    },
  });

  const opsDept = await prisma.department.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      name: 'Operations',
      is_active: false,
    },
  });

  const financeDept = await prisma.department.upsert({
    where: { name: 'Finance' },
    update: {},
    create: {
      name: 'Finance',
      is_active: true,
    },
  });

  const facilitiesDept = await prisma.department.upsert({
    where: { name: 'Facilities & Maintenance' },
    update: {},
    create: {
      name: 'Facilities & Maintenance',
      is_active: true,
    },
  });

  const marketingDept = await prisma.department.upsert({
    where: { name: 'Marketing & Communications' },
    update: {},
    create: {
      name: 'Marketing & Communications',
      is_active: true,
    },
  });

  console.log('Departments created:', [
    itDept.name,
    hrDept.name,
    opsDept.name,
    financeDept.name,
    facilitiesDept.name,
    marketingDept.name,
  ]);

  // ----------------------------------------------------
  // 2. Create / Upsert Users (Super Admin, Admins, Managers, Users)
  // ----------------------------------------------------
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Global Super Admin',
      email: 'superadmin@birlaopenminds.com',
      mobile: '+1234567899',
      password_hash: passwordHash,
      password_changed: true,
      role: (Role as any).super_admin || 'super_admin',
      department_id: itDept.id,
      is_active: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@birlaopenminds.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@birlaopenminds.com',
      mobile: '+1234567890',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.admin,
      department_id: itDept.id,
      is_active: true,
    },
  });

  const itHod = await prisma.user.upsert({
    where: { email: 'mahesh.g@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Mahesh Gurav',
      email: 'mahesh.g@birlaopenminds.com',
      mobile: '+1234567891',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.manager,
      department_id: itDept.id,
      is_active: true,
    },
  });

  const itEngineer = await prisma.user.upsert({
    where: { email: 'john.d@birlaopenminds.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john.d@birlaopenminds.com',
      mobile: '+1234567892',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.user,
      department_id: itDept.id,
      reporting_manager_id: itHod.id,
      hod_id: itHod.id,
      is_active: true,
    },
  });

  const itSpecialist = await prisma.user.upsert({
    where: { email: 'suresh.n@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Suresh Nair',
      email: 'suresh.n@birlaopenminds.com',
      mobile: '+1234567894',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.user,
      department_id: itDept.id,
      reporting_manager_id: itHod.id,
      hod_id: itHod.id,
      is_active: true,
    },
  });

  const hrManager = await prisma.user.upsert({
    where: { email: 'priya.s@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'priya.s@birlaopenminds.com',
      mobile: '+1234567895',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.manager,
      department_id: hrDept.id,
      is_active: true,
    },
  });

  const generalUser = await prisma.user.upsert({
    where: { email: 'swapnil.zakade@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Swapnil Zakade',
      email: 'swapnil.zakade@birlaopenminds.com',
      mobile: '+1234567893',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.user,
      department_id: hrDept.id,
      reporting_manager_id: hrManager.id,
      hod_id: hrManager.id,
      is_active: true,
    },
  });

  const financeUser = await prisma.user.upsert({
    where: { email: 'rahul.v@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Rahul Verma',
      email: 'rahul.v@birlaopenminds.com',
      mobile: '+1234567896',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.user,
      department_id: financeDept.id,
      is_active: true,
    },
  });

  const facilitiesManager = await prisma.user.upsert({
    where: { email: 'anita.k@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Anita Kulkarni',
      email: 'anita.k@birlaopenminds.com',
      mobile: '+1234567897',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.manager,
      department_id: facilitiesDept.id,
      is_active: true,
    },
  });

  const marketingUser = await prisma.user.upsert({
    where: { email: 'vikram.r@birlaopenminds.com' },
    update: {},
    create: {
      name: 'Vikram Rao',
      email: 'vikram.r@birlaopenminds.com',
      mobile: '+1234567898',
      password_hash: passwordHash,
      password_changed: true,
      role: Role.user,
      department_id: marketingDept.id,
      is_active: true,
    },
  });

  console.log('Users created:', [
    superAdminUser.email,
    adminUser.email,
    itHod.email,
    itEngineer.email,
    itSpecialist.email,
    hrManager.email,
    generalUser.email,
    financeUser.email,
    facilitiesManager.email,
    marketingUser.email,
  ]);

  // ----------------------------------------------------
  // 3. Create / Upsert Categories
  // ----------------------------------------------------
  const hardwareCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: itDept.id, name: 'Hardware Issues' },
    },
    update: {},
    create: { department_id: itDept.id, name: 'Hardware Issues', is_active: true },
  });

  const softwareCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: itDept.id, name: 'Software Request' },
    },
    update: {},
    create: { department_id: itDept.id, name: 'Software Request', is_active: true },
  });

  const networkCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: itDept.id, name: 'Network & Connectivity' },
    },
    update: {},
    create: { department_id: itDept.id, name: 'Network & Connectivity', is_active: true },
  });

  const accessCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: itDept.id, name: 'Access & Identity' },
    },
    update: {},
    create: { department_id: itDept.id, name: 'Access & Identity', is_active: true },
  });

  const hrOnboardingCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: hrDept.id, name: 'Onboarding & Offboarding' },
    },
    update: {},
    create: { department_id: hrDept.id, name: 'Onboarding & Offboarding', is_active: true },
  });

  const hrPayrollCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: hrDept.id, name: 'Payroll & Benefits' },
    },
    update: {},
    create: { department_id: hrDept.id, name: 'Payroll & Benefits', is_active: true },
  });

  const claimsCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: financeDept.id, name: 'Reimbursements & Claims' },
    },
    update: {},
    create: { department_id: financeDept.id, name: 'Reimbursements & Claims', is_active: true },
  });

  const infraCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: facilitiesDept.id, name: 'Building & Infrastructure' },
    },
    update: {},
    create: { department_id: facilitiesDept.id, name: 'Building & Infrastructure', is_active: true },
  });

  const operationsCategory = await prisma.category.upsert({
    where: {
      department_id_name: { department_id: opsDept.id, name: 'Operations' },
    },
    update: {},
    create: { department_id: opsDept.id, name: 'Operations', is_active: true },
  });

  // ----------------------------------------------------
  // 4. Create / Upsert Subcategories
  // ----------------------------------------------------
  const laptopSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: hardwareCategory.id, name: 'Laptop Hardware Repair' },
    },
    update: {},
    create: {
      category_id: hardwareCategory.id,
      name: 'Laptop Hardware Repair',
      default_assignee_id: itEngineer.id,
      tat_hours: 24,
      is_active: true,
    },
  });

  const vpnSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: softwareCategory.id, name: 'VPN Access Request' },
    },
    update: {},
    create: {
      category_id: softwareCategory.id,
      name: 'VPN Access Request',
      default_assignee_id: itEngineer.id,
      tat_hours: 12,
      is_active: true,
    },
  });

  const wifiSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: networkCategory.id, name: 'Wi-Fi Connection Issue' },
    },
    update: {},
    create: {
      category_id: networkCategory.id,
      name: 'Wi-Fi Connection Issue',
      default_assignee_id: itSpecialist.id,
      tat_hours: 8,
      is_active: true,
    },
  });

  const emailSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: networkCategory.id, name: 'Email & Outlook Setup' },
    },
    update: {},
    create: {
      category_id: networkCategory.id,
      name: 'Email & Outlook Setup',
      default_assignee_id: itSpecialist.id,
      tat_hours: 6,
      is_active: true,
    },
  });

  const pwdSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: accessCategory.id, name: 'Password Reset Request' },
    },
    update: {},
    create: {
      category_id: accessCategory.id,
      name: 'Password Reset Request',
      default_assignee_id: itSpecialist.id,
      tat_hours: 2,
      is_active: true,
    },
  });

  const idCardSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: hrOnboardingCategory.id, name: 'New Employee ID Card Request' },
    },
    update: {},
    create: {
      category_id: hrOnboardingCategory.id,
      name: 'New Employee ID Card Request',
      default_assignee_id: hrManager.id,
      tat_hours: 48,
      is_active: true,
    },
  });

  const policySub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: hrOnboardingCategory.id, name: 'Relocation Policy Query' },
    },
    update: {},
    create: {
      category_id: hrOnboardingCategory.id,
      name: 'Relocation Policy Query',
      default_assignee_id: hrManager.id,
      tat_hours: 24,
      is_active: true,
    },
  });

  const salarySub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: hrPayrollCategory.id, name: 'Salary Slip Discrepancy' },
    },
    update: {},
    create: {
      category_id: hrPayrollCategory.id,
      name: 'Salary Slip Discrepancy',
      default_assignee_id: hrManager.id,
      tat_hours: 24,
      is_active: true,
    },
  });

  const travelClaimSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: claimsCategory.id, name: 'Travel Expense Reimbursement' },
    },
    update: {},
    create: {
      category_id: claimsCategory.id,
      name: 'Travel Expense Reimbursement',
      default_assignee_id: financeUser.id,
      tat_hours: 48,
      is_active: true,
    },
  });

  const vendorInvoiceSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: claimsCategory.id, name: 'Vendor Invoice Processing' },
    },
    update: {},
    create: {
      category_id: claimsCategory.id,
      name: 'Vendor Invoice Processing',
      default_assignee_id: financeUser.id,
      tat_hours: 72,
      is_active: true,
    },
  });

  const acSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: infraCategory.id, name: 'Air Conditioning Repair' },
    },
    update: {},
    create: {
      category_id: infraCategory.id,
      name: 'Air Conditioning Repair',
      default_assignee_id: facilitiesManager.id,
      tat_hours: 12,
      is_active: true,
    },
  });

  const lightSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: infraCategory.id, name: 'Lighting & Electrical Fix' },
    },
    update: {},
    create: {
      category_id: infraCategory.id,
      name: 'Lighting & Electrical Fix',
      default_assignee_id: facilitiesManager.id,
      tat_hours: 6,
      is_active: true,
    },
  });

  const opsSub = await prisma.subcategory.upsert({
    where: {
      category_id_name: { category_id: operationsCategory.id, name: 'General Operations' },
    },
    update: {},
    create: {
      category_id: operationsCategory.id,
      name: 'General Operations',
      default_assignee_id: itEngineer.id,
      tat_hours: 24,
      is_active: true,
    },
  });

  console.log('Categories & Subcategories seeded successfully.');

  // ----------------------------------------------------
  // 5. Seed 14 Realistic Sample Tickets
  // ----------------------------------------------------
  const ticketsData = [
    {
      ticket_no: 'TKT-0000001',
      user_id: generalUser.id,
      department_id: itDept.id,
      category_id: hardwareCategory.id,
      subcategory_id: laptopSub.id,
      priority: Priority.high,
      subject: 'Laptop screen flickering and failing to boot',
      description: 'The laptop screen is flickering randomly and shutting down after 5 minutes of work.',
      assigned_to: itEngineer.id,
      status: TicketStatus.wip,
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000002',
      user_id: financeUser.id,
      department_id: itDept.id,
      category_id: networkCategory.id,
      subcategory_id: wifiSub.id,
      priority: Priority.medium,
      subject: 'Cannot connect to office Wi-Fi on 3rd floor',
      description: 'Wi-Fi connection drops frequently near the finance workstations on the 3rd floor.',
      assigned_to: itSpecialist.id,
      status: TicketStatus.open,
      created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 7 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000003',
      user_id: marketingUser.id,
      department_id: itDept.id,
      category_id: accessCategory.id,
      subcategory_id: pwdSub.id,
      priority: Priority.high,
      subject: 'Password reset needed for ERP login',
      description: 'Account locked out after 3 incorrect attempts during password change prompt.',
      assigned_to: itSpecialist.id,
      status: TicketStatus.open,
      created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() - 1 * 60 * 60 * 1000), // SLA breached!
    },
    {
      ticket_no: 'TKT-0000004',
      user_id: hrManager.id,
      department_id: itDept.id,
      category_id: networkCategory.id,
      subcategory_id: emailSub.id,
      priority: Priority.low,
      subject: 'Outlook email sync error on mobile device',
      description: 'Emails are not syncing on iOS Outlook application since morning.',
      assigned_to: itSpecialist.id,
      status: TicketStatus.wip,
      created_at: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000005',
      user_id: financeUser.id,
      department_id: itDept.id,
      category_id: softwareCategory.id,
      subcategory_id: vpnSub.id,
      priority: Priority.high,
      subject: 'VPN access request for remote project assignment',
      description: 'Require secure VPN access credentials for working on the remote client project starting next week.',
      assigned_to: itEngineer.id,
      status: TicketStatus.wip,
      created_at: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000006',
      user_id: adminUser.id,
      department_id: hrDept.id,
      category_id: hrOnboardingCategory.id,
      subcategory_id: idCardSub.id,
      priority: Priority.medium,
      subject: 'New employee access card printing',
      description: 'Please issue permanent RFID smart access card for newly joined engineer in IT team.',
      assigned_to: hrManager.id,
      status: TicketStatus.resolved,
      created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      resolved_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000007',
      user_id: marketingUser.id,
      department_id: hrDept.id,
      category_id: hrOnboardingCategory.id,
      subcategory_id: policySub.id,
      priority: Priority.low,
      subject: 'Query regarding annual leave carry-forward policy',
      description: 'Need clarification on maximum days allowed for carry-forward into next financial year.',
      assigned_to: hrManager.id,
      status: TicketStatus.open,
      created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 19 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000008',
      user_id: itHod.id,
      department_id: hrDept.id,
      category_id: hrPayrollCategory.id,
      subcategory_id: salarySub.id,
      priority: Priority.high,
      subject: 'June tax deduction discrepancy in salary slip',
      description: 'TDS calculation in last month payslip seems higher than estimated declaration.',
      assigned_to: hrManager.id,
      status: TicketStatus.wip,
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000009',
      user_id: itHod.id,
      department_id: financeDept.id,
      category_id: claimsCategory.id,
      subcategory_id: travelClaimSub.id,
      priority: Priority.medium,
      subject: 'Travel expense reimbursement for Bangalore client visit',
      description: 'Submitted cab and flight receipts for Bangalore branch audit trip worth Rs 14,500.',
      assigned_to: financeUser.id,
      status: TicketStatus.closed,
      created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      resolved_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000010',
      user_id: marketingUser.id,
      department_id: financeDept.id,
      category_id: claimsCategory.id,
      subcategory_id: vendorInvoiceSub.id,
      priority: Priority.critical,
      subject: 'Vendor invoice payment delayed for Q2 marketing campaign',
      description: 'Vendor payment #INV-9904 is pending approval past payment due date.',
      assigned_to: financeUser.id,
      status: TicketStatus.wip,
      created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // SLA breached!
    },
    {
      ticket_no: 'TKT-0000011',
      user_id: hrManager.id,
      department_id: facilitiesDept.id,
      category_id: infraCategory.id,
      subcategory_id: acSub.id,
      priority: Priority.high,
      subject: 'AC leaking water in Conference Room B',
      description: 'The split AC unit in Conference Room B is leaking water onto the carpet area.',
      assigned_to: facilitiesManager.id,
      status: TicketStatus.open,
      created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000012',
      user_id: financeUser.id,
      department_id: facilitiesDept.id,
      category_id: infraCategory.id,
      subcategory_id: lightSub.id,
      priority: Priority.low,
      subject: 'Broken desk lamp replacement in cabin 4',
      description: 'Overhead light fixture bulb replacement needed in finance executive cabin.',
      assigned_to: facilitiesManager.id,
      status: TicketStatus.resolved,
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      resolved_at: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000013',
      user_id: marketingUser.id,
      department_id: itDept.id,
      category_id: hardwareCategory.id,
      subcategory_id: laptopSub.id,
      priority: Priority.medium,
      subject: 'Additional monitor request for graphic design work',
      description: 'Requesting secondary 27-inch 4K monitor for video editing and asset creation.',
      assigned_to: itEngineer.id,
      status: TicketStatus.closed,
      created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      resolved_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    },
    {
      ticket_no: 'TKT-0000014',
      user_id: itHod.id,
      department_id: facilitiesDept.id,
      category_id: infraCategory.id,
      subcategory_id: acSub.id,
      priority: Priority.critical,
      subject: 'Emergency: Main server room air conditioner failure',
      description: 'Primary cooling system in Server Room 1 failed. Temperature reached 32°C. Immediate technician required!',
      assigned_to: facilitiesManager.id,
      status: TicketStatus.open,
      created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      due_at: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    },
  ];

  for (const ticket of ticketsData) {
    await prisma.ticket.upsert({
      where: { ticket_no: ticket.ticket_no },
      update: {
        user_id: ticket.user_id,
        department_id: ticket.department_id,
        category_id: ticket.category_id,
        subcategory_id: ticket.subcategory_id,
        priority: ticket.priority,
        subject: ticket.subject,
        description: ticket.description,
        assigned_to: ticket.assigned_to,
        status: ticket.status,
        created_at: ticket.created_at,
        due_at: ticket.due_at,
        resolved_at: ticket.resolved_at || null,
      },
      create: {
        ticket_no: ticket.ticket_no,
        user_id: ticket.user_id,
        department_id: ticket.department_id,
        category_id: ticket.category_id,
        subcategory_id: ticket.subcategory_id,
        priority: ticket.priority,
        subject: ticket.subject,
        description: ticket.description,
        assigned_to: ticket.assigned_to,
        status: ticket.status,
        created_at: ticket.created_at,
        due_at: ticket.due_at,
        resolved_at: ticket.resolved_at || null,
      },
    });
  }

  console.log(`Successfully seeded ${ticketsData.length} tickets across various departments & statuses.`);
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
