import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";

const MAX = 10 * 1024 * 1024;
const SPECS: Record<string, { table: string; permission: [string,string]; amount?: string; key: (r:any)=>string }> = {
  income: { table: "income", permission: ["income","view"], amount: "amount", key: r => `${r.date}|${String(r.contributor||"").trim().toLowerCase()}|${String(r.flat_no||"").trim().toLowerCase()}|${Number(r.amount||0).toFixed(2)}|${String(r.reference||"").trim().toLowerCase()}` },
  expenses: { table: "expenses", permission: ["expenses","view"], amount: "gross_amount", key: r => `${r.date}|${String(r.requisition_no||"").trim().toLowerCase()}|${String(r.vendor||"").trim().toLowerCase()}|${Number(r.gross_amount||0).toFixed(2)}` },
  fund_transfers: { table: "fund_transfers", permission: ["bank_transfers","view"], amount: "amount", key: r => `${r.date}|${String(r.requisition_no||"").trim().toLowerCase()}|${String(r.particulars||"").trim().toLowerCase()}|${Number(r.amount||0).toFixed(2)}|${String(r.direction||"").trim().toUpperCase()}` },
  tds_payments: { table: "tds_payments", permission: ["expenses","view"], amount: "amount", key: r => `${r.date}|${String(r.challan_no||"").trim().toLowerCase()}|${Number(r.amount||0).toFixed(2)}` },
};

async function client(req: NextRequest) { return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }); }
function norm(raw:any) { const r:any={}; Object.keys(raw||{}).forEach(k=>r[String(k).trim().toLowerCase()]=raw[k]); return r; }
function num(v:any) { const n=Number(v); return Number.isFinite(n)?n:0; }

export async function POST(req: NextRequest) {
  const supabase = await client(req); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required"},{status:401});
  const form=await req.formData(); const file=form.get("file");
  if(!(file instanceof File)) return NextResponse.json({error:"Excel file required"},{status:400});
  if(file.size>MAX) return NextResponse.json({error:"Maximum file size is 10 MB"},{status:413});
  let wb:XLSX.WorkBook; try { wb=XLSX.read(Buffer.from(await file.arrayBuffer()),{type:"buffer",cellDates:true}); } catch { return NextResponse.json({error:"Invalid Excel workbook"},{status:400}); }
  const results:any[]=[];
  for(const sheetName of wb.SheetNames){
    const key=sheetName.trim().toLowerCase(); const spec=SPECS[key]; if(!spec) continue;
    const {data:allowed}=await supabase.rpc("has_permission",{p_module:spec.permission[0],p_action:spec.permission[1]}); if(!allowed) continue;
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{defval:""}).map(norm);
    const unique=new Set<string>(); let duplicateRows=0; rows.forEach(r=>{const k=spec.key(r); if(unique.has(k)) duplicateRows++; else unique.add(k);});
    let query:any=supabase.from(spec.table).select("*"); if (spec.table !== "tds_payments") query=query.is("deleted_at",null);
    const {data,error}=await query.limit(10000); if(error){results.push({sheet:key,error:error.message});continue;}
    const dbKeys=new Set((data||[]).map((r:any)=>spec.key(r))); const matched=rows.filter(r=>dbKeys.has(spec.key(r))).length;
    const workbookTotal=spec.amount?rows.reduce((s,r)=>s+num(r[spec.amount!]),0):0;
    const databaseTotal=spec.amount?(data||[]).reduce((s:number,r:any)=>s+num(r[spec.amount!]),0):0;
    results.push({sheet:key,workbookRows:rows.length,databaseRows:(data||[]).length,matchedRows:matched,newRows:Math.max(0,rows.length-duplicateRows-matched),duplicateRows,workbookTotal:Number(workbookTotal.toFixed(2)),databaseTotal:Number(databaseTotal.toFixed(2)),difference:Number((workbookTotal-databaseTotal).toFixed(2))});
  }
  if(!results.length) return NextResponse.json({error:"No permitted reconciliation sheets found"},{status:403});
  return NextResponse.json({fileName:file.name,results});
}
