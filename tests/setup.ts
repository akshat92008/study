import { vi } from 'vitest';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

(globalThis as any).jest = vi;
