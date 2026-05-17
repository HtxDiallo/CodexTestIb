import { NextResponse } from "next/server";
import { bulkVoucherAction } from "@/lib/radius-store";

export async function POST(request) {
  try {
    const body = await request.json();
    return NextResponse.json(await bulkVoucherAction(body));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
