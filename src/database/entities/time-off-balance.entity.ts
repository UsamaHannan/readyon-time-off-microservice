import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('time_off_balances')
@Index(['employeeId', 'locationId'], { unique: true })
export class TimeOffBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  balance: number; // Storing as days (e.g., 10.5 days)

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date;

  @VersionColumn()
  version: number; // Optimistic locking to prevent concurrent overwrite

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
