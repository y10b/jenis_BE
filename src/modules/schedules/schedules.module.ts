import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { ScheduleRunnerService } from './schedule-runner.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleRunnerService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
