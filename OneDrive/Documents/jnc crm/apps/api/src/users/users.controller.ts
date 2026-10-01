/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PageAccess } from '../auth/page-access.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ScopedUser } from '../auth/scoping.service';
import { UsersService, CreateUserDto, UpdateUserDto } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@PageAccess('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('super_admin', 'admin')
  async findAll(
    @CurrentUser() user: ScopedUser,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll(user, { search, role, isActive });
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  async findOne(@CurrentUser() user: ScopedUser, @Param('id') id: string) {
    return this.usersService.findOne(id, user);
  }

  @Post()
  @Roles('super_admin', 'admin')
  async createUser(@CurrentUser() user: ScopedUser, @Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto, user);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  async updateUser(
    @CurrentUser() user: ScopedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, dto, user);
  }

  @Post('force-reset-all')
  @Roles('super_admin')
  async forceResetAllPasswords(@CurrentUser() user: ScopedUser) {
    return this.usersService.forceResetAllPasswords(user);
  }

  @Post(':id/reset-credentials')
  @Roles('super_admin', 'admin')
  async resetCredentials(@CurrentUser() user: ScopedUser, @Param('id') id: string) {
    return this.usersService.resetCredentials(id, user);
  }

  @Patch(':id/toggle-active')
  @Roles('super_admin', 'admin')
  async toggleActive(
    @CurrentUser() user: ScopedUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    if (!body || typeof body.isActive !== 'boolean') {
      throw new BadRequestException("Property 'isActive' must be an explicit boolean value (true or false).");
    }
    return this.usersService.toggleActive(id, body.isActive, user);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  async deleteUser(@CurrentUser() user: ScopedUser, @Param('id') id: string) {
    return this.usersService.delete(id, user);
  }
}
