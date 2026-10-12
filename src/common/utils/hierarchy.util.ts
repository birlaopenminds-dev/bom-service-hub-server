import { Role } from '@prisma/client';
import { PrismaService } from '../../providers/database/prisma.service';
import { ValidatorsUtil } from './validators.util';

export class HierarchyUtil {
  /**
   * Traverses upwards through the entire reporting manager hierarchy:
   * e.g., Emp1 -> Emp2 (Emp1's RM) -> Emp3 (Emp2's RM) -> Emp4 -> ...
   * Collects email addresses for all active managers in the chain.
   *
   * @param prisma Prisma database client
   * @param userId Starting employee ID
   * @param maxDepth Safeguard against cycles or overly deep chains (default: 15)
   * @returns Array of valid email addresses for all managers in the hierarchy
   */
  static async getReportingHierarchyEmails(
    prisma: PrismaService,
    userId?: number | null,
    maxDepth: number = 15,  
  ): Promise<string[]> {
    if (!userId) return [];

    const managerEmails: string[] = [];
    const visitedUserIds = new Set<number>([userId]);
    let currentUserId: number | null = userId;
    let depth = 0;

    while (currentUserId && depth < maxDepth) {
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: {
          reporting_manager_id: true,
          reporting_manager: {
            select: {
              id: true,
              email: true,
              is_active: true,
            },
          },
        },
      });

      if (!user || !user.reporting_manager) {
        break;
      }

      const manager = user.reporting_manager;

      // Cycle detection: break if this manager was already visited
      if (visitedUserIds.has(manager.id)) {
        break;
      }

      visitedUserIds.add(manager.id);

      // Only add active managers with valid emails
      if (manager.is_active && manager.email) {
        const cleanEmail = manager.email.trim();
        if (ValidatorsUtil.isValidEmail(cleanEmail)) {
          managerEmails.push(cleanEmail);
        }
      }

      currentUserId = manager.id;
      depth++;
    }

    return managerEmails;
  }

  /**
   * Fetches HOD emails for a given department ID.
   * Includes both direct department HODs and assigned HODs in hod_departments relation.
   */
  static async getHodEmailsForDepartment(
    prisma: PrismaService,
    departmentId?: number | null,
  ): Promise<string[]> {
    if (!departmentId) return [];

    const hods = await prisma.user.findMany({
      where: {
        role: Role.hod,
        is_active: true,
        OR: [
          { department_id: departmentId },
          { hod_departments: { some: { id: departmentId } } },
        ],
      },
      select: { email: true },
    });

    return hods
      .map((h) => h.email?.trim())
      .filter((e): e is string => Boolean(e && ValidatorsUtil.isValidEmail(e)));
  }

  /**
   * Resolves the complete CC email list for a user:
   * 1. Multi-level reporting manager hierarchy (RM, RM's RM, etc.)
   * 2. Direct HOD (user.hod)
   * 3. Department HOD(s)
   *
   * Automatically deduplicates (case-insensitive) and filters out:
   * - Inactive accounts
   * - Invalid email syntax
   * - Addresses listed in excludeEmails (e.g. TO recipients, ticket creator/assignee)
   */
  static async getManagementChainCcEmails(
    prisma: PrismaService,
    user?: {
      id?: number;
      department_id?: number | null;
      hod?: { email?: string | null } | null;
      email?: string | null;
    } | null,
    excludeEmails: string[] = [],
  ): Promise<string[]> {
    if (!user || !user.id) return [];

    const excludeLowerSet = new Set(
      excludeEmails.filter(Boolean).map((e) => e.trim().toLowerCase()),
    );
    if (user.email) {
      excludeLowerSet.add(user.email.trim().toLowerCase());
    }

    // 1. Fetch entire reporting manager hierarchy upwards
    const rmHierarchyEmails = await this.getReportingHierarchyEmails(
      prisma,
      user.id,
    );

    // 2. Fetch HOD emails (direct + department fallback)
    const hodEmails: string[] = [];
    if (user.hod?.email && ValidatorsUtil.isValidEmail(user.hod.email.trim())) {
      hodEmails.push(user.hod.email.trim());
    } else {
      // Check database if hod relation wasn't preloaded or direct hod is absent
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          department_id: true,
          hod: { select: { email: true, is_active: true } },
        },
      });

      if (
        dbUser?.hod?.email &&
        dbUser.hod.is_active &&
        ValidatorsUtil.isValidEmail(dbUser.hod.email.trim())
      ) {
        hodEmails.push(dbUser.hod.email.trim());
      }

      const targetDeptId = user.department_id || dbUser?.department_id;
      if (hodEmails.length === 0 && targetDeptId) {
        const deptHodEmails = await this.getHodEmailsForDepartment(
          prisma,
          targetDeptId,
        );
        hodEmails.push(...deptHodEmails);
      }
    }

    // 3. Merge, deduplicate (case-insensitive), and filter out excluded emails
    const combinedEmails = [...rmHierarchyEmails, ...hodEmails];
    const uniqueCcEmails: string[] = [];
    const seenLower = new Set<string>();

    for (const email of combinedEmails) {
      const normalized = email.trim();
      const lower = normalized.toLowerCase();
      if (!excludeLowerSet.has(lower) && !seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueCcEmails.push(normalized);
      }
    }

    return uniqueCcEmails;
  }
}
