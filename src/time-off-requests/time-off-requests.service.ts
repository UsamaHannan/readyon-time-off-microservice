import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TimeOffRequest,
  TimeOffStatus,
} from '../database/entities/time-off-request.entity';
import { BalancesService } from '../balances/balances.service';
import { HcmService } from '../hcm/hcm.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { LocationsService } from '../locations/locations.service';
import { CreateTimeOffRequestDto } from '../common/dto';

@Injectable()
export class TimeOffRequestsService {
  private readonly logger = new Logger(TimeOffRequestsService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private requestsRepository: Repository<TimeOffRequest>,
    private balancesService: BalancesService,
    private hcmService: HcmService,
    private auditService: AuditService,
    private locationsService: LocationsService,
  ) {}

  async createRequest(
    employeeId: string,
    payload: CreateTimeOffRequestDto,
  ): Promise<TimeOffRequest> {
    const { locationId, type, startDate, endDate, days } = payload;

    // 0. Check if location exists (Defensive Dimension Check)
    const location = await this.locationsService.findOne(locationId);
    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }

    // 1. Check local shadow balance first to fail fast
    const balance = await this.balancesService.getBalance(
      employeeId,
      locationId,
    );
    if (!balance || balance.balance < days) {
      throw new BadRequestException('Insufficient local time-off balance');
    }

    // 2. Create pending request
    const request = this.requestsRepository.create({
      employeeId,
      locationId,
      type,
      startDate,
      endDate,
      days,
      status: TimeOffStatus.PENDING,
    });

    const savedRequest = await this.requestsRepository.save(request);

    await this.auditService.log({
      entityType: 'TimeOffRequest',
      entityId: savedRequest.id,
      action: AuditAction.CREATE,
      newValue: savedRequest,
      performedBy: employeeId,
    });

    return savedRequest;
  }

  async getRequests(employeeId?: string): Promise<TimeOffRequest[]> {
    if (employeeId) {
      return this.requestsRepository.find({ where: { employeeId } });
    }
    return this.requestsRepository.find();
  }

  async getRequestById(id: string): Promise<TimeOffRequest> {
    const request = await this.requestsRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async approveRequest(
    id: string,
    reviewerId: string,
  ): Promise<TimeOffRequest> {
    const request = await this.getRequestById(id);

    if (request.status !== TimeOffStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve request in status ${request.status}`,
      );
    }

    const previousStatus = request.status;

    // 1. Deduct from local shadow balance (with optimistic locking)
    await this.balancesService.deductBalance(
      request.employeeId,
      request.locationId,
      request.days,
    );

    // 2. Mark locally approved
    request.status = TimeOffStatus.APPROVED_LOCALLY;
    request.reviewerId = reviewerId;
    request.reviewedAt = new Date();
    await this.requestsRepository.save(request);

    // 3. Sync to HCM
    try {
      const hcmResult = await this.hcmService.submitTimeOff({
        employeeId: request.employeeId,
        locationId: request.locationId,
        days: request.days,
        type: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
      });

      if (hcmResult.success) {
        request.status = TimeOffStatus.HCM_CONFIRMED;
        request.hcmReferenceId = hcmResult.hcmReferenceId || '';
        await this.requestsRepository.save(request);
      } else {
        // HCM rejected it (e.g. invalid dates)
        this.logger.warn(`HCM rejected request ${id}: ${hcmResult.error}`);
        request.status = TimeOffStatus.HCM_REJECTED;
        request.rejectionReason = hcmResult.error || 'Unknown error from HCM';
        await this.requestsRepository.save(request);

        // Rollback local balance
        await this.balancesService.addBalance(
          request.employeeId,
          request.locationId,
          request.days,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to sync request ${id} to HCM`, error);
      // Depending on requirements, we might leave it as APPROVED_LOCALLY to retry later,
      // or reject it. We will leave it as APPROVED_LOCALLY for async retry.
    }

    await this.auditService.log({
      entityType: 'TimeOffRequest',
      entityId: request.id,
      action: AuditAction.STATUS_CHANGE,
      previousValue: { status: previousStatus },
      newValue: { status: request.status },
      performedBy: reviewerId,
    });

    return request;
  }

  async rejectRequest(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<TimeOffRequest> {
    const request = await this.getRequestById(id);

    if (request.status !== TimeOffStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject request in status ${request.status}`,
      );
    }

    const previousStatus = request.status;
    request.status = TimeOffStatus.REJECTED;
    request.reviewerId = reviewerId;
    request.reviewedAt = new Date();
    request.rejectionReason = reason;

    const savedRequest = await this.requestsRepository.save(request);

    await this.auditService.log({
      entityType: 'TimeOffRequest',
      entityId: request.id,
      action: AuditAction.STATUS_CHANGE,
      previousValue: { status: previousStatus },
      newValue: { status: request.status },
      performedBy: reviewerId,
    });

    return savedRequest;
  }
}
