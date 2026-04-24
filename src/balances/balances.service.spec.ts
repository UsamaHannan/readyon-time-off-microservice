import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { TimeOffBalance } from '../database/entities/time-off-balance.entity';
import { HcmService } from '../hcm/hcm.service';

const mockBalancesRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockHcmService = () => ({
  getBatchBalances: jest.fn(),
});

describe('BalancesService', () => {
  let service: BalancesService;
  let repository: any;
  let hcmService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        {
          provide: getRepositoryToken(TimeOffBalance),
          useFactory: mockBalancesRepository,
        },
        { provide: HcmService, useFactory: mockHcmService },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
    repository = module.get(getRepositoryToken(TimeOffBalance));
    hcmService = module.get<HcmService>(HcmService);
  });

  describe('deductBalance', () => {
    it('should deduct balance if sufficient', async () => {
      const mockBalance = {
        employeeId: '1',
        locationId: '1',
        balance: 10,
        version: 1,
      };
      repository.findOne.mockResolvedValue(mockBalance);
      repository.save.mockResolvedValue({
        ...mockBalance,
        balance: 5,
        version: 2,
      });

      const result = await service.deductBalance('1', '1', 5);

      expect(repository.save).toHaveBeenCalledWith({
        employeeId: '1',
        locationId: '1',
        balance: 5,
        version: 1,
      });
      expect(result.balance).toBe(5);
    });

    it('should throw ConflictException if balance is insufficient', async () => {
      const mockBalance = {
        employeeId: '1',
        locationId: '1',
        balance: 2,
        version: 1,
      };
      repository.findOne.mockResolvedValue(mockBalance);

      await expect(service.deductBalance('1', '1', 5)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if record not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.deductBalance('1', '1', 5)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should handle optimistic locking errors (concurrent updates)', async () => {
      const mockBalance = {
        employeeId: '1',
        locationId: '1',
        balance: 10,
        version: 1,
      };
      repository.findOne.mockResolvedValue(mockBalance);
      repository.save.mockRejectedValue(new Error('OptimisticLockError')); // Simulating TypeORM error

      await expect(service.deductBalance('1', '1', 5)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('syncBatchFromHcm', () => {
    it('should update local balances with HCM data', async () => {
      hcmService.getBatchBalances.mockResolvedValue([
        { employeeId: '1', locationId: '1', balance: 15 }, // changed
        { employeeId: '2', locationId: '1', balance: 5 }, // new
      ]);

      // Mock findOne implementation to return existing for EMP 1 and null for EMP 2
      repository.findOne.mockImplementation(({ where }) => {
        if (where.employeeId === '1')
          return Promise.resolve({
            employeeId: '1',
            locationId: '1',
            balance: 10,
          });
        return Promise.resolve(null);
      });

      repository.create.mockReturnValue({
        employeeId: '2',
        locationId: '1',
        balance: 5,
      });

      const result = await service.syncBatchFromHcm();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(2);
      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledWith({
        employeeId: '2',
        locationId: '1',
        balance: 5,
        lastSyncedAt: expect.any(Date),
      });
    });

    it('should skip sync if HCM data is empty', async () => {
      hcmService.getBatchBalances.mockResolvedValue([]);
      const result = await service.syncBatchFromHcm();
      expect(result.syncedCount).toBe(0);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getBalancesForEmployee', () => {
    it('should return all balances for an employee', async () => {
      repository.find.mockResolvedValue([{ employeeId: '1', balance: 10 }]);
      const result = await service.getBalancesForEmployee('1');
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { employeeId: '1' },
      });
    });
  });

  describe('getBalance', () => {
    it('should return a specific balance', async () => {
      repository.findOne.mockResolvedValue({
        employeeId: '1',
        locationId: 'loc1',
        balance: 10,
      });
      const result = await service.getBalance('1', 'loc1');
      expect(result!.balance).toBe(10);
    });
  });
});
