/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScopedUser } from '../auth/scoping.service';

export interface CompanyBrandingConfig {
  companyDisplayName: string;
  companyPhone: string;
  companyLogoUrl: string | null;
}

export const DEFAULT_BRANDING: CompanyBrandingConfig = {
  companyDisplayName: 'JS Network Communication',
  companyPhone: '+91 9663421455',
  companyLogoUrl: '/jnc-logo.jpg',
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly BRANDING_KEY = 'company_branding_config';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve current company branding configuration with sensible fallbacks.
   * Publicly accessible.
   */
  async getBranding(): Promise<CompanyBrandingConfig> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: this.BRANDING_KEY },
      });

      if (!setting || !setting.value) {
        return DEFAULT_BRANDING;
      }

      const parsed = JSON.parse(setting.value);
      return {
        companyDisplayName: parsed.companyDisplayName?.trim() || DEFAULT_BRANDING.companyDisplayName,
        companyPhone: parsed.companyPhone?.trim() || DEFAULT_BRANDING.companyPhone,
        companyLogoUrl: parsed.companyLogoUrl || DEFAULT_BRANDING.companyLogoUrl,
      };
    } catch (err: any) {
      this.logger.error(`Error reading company branding config: ${err.message}`);
      return DEFAULT_BRANDING;
    }
  }

  /**
   * Update company branding configuration (Super Admin & Admin only).
   */
  async updateBranding(
    user: ScopedUser,
    dto: {
      companyDisplayName?: string;
      companyPhone?: string;
      companyLogoUrl?: string | null;
    },
  ): Promise<CompanyBrandingConfig> {
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      throw new ForbiddenException('Only Administrators are authorized to modify Company Branding settings.');
    }

    const current = await this.getBranding();

    const updated: CompanyBrandingConfig = {
      companyDisplayName:
        dto.companyDisplayName !== undefined && dto.companyDisplayName.trim().length > 0
          ? dto.companyDisplayName.trim()
          : current.companyDisplayName,
      companyPhone:
        dto.companyPhone !== undefined ? dto.companyPhone.trim() : current.companyPhone,
      companyLogoUrl:
        dto.companyLogoUrl !== undefined ? dto.companyLogoUrl : current.companyLogoUrl,
    };

    await this.prisma.systemSetting.upsert({
      where: { key: this.BRANDING_KEY },
      create: {
        key: this.BRANDING_KEY,
        value: JSON.stringify(updated),
      },
      update: {
        value: JSON.stringify(updated),
      },
    });

    this.logger.log(
      `Company branding updated by ${user.employeeCode}: ${updated.companyDisplayName}`,
    );

    return updated;
  }

  // --- SUPER ADMIN DYNAMIC MAIL ACCOUNTS MANAGEMENT ---

  async getMailAccounts(user: ScopedUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only Super Admin is authorized to access Mail Account settings.');
    }
    return this.prisma.mailAccount.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        senderName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isSecure: true,
        purpose: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createMailAccount(
    user: ScopedUser,
    dto: {
      name: string;
      email: string;
      senderName?: string;
      smtpHost: string;
      smtpPort?: number;
      smtpUser: string;
      smtpPass: string;
      isSecure?: boolean;
      purpose?: string;
    },
  ) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only Super Admin can configure Mail Accounts.');
    }

    return this.prisma.mailAccount.create({
      data: {
        name: dto.name,
        email: dto.email,
        senderName: dto.senderName,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort ? Number(dto.smtpPort) : 587,
        smtpUser: dto.smtpUser,
        smtpPass: dto.smtpPass,
        isSecure: Boolean(dto.isSecure),
        purpose: dto.purpose || 'PRIMARY_ALERTS',
        createdById: user.id,
      },
    });
  }

  async updateMailAccount(
    user: ScopedUser,
    id: string,
    dto: {
      name?: string;
      email?: string;
      senderName?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      isSecure?: boolean;
      purpose?: string;
      isActive?: boolean;
    },
  ) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only Super Admin can modify Mail Accounts.');
    }

    return this.prisma.mailAccount.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        senderName: dto.senderName,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort !== undefined ? Number(dto.smtpPort) : undefined,
        smtpUser: dto.smtpUser,
        smtpPass: dto.smtpPass !== undefined && dto.smtpPass !== '' ? dto.smtpPass : undefined,
        isSecure: dto.isSecure !== undefined ? Boolean(dto.isSecure) : undefined,
        purpose: dto.purpose,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
      },
    });
  }

  async deleteMailAccount(user: ScopedUser, id: string) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only Super Admin can delete Mail Accounts.');
    }

    return this.prisma.mailAccount.delete({
      where: { id },
    });
  }
}
