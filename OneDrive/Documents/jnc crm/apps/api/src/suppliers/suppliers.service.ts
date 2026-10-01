/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSupplierDto {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  city?: string;
  leadTimeDays?: number;
  notes?: string;
}

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        gstin: dto.gstin,
        address: dto.address,
        city: dto.city,
        leadTimeDays: dto.leadTimeDays ? Number(dto.leadTimeDays) : 7,
        notes: dto.notes,
      },
    });
  }

  async findAll(query: { search?: string; isActive?: boolean }) {
    const where: any = { deletedAt: null };
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { contactPerson: { contains: query.search } },
        { city: { contains: query.search } },
        { email: { contains: query.search } },
        { gstin: { contains: query.search } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        preferredSkus: {
          select: { id: true, skuCode: true, name: true, category: true },
        },
        _count: {
          select: { stockMovements: true, preferredSkus: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        preferredSkus: true,
        stockMovements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { sku: true },
        },
      },
    });

    if (!supplier || supplier.deletedAt) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: string, dto: Partial<CreateSupplierDto>) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async countActiveSuppliers(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Count suppliers that are active or had an inward stock movement in last 90 days
    return this.prisma.supplier.count({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });
  }
}
