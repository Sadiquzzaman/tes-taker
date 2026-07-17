import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_DRIVER } from './storage.constants';
import { LocalStorageDriver } from './local-storage.driver';
import { S3StorageDriver } from './s3-storage.driver';
import { StorageService } from './storage.service';
import { StorageDriver, StorageDriverName } from './storage.types';

@Global()
@Module({
  providers: [
    LocalStorageDriver,
    S3StorageDriver,
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService, LocalStorageDriver, S3StorageDriver],
      useFactory: (
        config: ConfigService,
        local: LocalStorageDriver,
        s3: S3StorageDriver,
      ): StorageDriver => {
        const driver = (config.get<string>('STORAGE_DRIVER', 'local') ?? 'local')
          .toLowerCase() as StorageDriverName;
        return driver === 's3' ? s3 : local;
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
