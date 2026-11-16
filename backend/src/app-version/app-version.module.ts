import { Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller';

/** The mobile app's version check (PM-03). */
@Module({ controllers: [AppVersionController] })
export class AppVersionModule {}
