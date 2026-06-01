export type RagMode = 'explicit' | 'implicit' | 'off';

export type EvidenceStrength = 'high' | 'medium' | 'low' | 'none';

export interface StudyMaterial {
  id: string;
  user_id: string;
  title: string;
  original_filename: string | null;
  mime_type: string;
  storage_path: string | null;
  source_type: string;
  exam_type: string | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  language: string;
  status: 'uploaded' | 'processing' | 'ready' | 'failed' | 'archived';
  page_count: number | null;
  char_count: number | null;
  content_hash: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface RagChunk {
  id: string;
  materialId: string;
  materialTitle: string;
  sourceType: string | null;
  subject: string | null;
  chapter: string | null;
  heading: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
  score: number;
}

export interface RagContext {
  mode: RagMode;
  chunks: RagChunk[];
  materialIds: string[];
  chunkIds: string[];
  totalContextChars: number;
  grounded: boolean;
  evidenceStrength: EvidenceStrength;
  warnings: string[];
}

export interface RagRetrieveInput {
  userId: string;
  query: string;
  mode?: RagMode;
  materialIds?: string[];
  subject?: string;
  chapter?: string;
  topK?: number;
  maxContextChars?: number;
}

export interface ExtractedPage {
  pageNumber: number | null;
  text: string;
}

export interface ExtractedDocument {
  text: string;
  pages: ExtractedPage[];
  pageCount: number | null;
}

export interface ChunkInput {
  text: string;
  pageNumber?: number | null;
  heading?: string | null;
}

export interface StudyChunk {
  chunkIndex: number;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
  heading: string | null;
  tokenEstimate: number;
  contentHash: string;
}
