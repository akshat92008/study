// sourceType: 'tutor_chat'
export const maxDuration = 60;

import type { NextRequest } from 'next/server';
import { GET as chatGET, POST as chatPOST } from '../chat/route';

export async function GET(request: NextRequest) {
  return chatGET(request);
}

export async function POST(request: NextRequest) {
  return chatPOST(request);
}
