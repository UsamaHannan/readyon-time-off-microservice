import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeOffRequestsService } from './time-off-requests.service';
import {
  TimeOffRequest,
  TimeOffStatus,
  TimeOffType,
} from '../database/entities/time-off-request.entity';
import { BalancesService } from '../balances/balances.service';
import { HcmService } from '../hcm/hcm.service';
import { AuditService } from '../audit/audit.service';
import { LocationsService } from '../locations/locations.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockRequestsRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

const mockBalancesService = () => ({
  getBalance: jest.fn(),
  deductBalance: jest.fn(),
  addBalance: jest.fn(),
});

const mockHcmService = () => ({
  submitTimeOff: jest.fn(),
});

const mockAuditService = () => ({
  log: jest.fn(),
});

const mockLocationsService = () => ({
  findOne: jest.fn(),
});

describe('TimeOffRequestsService', () => {
  let service: TimeOffRequestsService;
  let repository: any;
  let balancesService: any;
  let hcmService: any;
  let auditService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffRequestsService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useFactory: mockRequestsRepository,
        },
        { provide: BalancesService, useFactory: mockBalancesService },
        { provide: HcmService, useFactory: mockHcmService },
        { provide: AuditService, useFactory: mockAuditService },
        { provide: LocationsService, useFactory: mockLocationsService },
      ],
    }).compile();

    service = module.get<TimeOffRequestsService>(TimeOffRequestsService);
    repository = module.get(getRepositoryToken(TimeOffRequest));
    balancesService = module.get(BalancesService);
    hcmService = module.get(HcmService);
    auditService = module.get(AuditService);
    locationsService = module.get(LocationsService);
  });
  let locationsService: any;

  describe('createRequest', () => {
    it('should fail fast if local balance is insufficient', async () => {
      locationsService.findOne.mockResolvedValue({ id: 'loc1' });
      balancesService.getBalance.mockResolvedValue({ balance: 1 });

      await expect(
        service.createRequest('emp1', {
          locationId: 'loc1',
          days: 2,
          type: TimeOffType.ANNUAL,
          startDate: '2025-01-01',
          endDate: '2025-01-02',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should fail if location does not exist', async () => {
      locationsService.findOne.mockResolvedValue(null);

      await expect(
        service.createRequest('emp1', {
          locationId: 'non-existent',
          days: 1,
          type: TimeOffType.ANNUAL,
          startDate: '2025-01-01',
          endDate: '2025-01-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create pending request if balance is sufficient', async () => {
      locationsService.findOne.mockResolvedValue({ id: 'loc1' });
      balancesService.getBalance.mockResolvedValue({ balance: 5 });
      const mockReq = {
        id: 'req1',
        employeeId: 'emp1',
        days: 2,
        status: TimeOffStatus.PENDING,
      };
      repository.create.mockReturnValue(mockReq);
      repository.save.mockResolvedValue(mockReq);

      const result = await service.createRequest('emp1', {
        locationId: 'loc1',
        days: 2,
        type: TimeOffType.ANNUAL,
        startDate: '2025-01-01',
        endDate: '2025-01-02',
      });

      expect(result).toEqual(mockReq);
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('approveRequest', () => {
    it('should approve, deduct balance, and sync to HCM successfully', async () => {
      const mockReq = {
        id: 'req1',
        employeeId: 'emp1',
        locationId: 'loc1',
        days: 2,
        status: TimeOffStatus.PENDING,
        hcmReferenceId: '',
      };
      repository.findOne.mockResolvedValue(mockReq);
      balancesService.deductBalance.mockResolvedValue(true);
      hcmService.submitTimeOff.mockResolvedValue({
        success: true,
        hcmReferenceId: 'HCM-123',
      });

      await service.approveRequest('req1', 'mgr1');

      expect(balancesService.deductBalance).toHaveBeenCalledWith(
        'emp1',
        'loc1',
        2,
      );
      expect(hcmService.submitTimeOff).toHaveBeenCalled();
      expect(mockReq.status).toBe(TimeOffStatus.HCM_CONFIRMED);
      expect(mockReq.hcmReferenceId).toBe('HCM-123');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should rollback balance if HCM rejects the request', async () => {
      const mockReq = {
        id: 'req1',
        employeeId: 'emp1',
        locationId: 'loc1',
        days: 2,
        status: TimeOffStatus.PENDING,
        rejectionReason: '',
      };
      repository.findOne.mockResolvedValue(mockReq);
      balancesService.deductBalance.mockResolvedValue(true);
      hcmService.submitTimeOff.mockResolvedValue({
        success: false,
        error: 'Invalid dates',
      });

      await service.approveRequest('req1', 'mgr1');

      expect(balancesService.deductBalance).toHaveBeenCalled();
      expect(hcmService.submitTimeOff).toHaveBeenCalled();
      expect(mockReq.status).toBe(TimeOffStatus.HCM_REJECTED);
      expect(mockReq.rejectionReason).toBe('Invalid dates');
      expect(balancesService.addBalance).toHaveBeenCalledWith(
        'emp1',
        'loc1',
        2,
      ); // Rollback
    });

    it('should throw error if request is not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.approveRequest('none', 'mgr1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if request is already processed', async () => {
      const mockReq = {
        id: 'req1',
        status: TimeOffStatus.HCM_CONFIRMED,
      };
      repository.findOne.mockResolvedValue(mockReq);
      await expect(service.approveRequest('req1', 'mgr1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle concurrency conflicts during deduction', async () => {
      const mockReq = {
        id: 'req1',
        employeeId: 'emp1',
        locationId: 'loc1',
        days: 2,
        status: TimeOffStatus.PENDING,
      };
      repository.findOne.mockResolvedValue(mockReq);
      // Simulate another process taking the balance just before we do
      balancesService.deductBalance.mockRejectedValue(
        new Error('OptimisticLockError'),
      );

      await expect(service.approveRequest('req1', 'mgr1')).rejects.toThrow(
        'OptimisticLockError',
      );
      expect(hcmService.submitTimeOff).not.toHaveBeenCalled();
    });
  });
});
