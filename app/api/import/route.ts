import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    p_module: "excel",
    p_action: "import",
  });
  if (permissionError || !allowed) {
    return NextResponse.json({ error: "Insufficient privilege" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Excel file required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Maximum 10 MB" }, { status: 413 });

  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) return NextResponse.json({ error: "Workbook contains no sheets" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  return NextResponse.json({ rows: rows.length, preview: rows.slice(0, 10) });
}
