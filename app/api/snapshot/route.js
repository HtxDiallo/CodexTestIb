import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/radius-store";

export async function GET() {
  try {
    return NextResponse.json(await getSnapshot());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
