import { vi } from 'vitest';
import * as dotenv from 'dotenv';

import fs from 'fs';
const envPath = fs.existsSync('.env.test') ? '.env.test' : '.env.local';
dotenv.config({ path: envPath });

(globalThis as any).jest = vi;
