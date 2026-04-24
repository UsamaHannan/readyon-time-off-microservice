import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  SYNC = 'SYNC',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column({
    type: 'varchar',
  })
  action: AuditAction;

  @Column({ type: 'text', nullable: true })
  previousValue: string; // Store as JSON string

  @Column({ type: 'text', nullable: true })
  newValue: string; // Store as JSON string

  @Column({ nullable: true })
  performedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
