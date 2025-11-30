import { Module } from '@nestjs/common';
import { NetworkWhitelistController, IpVerificationController } from './network-whitelist.controller';
import { NetworkWhitelistService } from './network-whitelist.service';

@Module({
  controllers: [NetworkWhitelistController, IpVerificationController],
  providers: [NetworkWhitelistService],
  exports: [NetworkWhitelistService],
})
export class NetworkWhitelistModule {}
