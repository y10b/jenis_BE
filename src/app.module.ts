import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RetrospectivesModule } from './modules/retrospectives/retrospectives.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { AuditModule } from './modules/audit/audit.module';
import { NetworkWhitelistModule } from './modules/network-whitelist/network-whitelist.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { HttpExceptionFilter, PrismaExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';
import { JwtAuthGuard, RolesGuard } from './common/guards';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AdminModule,
    TeamsModule,
    TasksModule,
    IntegrationsModule,
    NotificationsModule,
    RetrospectivesModule,
    DashboardModule,
    SchedulesModule,
    AuditModule,
    NetworkWhitelistModule,
    AttendanceModule,
  ],
  providers: [
    // Global exception filters
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
