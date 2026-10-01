/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export interface CreateTenantDto {
  code: string;            // e.g. "VERTEX", "ACME"
  name: string;            // e.g. "Vertex Solutions Pvt Ltd"
  slug?: string;           // e.g. "vertex"
  planTier?: string;       // "starter" | "professional" | "enterprise"
  maxUsers?: number;
  adminName: string;       // Primary Company Admin Name
  adminEmail: string;      // Primary Company Admin Email
  adminPhone?: string;
  adminPassword?: string;  // Initial temporary password
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
}

export interface UpdateTenantDto {
  name?: string;
  status?: string;         // "active" | "suspended" | "expired"
  planTier?: string;
  maxUsers?: number;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  lutBondNo?: string;
  lutValidity?: string;
  invoicePrefix?: string;
  logoUrl?: string;
}

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  /**
   * List all tenant organizations (Platform Super Admin only)
   */
  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            leads: true,
            orders: true,
            invoices: true,
            mailAccounts: true,
          },
        },
      },
    });

    return tenants;
  }

  /**
   * Get tenant detail by ID
   */
  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        mailAccounts: {
          select: {
            id: true,
            name: true,
            email: true,
            smtpHost: true,
            purpose: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            leads: true,
            orders: true,
            invoices: true,
            skus: true,
            projects: true,
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Company tenant not found');
    return tenant;
  }

  /**
   * Provision a new Tenant Company + Primary Tenant Admin Account
   */
  async createTenant(dto: CreateTenantDto) {
    const cleanCode = dto.code.trim().toUpperCase();
    const cleanSlug = (dto.slug || cleanCode.toLowerCase()).trim().replace(/[^a-z0-9-]/gi, '-');

    // 1. Check uniqueness
    const existing = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ code: cleanCode }, { slug: cleanSlug }],
      },
    });

    if (existing) {
      throw new ConflictException(`Company with code '${cleanCode}' or slug '${cleanSlug}' already exists`);
    }

    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new ConflictException(`User with email '${adminEmail}' is already registered in the system`);
    }

    const tempPassword = dto.adminPassword || 'Admin@123456';
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const adminEmployeeCode = `${cleanCode}-SA-001`;

    // 2. Transactional creation of Tenant + Company Admin
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          code: cleanCode,
          name: dto.name.trim(),
          slug: cleanSlug,
          status: 'active',
          planTier: dto.planTier || 'standard',
          maxUsers: dto.maxUsers || 10,
          phone: dto.adminPhone || null,
          email: adminEmail,
          address: dto.address || null,
          city: dto.city || null,
          state: dto.state || 'Karnataka',
          gstin: dto.gstin || null,
          invoicePrefix: cleanCode,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          employeeCode: adminEmployeeCode,
          name: dto.adminName.trim(),
          email: adminEmail,
          phone: dto.adminPhone || null,
          passwordHash,
          role: 'tenant_admin',
          isActive: true,
          mustResetPassword: true,
        },
      });

      // Also create default Main Warehouse for tenant
      await tx.warehouse.create({
        data: {
          tenantId: tenant.id,
          code: `${cleanCode}-WH-MAIN`,
          name: `${dto.name} Main Warehouse`,
          city: dto.city || 'Bengaluru',
          isActive: true,
        },
      });

      return { tenant, adminUser };
    });

    return {
      message: 'Company workspace and Tenant Admin created successfully',
      tenant: result.tenant,
      adminUser: {
        id: result.adminUser.id,
        employeeCode: result.adminUser.employeeCode,
        name: result.adminUser.name,
        email: result.adminUser.email,
        role: result.adminUser.role,
        tempPassword,
      },
    };
  }

  /**
   * Update Tenant configuration or status (suspend / activate)
   */
  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Company tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    return updated;
  }

  /**
   * Delete / Soft Delete Tenant workspace
   */
  async deleteTenant(id: string) {
    if (id === 'default-tenant-id') {
      throw new BadRequestException('Primary system root company cannot be deleted');
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'suspended' },
    });

    return { message: 'Company workspace deactivated successfully' };
  }
}
