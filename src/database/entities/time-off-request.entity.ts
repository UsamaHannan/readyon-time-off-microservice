import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export enum TimeOffType {
  SICK = 'SICK',
  CASUAL = 'CASUAL',
  ANNUAL = 'ANNUAL',
}

export enum TimeOffStatus {
  PENDING = 'PENDING',
  APPROVED_LOCALLY = 'APPROVED_LOCALLY',
  HCM_CONFIRMED = 'HCM_CONFIRMED',
  REJECTED = 'REJECTED',
  HCM_REJECTED = 'HCM_REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column({
    type: 'varchar',
  })
  type: TimeOffType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  days: number;

  @Column({
    type: 'varchar',
    default: TimeOffStatus.PENDING,
  })
  status: TimeOffStatus;

  @Column({ nullable: true })
  reviewerId: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  hcmReferenceId: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
