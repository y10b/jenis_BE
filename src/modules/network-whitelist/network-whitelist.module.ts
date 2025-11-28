import { Module } from '@nestjs/common';
import { NetworkWhitelistController } from './network-whitelist.controller';
import { NetworkWhitelistService } from './network-whitelist.service';

@Module({
  controllers: [NetworkWhitelistController],
  providers: [NetworkWhitelistService],
  exports: [NetworkWhitelistService],
})
export class NetworkWhitelistModule {}
