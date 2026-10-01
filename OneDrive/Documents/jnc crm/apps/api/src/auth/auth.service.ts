/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';

interface LockoutInfo {
  failedAttempts: number;
  lockedUntil?: number;
}

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Check whether an account is currently in a locked state (100% DB-persisted)
   */
  private async checkAccountLockout(lockKey: string, user?: any) {
    const now = new Date();

    // 1. Check User table if user is found
    if (user && user.lockoutUntil) {
      if (new Date(user.lockoutUntil) > now) {
        const remainingMinutes = Math.ceil((new Date(user.lockoutUntil).getTime() - now.getTime()) / 60000);
        throw new UnauthorizedException(
          `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute(s) or contact administrator.`
        );
      } else {
        // Lockout expired, reset user counter in DB
        await this.prisma.user.update({
          include: { teamRef: { select: { id: true, name: true, allowedPages: true } } }, where: { id: user.id },
          data: { failedLoginAttempts: 0, lockoutUntil: null },
        });
      }
    }

    // 2. Check AccountLockout table for identityKey
    const lockoutRecord = await this.prisma.accountLockout.findUnique({
      where: { identityKey: lockKey },
    });

    if (lockoutRecord && lockoutRecord.lockedUntil) {
      if (new Date(lockoutRecord.lockedUntil) > now) {
        const remainingMinutes = Math.ceil((new Date(lockoutRecord.lockedUntil).getTime() - now.getTime()) / 60000);
        throw new UnauthorizedException(
          `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute(s) or contact administrator.`
        );
      } else {
        // Expired
        try {
          await this.prisma.accountLockout.delete({
            where: { identityKey: lockKey },
          });
        } catch (e) {
          // ignore
        }
      }
    }
  }

  /**
   * Record a failed login attempt in the database and lock if threshold is reached
   */
  private async recordFailedAttempt(lockKey: string, user?: any, ipAddress?: string) {
    const now = new Date();
    let currentAttempts = 0;

    if (user) {
      currentAttempts = (user.failedLoginAttempts || 0) + 1;
      const isLocked = currentAttempts >= this.MAX_FAILED_ATTEMPTS;
      const lockedUntil = isLocked ? new Date(now.getTime() + this.LOCKOUT_DURATION_MS) : null;

      await this.prisma.user.update({
        include: { teamRef: { select: { id: true, name: true, allowedPages: true } } }, where: { id: user.id },
        data: {
          failedLoginAttempts: currentAttempts,
          lockoutUntil: lockedUntil,
        },
      });

      if (isLocked) {
        // Log the account lockout event to AuditLog
        try {
          await this.prisma.auditLog.create({
            data: {
              actorId: user.id,
              actorName: user.name || lockKey,
              action: 'LOGIN_LOCKOUT',
              entityName: 'User',
              entityId: user.id,
              afterState: JSON.stringify({
                reason: 'Account locked for 15 minutes after 5 consecutive failed login attempts',
                consecutiveFailedAttempts: currentAttempts,
                lockExpiresAt: lockedUntil?.toISOString(),
              }),
              ipAddress: ipAddress || '127.0.0.1',
            },
          });
        } catch (e) {
          console.warn('Failed to write LOGIN_LOCKOUT audit log:', e);
        }

        throw new UnauthorizedException(
          'Account locked: 5 consecutive failed login attempts exceeded. This account has been locked for 15 minutes.'
        );
      }
    } else {
      // Identity-level lockout in AccountLockout table
      const record = await this.prisma.accountLockout.upsert({
        where: { identityKey: lockKey },
        create: {
          identityKey: lockKey,
          failedAttempts: 1,
          lastAttemptAt: now,
        },
        update: {
          failedAttempts: { increment: 1 },
          lastAttemptAt: now,
        },
      });

      currentAttempts = record.failedAttempts;
      if (currentAttempts >= this.MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + this.LOCKOUT_DURATION_MS);
        await this.prisma.accountLockout.update({
          where: { identityKey: lockKey },
          data: { lockedUntil },
        });

        try {
          await this.prisma.auditLog.create({
            data: {
              actorId: null,
              actorName: lockKey,
              action: 'LOGIN_LOCKOUT',
              entityName: 'AccountLockout',
              entityId: lockKey,
              afterState: JSON.stringify({
                reason: 'Identity locked for 15 minutes after 5 consecutive failed login attempts',
                consecutiveFailedAttempts: currentAttempts,
                lockExpiresAt: lockedUntil.toISOString(),
              }),
              ipAddress: ipAddress || '127.0.0.1',
            },
          });
        } catch (e) {
          console.warn('Failed to write LOGIN_LOCKOUT audit log:', e);
        }

        throw new UnauthorizedException(
          'Account locked: 5 consecutive failed login attempts exceeded. This account has been locked for 15 minutes.'
        );
      }
    }
  }

  /**
   * Reset failed attempt counter on successful login in DB
   */
  private async resetFailedAttempts(lockKey: string, userId?: string) {
    if (userId) {
      try {
        await this.prisma.user.update({
          include: { teamRef: { select: { id: true, name: true, allowedPages: true } } }, where: { id: userId },
          data: { failedLoginAttempts: 0, lockoutUntil: null },
        });
      } catch (e) {
        // ignore
      }
    }
    try {
      await this.prisma.accountLockout.delete({
        where: { identityKey: lockKey },
      });
    } catch (e) {
      // not exists is fine
    }
  }

  async validateUser(username: string, pass: string, ipAddress?: string): Promise<any> {
    const raw = (username || '').trim();
    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();

    // Check pre-existing lockout on username/email
    await this.checkAccountLockout(lower);

    // Flexible user lookup: matches employeeCode, email, or name (Case-Insensitive in PostgreSQL)
    let user = await this.prisma.user.findFirst({
      include: { teamRef: { select: { id: true, name: true, allowedPages: true } } },
      where: {
        OR: [
          { email: { equals: lower, mode: 'insensitive' } },
          { email: { equals: raw, mode: 'insensitive' } },
          { employeeCode: { equals: upper, mode: 'insensitive' } },
          { email: { startsWith: lower, mode: 'insensitive' } },
          { employeeCode: { contains: upper, mode: 'insensitive' } },
          { name: { contains: raw, mode: 'insensitive' } },
        ],
        deletedAt: null,
      },
    });

    // Fallback if no specific match
    if (!user) {
      if (lower.includes('admin') || lower.includes('owner') || lower.includes('boss') || lower.includes('jayaraj')) {
        user = await this.prisma.user.findFirst({
          include: { teamRef: { select: { id: true, name: true, allowedPages: true } } },
          where: { role: { in: ['super_admin', 'admin'] }, deletedAt: null },
        });
      } else if (lower.includes('santhosh') || lower.includes('sk')) {
        user = await this.prisma.user.findFirst({
          include: { teamRef: { select: { id: true, name: true, allowedPages: true } } },
          where: { email: { contains: 'santhosh', mode: 'insensitive' }, deletedAt: null },
        });
      } else if (lower.includes('emp') || lower.includes('priya') || lower.includes('sales')) {
        user = await this.prisma.user.findFirst({
          include: { teamRef: { select: { id: true, name: true, allowedPages: true } } },
          where: { role: 'employee', deletedAt: null },
        });
      }
    }

    const lockKey = user ? user.email.toLowerCase() : lower;
    await this.checkAccountLockout(lockKey, user);

    if (!user) {
      await this.recordFailedAttempt(lockKey, undefined, ipAddress);
      throw new UnauthorizedException('Invalid credentials. User not found.');
    }

    // Password validation (Cryptographic BCrypt match against DB hash)
    const isHashMatch = await bcrypt.compare(pass, user.passwordHash);

    if (!isHashMatch) {
      await this.recordFailedAttempt(lockKey, user, ipAddress);
      throw new UnauthorizedException('Invalid credentials. Incorrect password.');
    }

    // Login successful — clear failed attempts for this account in DB
    await this.resetFailedAttempts(lockKey, user.id);

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, ipAddress?: string) {
    const user = await this.validateUser(loginDto.username, loginDto.password, ipAddress);
    const tokens = this.generateTokens(user);

    // Update lastLoginAt
    try {
      await this.prisma.user.update({
        include: { teamRef: { select: { id: true, name: true, allowedPages: true } } }, where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (e) {
      // non-fatal
    }

    // Record login in audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: 'LOGIN',
          entityName: 'User',
          entityId: user.id,
          afterState: JSON.stringify({ email: user.email, role: user.role }),
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (e) {
      console.warn('Audit log write error on login:', e);
    }

    return {
      user,
      ...tokens,
    };
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (!newPass || newPass.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long');
    }
    const user = await this.prisma.user.findUnique({ include: { teamRef: { select: { id: true, name: true, allowedPages: true } } }, where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(currentPass, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Current password does not match');
    }

    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      include: { teamRef: { select: { id: true, name: true, allowedPages: true } } }, where: { id: userId },
      data: { passwordHash, mustResetPassword: false },
    });

    return { message: 'Password updated successfully' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
          select: {
            teamRef: { select: { id: true, name: true, allowedPages: true } },
          id: true,
          employeeCode: true,
          name: true,
          email: true,
          role: true,
          teamId: true,
          warehouseId: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return {
        user,
        ...this.generateTokens(user),
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeCode: user.employeeCode,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRATION || '1d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Update self profile name/phone
   */
  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name?.trim(),
        phone: data.phone?.trim(),
      },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        teamId: true,
        teamRef: { select: { id: true, name: true, allowedPages: true } },
        warehouseId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return updated;
  }
}


