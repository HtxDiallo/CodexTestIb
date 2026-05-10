import { getVoucherCodesForExport } from "@/lib/radius-store";

function safeFilename(name) {
  return name.replace(/[^A-Z0-9_-]/gi, "_");
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const name = searchParams.get("name") || (batchId ? `lot-${batchId}` : "vouchers-freeradius");
    const codes = await getVoucherCodesForExport(batchId);
    const csv = codes.join("\n") + (codes.length ? "\n" : "");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(name)}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
