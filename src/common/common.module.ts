import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoUtil } from './utils/crypto.util';

@Global()
@Module({
  providers: [
    {
      provide: CryptoUtil,
      useFactory: (configService: ConfigService) => {
        const encryptionKey = configService.get<string>('encryption.key') || '';
        return new CryptoUtil(encryptionKey);
      },
      inject: [ConfigService],
    },
  ],
  exports: [CryptoUtil],
})
export class CommonModule {}
