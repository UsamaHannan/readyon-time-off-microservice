import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from '../database/entities/time-off-request.entity';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequestsController } from './time-off-requests.controller';
import { BalancesModule } from '../balances/balances.module';
import { HcmModule } from '../hcm/hcm.module';
import { AuditModule } from '../audit/audit.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    BalancesModule,
    HcmModule,
    AuditModule,
    LocationsModule,
  ],
  providers: [TimeOffRequestsService],
  controllers: [TimeOffRequestsController],
})
export class TimeOffRequestsModule {}
