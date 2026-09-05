import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

async function client(req: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } });
}

export async function GET(req: NextRequest) {
  const supabase = await client(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.from("excel_import_history").select("id,file_name,file_size,imported_at,status,total_rows,inserted_rows,sheets,errors,actor_id").order("imported_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ history: data || [] });
}
