import { NextResponse } from "next/server";
import { testPfSense } from "@/lib/radius-store";

export async function POST(request) {
  try {
    const body = await request.json();
    return NextResponse.json(await testPfSense(body.id));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
