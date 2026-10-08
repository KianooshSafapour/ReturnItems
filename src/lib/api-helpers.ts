import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleApiError(e: unknown) {
  if (e instanceof AuthError) return jsonError(e.message, e.status);
  console.error("[api-error]", e);
  const msg = e instanceof Error ? e.message : "خطای داخلی سرور";
  return jsonError(msg.startsWith("خطا") ? msg : "خطای داخلی سرور رخ داد", 500);
}
