import { NextRequest } from 'next/server';

export const createMockRequest = (
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>
) => {
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: new Headers(headers),
  });
  if (body) {
    req.json = async () => body;
  }
  return req;
};
