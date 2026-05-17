import { NextResponse } from "next/server";
import { createMacDevice, toggleMacDevice } from "@/lib/radius-store";

export async function POST(request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createMacDevice(body));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    return NextResponse.json(await toggleMacDevice(body.id));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
