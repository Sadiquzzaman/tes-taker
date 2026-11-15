import { Repository } from 'typeorm';
import { AuditService } from 'src/audit/audit.service';
import { IeltsBandTableEntity } from './entities/ielts-band-table.entity';
import { IeltsBandTablesService } from './ielts-band-tables.service';
import { IeltsProfilesService } from './ielts-profiles.service';

describe('IeltsBandTablesService at start-up', () => {
  it('keeps the API starting when the table is not there yet (migrations run after a deploy starts)', async () => {
    const tables = { exists: jest.fn().mockRejectedValue(new Error('relation "ielts_band_tables" does not exist')) } as unknown as Repository<IeltsBandTableEntity>;
    const service = new IeltsBandTablesService(tables, {} as IeltsProfilesService, {} as AuditService);
    const warn = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn').mockImplementation(() => undefined);
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });
});
