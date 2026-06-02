// lib/ai/providers/LLMProvider.ts

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMProvider {
  /** Generate a full response given messages */
  generate(messages: LLMMessage[], options?: {
    userId?: string;
    maxTokens?: number;
    temperature?: number;
    /** optional streaming flag */
    streaming?: boolean;
  }): Promise<string>;

  /** Stream response token by token or chunk */
  stream(messages: LLMMessage[], options?: {
    userId?: string;
    maxTokens?: number;
    temperature?: number;
  }): AsyncIterable<string>;

  /** Capabilities of the provider */
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsAudio: boolean;
  maxContextTokens: number;
}
