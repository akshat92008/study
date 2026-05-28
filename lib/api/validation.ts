import { z } from "zod";

export async function validateRequest<T>(schema: z.Schema<T>, request: Request): Promise<T> {
  const json = await request.json();
  return schema.parse(json);
}
