import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { TimeOffRequestsService } from './time-off-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { CreateTimeOffRequestDto, AuthenticatedRequest } from '../common/dto';

@Controller('time-off-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeOffRequestsController {
  constructor(
    private readonly timeOffRequestsService: TimeOffRequestsService,
  ) {}

  @Post()
  async createRequest(
    @Request() req: AuthenticatedRequest,
    @Body() createDto: CreateTimeOffRequestDto,
  ) {
    // Only employees create for themselves (for simplicity in this mock)
    return this.timeOffRequestsService.createRequest(req.user.id, createDto);
  }

  @Get()
  async getRequests(@Request() req: AuthenticatedRequest) {
    if (req.user.role === UserRole.EMPLOYEE) {
      // Employees only see their own
      return this.timeOffRequestsService.getRequests(req.user.id);
    } else {
      // Managers see all
      return this.timeOffRequestsService.getRequests();
    }
  }

  @Get(':id')
  async getRequestById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const request = await this.timeOffRequestsService.getRequestById(id);
    if (
      req.user.role === UserRole.EMPLOYEE &&
      request.employeeId !== req.user.id
    ) {
      throw new ForbiddenException('Cannot view other employees requests');
    }
    return request;
  }

  @Patch(':id/approve')
  @Roles(UserRole.MANAGER)
  async approveRequest(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timeOffRequestsService.approveRequest(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER)
  async rejectRequest(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timeOffRequestsService.rejectRequest(
      id,
      req.user.id,
      reason || 'No reason provided',
    );
  }
}
