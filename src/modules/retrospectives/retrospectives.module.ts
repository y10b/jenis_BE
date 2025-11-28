import { Module } from '@nestjs/common';
import { RetrospectivesController } from './retrospectives.controller';
import { RetrospectivesService } from './retrospectives.service';

@Module({
  controllers: [RetrospectivesController],
  providers: [RetrospectivesService],
  exports: [RetrospectivesService],
})
export class RetrospectivesModule {}
