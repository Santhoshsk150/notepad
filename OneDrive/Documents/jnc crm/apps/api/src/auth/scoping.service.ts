/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Injectable } from '@nestjs/common';

export interface ScopedUser {
  id: string;
  employeeCode: string;
  role: string;
  teamId?: string | null;
  warehouseId?: string | null;
}

@Injectable()
export class ScopingService {
  /**
   * Generates Prisma `where` clause for Leads based on the user's role and scoping
   */
  getLeadScope(user: ScopedUser) {
    if (user.role === 'super_admin' || user.role === 'admin') {
      return {}; // Org-wide access
    }

    if (user.role === 'sub_admin') {
      if (user.teamId) {
        return {
          OR: [
            { assignedTo: { teamId: user.teamId } },
            { assignedToId: user.id },
            { assignedToId: null },
          ],
        };
      }
      return {};
    }

    // Employee / Sales Rep: Assigned leads OR leads shared with them
    return {
      OR: [
        { assignedToId: user.id },
        { shares: { some: { userId: user.id } } },
      ],
    };
  }

  /**
   * Generates Prisma `where` clause for Orders based on role and scoping
   */
  getOrderScope(user: ScopedUser) {
    if (user.role === 'super_admin' || user.role === 'admin') {
      return {};
    }

    if (user.role === 'sub_admin') {
      return {};
    }

    // Employee: Only orders created by them
    return {
      createdById: user.id,
    };
  }

  /**
   * Generates Prisma `where` clause for Inventory / Stock Movements based on warehouse
   */
  getInventoryScope(user: ScopedUser) {
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'store_manager') {
      return {}; // Store manager / Admins see all inventory & store stock
    }

    if (user.role === 'sub_admin' && user.warehouseId) {
      return {
        warehouseId: user.warehouseId,
      };
    }

    return {};
  }
}
