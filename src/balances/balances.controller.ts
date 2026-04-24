import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@Controller('balances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get(':employeeId/:locationId')
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Request() req,
  ) {
    // Basic authorization: employees can only see their own balance
    if (req.user.role === UserRole.EMPLOYEE && req.user.id !== employeeId) {
      throw new ForbiddenException('Cannot access other employee balances');
    }
    return this.balancesService.getBalance(employeeId, locationId);
  }

  @Get(':employeeId')
  async getAllBalancesForEmployee(
    @Param('employeeId') employeeId: string,
    @Request() req,
  ) {
    if (req.user.role === UserRole.EMPLOYEE && req.user.id !== employeeId) {
      throw new ForbiddenException('Cannot access other employee balances');
    }
    return this.balancesService.getBalancesForEmployee(employeeId);
  }

  @Post('sync/batch')
  @Roles(UserRole.MANAGER)
  async syncBatch() {
    return this.balancesService.syncBatchFromHcm();
  }
}
