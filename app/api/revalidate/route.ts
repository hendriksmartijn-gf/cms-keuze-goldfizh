import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { MATRIX_TAG } from "@/lib/data.ts";

/** Sanity-webhook (bij publish van cms/criterium): POST /api/revalidate?secret=… */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ fout: "Niet toegestaan" }, { status: 401 });
  }
  revalidateTag(MATRIX_TAG, "max");
  return NextResponse.json({ ok: true, ververst: MATRIX_TAG });
}
