// services/chat-memory.service.ts
// ⚠️  TOMBSTONE — DO NOT USE ⚠️
// This file previously wrote to `chat_memory_embeddings` which does not exist in the schema.
// The correct service is at lib/services/chatMemoryService.ts (writes to `chat_memory`).
// This file is kept as a tombstone to prevent accidental re-creation.
// If you see this imported anywhere, redirect the import to:
//   import { ChatMemoryService } from '@/lib/services/chatMemoryService';

export class ChatMemoryService {
  constructor() {
    throw new Error(
      'WRONG ChatMemoryService: import from @/lib/services/chatMemoryService instead. ' +
      'This file (services/chat-memory.service.ts) targets a nonexistent table and must not be used.'
    );
  }
}
