import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './entities/audit-log.entity';

/**
 * The audit log (design §8.10). Global, so any module can inject AuditService without importing
 * this module (and without an import cycle with the modules it reads, like organisations).
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]),
    // OrganizationContextGuard for the organisation's own log.
    OrganizationsModule,
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
