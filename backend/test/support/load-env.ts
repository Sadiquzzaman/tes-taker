import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Test values win over anything in the shell, so a test can never reach a real database or service.
dotenv.config({ path: resolve(__dirname, '../test.env'), override: true, quiet: true });
