import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(payload: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    previousValue?: any;
    newValue?: any;
    performedBy?: string;
  }): Promise<AuditLog | null> {
    try {
      const auditLog = this.auditRepository.create({
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action,
        previousValue: payload.previousValue
          ? JSON.stringify(payload.previousValue)
          : undefined,
        newValue: payload.newValue
          ? JSON.stringify(payload.newValue)
          : undefined,
        performedBy: payload.performedBy,
      });

      return await this.auditRepository.save(auditLog);
    } catch (error) {
      // Fire-and-forget, don't let audit logging break the main flow
      this.logger.error('Failed to save audit log', error);
      return null;
    }
  }
}
