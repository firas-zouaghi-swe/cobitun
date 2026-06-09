import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';

export async function validateJsonBody<T>(request: NextRequest, schema: ZodSchema<T>): Promise<T | NextResponse> {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }
    return parsed.data;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}

export function validationErrorResponse(message = 'Invalid payload') {
  return NextResponse.json({ error: message }, { status: 400 });
}

export default { validateJsonBody, validationErrorResponse };

