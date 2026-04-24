import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffBalance } from '../database/entities/time-off-balance.entity';
import { HcmService } from '../hcm/hcm.service';

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(
    @InjectRepository(TimeOffBalance)
    private balancesRepository: Repository<TimeOffBalance>,
    private hcmService: HcmService,
  ) {}

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<TimeOffBalance | null> {
    return this.balancesRepository.findOne({
      where: { employeeId, locationId },
    });
  }

  async getBalancesForEmployee(employeeId: string): Promise<TimeOffBalance[]> {
    return this.balancesRepository.find({
      where: { employeeId },
    });
  }

  async deductBalance(
    employeeId: string,
    locationId: string,
    daysToDeduct: number,
  ): Promise<TimeOffBalance> {
    const balance = await this.getBalance(employeeId, locationId);
    if (!balance || balance.balance < daysToDeduct) {
      throw new ConflictException('Insufficient local shadow balance');
    }

    // We deduct locally first, relying on optimistic locking
    balance.balance -= daysToDeduct;

    try {
      return await this.balancesRepository.save(balance);
    } catch (error) {
      // Handle concurrent update error
      this.logger.error(
        `Concurrent update on balance for ${employeeId}`,
        error,
      );
      throw new ConflictException(
        'Balance was updated concurrently, please retry',
      );
    }
  }

  async addBalance(
    employeeId: string,
    locationId: string,
    daysToAdd: number,
  ): Promise<TimeOffBalance> {
    const balance = await this.getBalance(employeeId, locationId);
    if (!balance) {
      throw new ConflictException('Balance record not found');
    }
    balance.balance += daysToAdd;
    return this.balancesRepository.save(balance);
  }

  async syncBatchFromHcm(): Promise<{ success: boolean; syncedCount: number }> {
    this.logger.log('Starting batch sync from HCM');
    try {
      const hcmBalances = await this.hcmService.getBatchBalances();

      let syncedCount = 0;
      for (const hcmBalance of hcmBalances) {
        const localBalance = await this.getBalance(
          hcmBalance.employeeId,
          hcmBalance.locationId,
        );

        try {
          if (localBalance) {
            // Update if changed
            if (localBalance.balance !== hcmBalance.balance) {
              localBalance.balance = hcmBalance.balance;
              localBalance.lastSyncedAt = new Date();
              await this.balancesRepository.save(localBalance);
              syncedCount++;
            }
          } else {
            // Create new record
            const newBalance = this.balancesRepository.create({
              employeeId: hcmBalance.employeeId,
              locationId: hcmBalance.locationId,
              balance: hcmBalance.balance,
              lastSyncedAt: new Date(),
            });
            await this.balancesRepository.save(newBalance);
            syncedCount++;
          }
        } catch (innerError) {
          this.logger.warn(
            `Failed to sync balance for ${hcmBalance.employeeId} at ${hcmBalance.locationId}. Skipping. Error: ${innerError.message}`,
          );
        }
      }

      this.logger.log(`Batch sync completed. Updated ${syncedCount} records.`);
      return { success: true, syncedCount };
    } catch (error) {
      this.logger.error('Batch sync failed', error.stack);
      return { success: false, syncedCount: 0 };
    }
  }
}
