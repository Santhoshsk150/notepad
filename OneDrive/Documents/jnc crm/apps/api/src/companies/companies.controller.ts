/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CompaniesService, CreateCompanyDto } from './companies.service';

@Controller('companies')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get()
  async getCompanies(@Query('search') search?: string) {
    return this.companiesService.findAll({ search });
  }

  @Get(':id')
  async getCompany(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles('super_admin', 'admin', 'sub_admin', 'employee')
  async createCompany(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin', 'sub_admin', 'employee')
  async updateCompany(@Param('id') id: string, @Body() dto: Partial<CreateCompanyDto>) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  async deleteCompany(@Param('id') id: string) {
    return this.companiesService.delete(id);
  }
}
