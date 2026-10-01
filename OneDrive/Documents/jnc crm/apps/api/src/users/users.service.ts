/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScopedUser } from '../auth/scoping.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface CreateUserDto {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'sub_admin' | 'employee' | 'store_manager' | 'project_manager' | 'developer_lead' | 'developer';
  teamId?: string;
  warehouseId?: string;
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  role?: 'admin' | 'sub_admin' | 'employee' | 'store_manager' | 'project_manager' | 'developer_lead' | 'developer';
  teamId?: string;
  warehouseId?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  /**
   * Generates sequential employee code per role prefix
   * JNC-ADM-xxx, JNC-PM-xxx, JNC-LEAD-xxx, JNC-DEV-xxx
   */
  async generateEmployeeCode(role: string): Promise<string> {
    const prefixMap: Record<string, string> = {
      super_admin: 'JNC-SA',
      admin: 'JNC-ADM',
      sub_admin: 'JNC-SUB',
      employee: 'JNC-EMP',
      store_manager: 'JNC-STM',
      project_manager: 'JNC-PM',
      developer_lead: 'JNC-LEAD',
      developer: 'JNC-DEV',
    };

    const prefix = prefixMap[role] || 'JNC-EMP';
    const count = await this.prisma.user.count({
      where: {
        employeeCode: { startsWith: prefix },
      },
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Generates secure, random 10-character temporary password
   */
  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'Jnc#';
    for (let i = 0; i < 6; i++) {
      const idx = crypto.randomInt(0, chars.length);
      pass += chars[idx];
    }
    return pass;
  }

  /**
   * Creates a new user with server-side role gating & temporary credentials
   */
  async createUser(dto: CreateUserDto, creator: ScopedUser) {
    // 1. Role Authorization Checks
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Only Administrators can create users.');
    }

    if (creator.role === 'admin' && (dto.role === 'admin' || (dto.role as any) === 'super_admin')) {
      throw new ForbiddenException(
        'Administrators are only permitted to create Sub-Admin and Employee accounts.',
      );
    }

    if ((dto.role as any) === 'super_admin') {
      throw new ForbiddenException('Super Admin accounts cannot be created via standard user management.');
    }

    // 2. Validate email uniqueness
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException(`A user with email "${dto.email}" already exists.`);
    }

    // 3. Generate credentials
    const employeeCode = await this.generateEmployeeCode(dto.role);
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // 4. Create user record
    const newUser = await this.prisma.user.create({
      data: {
        employeeCode,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        passwordHash,
        role: dto.role,
        teamId: dto.teamId || null,
        warehouseId: dto.warehouseId || null,
        isActive: true,
        mustResetPassword: true, // Forces reset on first login
        createdById: creator.id,
      },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        teamId: true, teamRef: { select: { id: true, name: true, allowedPages: true } },
        warehouseId: true,
        isActive: true,
        mustResetPassword: true,
        lastLoginAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, employeeCode: true } },
      },
    });

    // 5. Send Welcome & Credentials Email (Non-blocking if SMTP is unconfigured)
    try {
      const branding = await this.notificationsService.getBranding();
      await this.notificationsService.sendEmail({
        to: newUser.email,
        subject: `Welcome to ${branding.companyDisplayName} - Your Login Credentials [${newUser.employeeCode}]`,
        html: `
          <h3>Welcome to ${branding.companyDisplayName}</h3>
          <p>Dear ${newUser.name},</p>
          <p>Your account has been created on the ${branding.companyDisplayName} portal.</p>
          <p><strong>Login Details:</strong></p>
          <ul>
            <li><strong>Portal URL:</strong> <a href="${process.env.FRONTEND_URL || 'https://admin.jsnc.co.in'}/login">${process.env.FRONTEND_URL || 'https://admin.jsnc.co.in'}/login</a></li>
            <li><strong>Employee Code / Username:</strong> <code>${newUser.employeeCode}</code></li>
            <li><strong>Temporary Password:</strong> <code>${tempPassword}</code></li>
          </ul>
          <p><em>Note: You will be prompted to change your password immediately upon first login.</em></p>
          ${branding.companyPhone ? `<p>Support Hotline: <strong>${branding.companyPhone}</strong></p>` : ''}
          <p>Best regards,<br>${branding.companyDisplayName} Administration</p>
        `,
        relatedEntityType: 'user',
        relatedEntityId: newUser.id,
      });
    } catch (emailErr: any) {
      this.logger.warn(`Could not dispatch welcome email for ${newUser.employeeCode}: ${emailErr.message}`);
    }

    // 6. Record Audit Log
    await this.auditService.log({
      actorId: creator.id,
      actorName: creator.employeeCode,
      action: 'CREATE',
      entityName: 'User',
      entityId: newUser.id,
      afterState: { employeeCode: newUser.employeeCode, email: newUser.email, role: newUser.role },
    });

    // Return created user with tempPassword for single on-screen fallback modal
    return {
      user: newUser,
      tempPassword,
      message: `User ${newUser.name} [${newUser.employeeCode}] created successfully. Credentials emailed to ${newUser.email}.`,
    };
  }

  /**
   * Find users with row-level RBAC filter
   */
  async findAll(creator: ScopedUser, query?: { search?: string; role?: string; isActive?: string }) {
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Access denied: User management is restricted to Administrators.');
    }

    const where: any = { deletedAt: null };

    // Row-level scoping for admin: sees users they created OR team/sub_admin/employees
    if (creator.role === 'admin') {
      where.OR = [
        { createdById: creator.id },
        { role: { in: ['sub_admin', 'employee'] } },
      ];
    }

    if (query?.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search } },
            { email: { contains: query.search } },
            { employeeCode: { contains: query.search } },
            { phone: { contains: query.search } },
            { teamRef: { name: { contains: query.search } } },
          ],
        },
      ];
    }

    if (query?.role) {
      where.role = query.role;
    }

    if (query?.isActive !== undefined && query?.isActive !== '') {
      where.isActive = query.isActive === 'true';
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        teamId: true, teamRef: { select: { id: true, name: true, allowedPages: true } },
        warehouseId: true,
        isActive: true,
        mustResetPassword: true,
        lastLoginAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, employeeCode: true } },
      },
    });

    return {
      items: users,
      total: users.length,
      creatorRole: creator.role,
    };
  }

  /**
   * Get single user
   */
  async findOne(id: string, creator: ScopedUser) {
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Access denied.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        teamId: true, teamRef: { select: { id: true, name: true, allowedPages: true } },
        warehouseId: true,
        isActive: true,
        mustResetPassword: true,
        lastLoginAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, employeeCode: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Update user details & role
   */
  async updateUser(id: string, dto: UpdateUserDto, creator: ScopedUser) {
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Access denied.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    // Admin cannot edit a super_admin or another admin
    if (creator.role === 'admin') {
      if (targetUser.role === 'super_admin' || (targetUser.role === 'admin' && targetUser.id !== creator.id)) {
        throw new ForbiddenException('Administrators cannot modify higher or equal administrative accounts.');
      }
      if (dto.role === 'admin' || (dto.role as any) === 'super_admin') {
        throw new ForbiddenException('Administrators cannot escalate roles to Admin or Super Admin.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        role: dto.role,
        teamId: dto.teamId,
        warehouseId: dto.warehouseId,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        teamId: true, teamRef: { select: { id: true, name: true, allowedPages: true } },
        warehouseId: true,
        isActive: true,
        mustResetPassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      actorId: creator.id,
      actorName: creator.employeeCode,
      action: 'UPDATE',
      entityName: 'User',
      entityId: updated.id,
      afterState: dto,
    });

    return updated;
  }

  /**
   * Reset user credentials (generates temp password and emails it)
   */
  async resetCredentials(id: string, creator: ScopedUser) {
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Access denied.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    if (creator.role === 'admin' && targetUser.role === 'super_admin') {
      throw new ForbiddenException('Cannot reset credentials for Super Admin.');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustResetPassword: true,
      },
    });

    // Send email with new temp credentials (non-blocking)
    try {
      const branding = await this.notificationsService.getBranding();
      await this.notificationsService.sendEmail({
        to: targetUser.email,
        subject: `Your ${branding.companyDisplayName} Password Has Been Reset [${targetUser.employeeCode}]`,
        html: `
          <h3>${branding.companyDisplayName} Password Reset Notification</h3>
          <p>Dear ${targetUser.name},</p>
          <p>Your password has been reset by an administrator.</p>
          <p><strong>Your New Temporary Credentials:</strong></p>
          <ul>
            <li><strong>Username / Code:</strong> <code>${targetUser.employeeCode}</code></li>
            <li><strong>New Temporary Password:</strong> <code>${tempPassword}</code></li>
            <li><strong>Portal URL:</strong> <a href="${process.env.FRONTEND_URL || 'https://admin.jsnc.co.in'}/login">${process.env.FRONTEND_URL || 'https://admin.jsnc.co.in'}/login</a></li>
          </ul>
          <p><em>You will be required to choose a new password upon logging in.</em></p>
          ${branding.companyPhone ? `<p>Support Hotline: <strong>${branding.companyPhone}</strong></p>` : ''}
          <p>Best regards,<br>${branding.companyDisplayName} Administration</p>
        `,
        relatedEntityType: 'user',
        relatedEntityId: targetUser.id,
      });
    } catch (emailErr: any) {
      this.logger.warn(`Could not dispatch password reset email for ${targetUser.employeeCode}: ${emailErr.message}`);
    }

    await this.auditService.log({
      actorId: creator.id,
      actorName: creator.employeeCode,
      action: 'STATUS_CHANGE',
      entityName: 'User',
      entityId: targetUser.id,
      afterState: { action: 'CREDENTIALS_RESET', target: targetUser.employeeCode },
    });

    return {
      tempPassword,
      message: `Password reset successfully for ${targetUser.name} [${targetUser.employeeCode}]. New credentials emailed to ${targetUser.email}.`,
    };
  }

  /**
   * Toggle Active / Inactive status with explicit boolean intent
   */
  async toggleActive(id: string, isActive: boolean, creator: ScopedUser) {
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Access denied: Only Administrators can modify user status.');
    }

    if (typeof isActive !== 'boolean') {
      throw new BadRequestException("Property 'isActive' must be an explicit boolean value (true or false).");
    }

    if (id === creator.id) {
      throw new BadRequestException('Self-deactivation is blocked: You cannot deactivate your own account.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    if (creator.role === 'admin' && (targetUser.role === 'super_admin' || targetUser.role === 'admin')) {
      throw new ForbiddenException('Hierarchy violation: Administrators cannot modify status of higher or equal admin accounts.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        role: true,
        teamId: true, teamRef: { select: { id: true, name: true, allowedPages: true } },
        warehouseId: true,
        isActive: true,
        mustResetPassword: true,
        lastLoginAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, employeeCode: true } },
      },
    });

    try {
      await this.auditService.log({
        actorId: creator.id,
        actorName: creator.employeeCode,
        action: 'STATUS_CHANGE',
        entityName: 'User',
        entityId: targetUser.id,
        beforeState: { isActive: targetUser.isActive },
        afterState: { isActive },
      });
    } catch (e) {
      this.logger.error('Audit log failed during user status change:', e);
    }

    return updated;
  }

  /**
   * Soft-delete user account (Protected: Cannot delete Super Admin or Self)
   */
  async delete(id: string, creator: ScopedUser) {
    if (creator.role !== 'super_admin' && creator.role !== 'admin') {
      throw new ForbiddenException('Access denied: Only Administrators can delete user accounts.');
    }

    if (id === creator.id) {
      throw new BadRequestException('Self-deletion is blocked: You cannot delete your own account.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    if (targetUser.role === 'super_admin') {
      throw new ForbiddenException('Security restriction: Super Admin accounts cannot be deleted.');
    }

    if (creator.role === 'admin' && targetUser.role === 'admin') {
      throw new ForbiddenException('Hierarchy violation: Administrators cannot delete other administrator accounts.');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    try {
      await this.auditService.log({
        actorId: creator.id,
        actorName: creator.employeeCode,
        action: 'DELETE',
        entityName: 'User',
        entityId: targetUser.id,
        beforeState: { employeeCode: targetUser.employeeCode, email: targetUser.email, role: targetUser.role },
      });
    } catch (e) {
      this.logger.error('Audit log failed during user deletion:', e);
    }

    return { success: true, message: `User ${targetUser.name} [${targetUser.employeeCode}] deleted successfully.` };
  }

  /**
   * Force password reset for all active users across the organization (Super Admin only)
   */
  async forceResetAllPasswords(actor: ScopedUser) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenException('Access denied: Only Super Admin can force system-wide password resets.');
    }

    const result = await this.prisma.user.updateMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      data: {
        mustResetPassword: true,
      },
    });

    try {
      await this.auditService.log({
        actorId: actor.id,
        actorName: actor.employeeCode,
        action: 'STATUS_CHANGE',
        entityName: 'User',
        entityId: 'ALL',
        afterState: { action: 'FORCE_SYSTEM_PASSWORD_RESET', affectedUsers: result.count },
      });
    } catch (e) {
      this.logger.error('Audit log failed during bulk password reset:', e);
    }

    this.logger.warn(`Super Admin ${actor.employeeCode} triggered forced password reset for ${result.count} users.`);

    return {
      success: true,
      affectedUsers: result.count,
      message: `Forced password reset successfully applied to ${result.count} active users. All users must establish a new password upon next login.`,
    };
  }
}


