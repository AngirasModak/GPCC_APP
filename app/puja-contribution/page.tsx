"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type Unit={id:string;flat_no:string;flat_type:"HIG"|"MIG"|"LIG"|null;owner_name:string;has_tenant:boolean;tenant_name:string|null;is_active:boolean};
type Income={id:string;date:string;contributor:string;flat_no:string|null;amount:number;status:string;contributor_source:string|null;event_id:string|null;income_type_id:string|null;income_category_id:string|null};
type Event={id:string;name:string;is_active:boolean};
type Policy={id?:string;event_id:string;flat_type:"HIG"|"MIG"|"LIG";standard_amount:number;early_payment_discount:number;discount_deadline:string|null;is_active:boolean};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));
const COLORS=["#7c3aed","#059669","#f59e0b","#ef4444"];
const key=(s:string)=>String(s||"").trim().toLowerCase();
export default function PujaContribution(){
 const [loading,setLoading]=useState(true),[units,setUnits]=useState<Unit[]>([]),[income,setIncome]=useState<Income[]>([]),[events,setEvents]=useState<Event[]>([]),[policies,setPolicies]=useState<Policy[]>([]),[eventId,setEventId]=useState(""),[type,setType]=useState("All"),[source,setSource]=useState("All"),[ownerMode,setOwnerMode]=useState("All"),[msg,setMsg]=useState("");
 const load=async()=>{setLoading(true);const [u,i,e,p,t,c]=await Promise.all([
  supabase.from("residential_units").select("*").eq("is_active",true),supabase.from("income").select("*").is("deleted_at",null).eq("status","Cleared"),supabase.from("events").select("id,name,is_active").order("name"),supabase.from("puja_contribution_policies").select("*"),supabase.from("income_types").select("id,name"),supabase.from("income_categories").select("id,name")]);
 if(u.error||i.error||e.error||p.error){setMsg([u.error,i.error,e.error,p.error].filter(Boolean).map((x:any)=>x.message).join(" | "));} setUnits((u.data||[]) as Unit[]); const pujaTypeIds=new Set((t.data||[]).filter((x:any)=>key(x.name)==="puja contribution").map((x:any)=>x.id)); const pujaCatIds=new Set((c.data||[]).filter((x:any)=>key(x.name)==="durga puja").map((x:any)=>x.id)); setIncome(((i.data||[]) as Income[]).filter(x=>pujaTypeIds.size===0||pujaTypeIds.has(x.income_type_id||"")||pujaCatIds.has(x.income_category_id||"")));setEvents((e.data||[]) as Event[]);setPolicies((p.data||[]) as Policy[]); const d=(e.data||[]).find((x:any)=>x.name==="Durga Puja 2026")||(e.data||[]).find((x:any)=>x.is_active); if(!eventId&&d)setEventId(d.id);setLoading(false)};
 useEffect(()=>{void load()},[]);
 const eventIncome=useMemo(()=>income.filter(x=>!eventId||x.event_id===eventId),[income,eventId]);
 const ownerCounts=useMemo(()=>{const m=new Map<string,number>();units.forEach(u=>m.set(key(u.owner_name),(m.get(key(u.owner_name))||0)+1));return m},[units]);
 const rows=useMemo(()=>units.filter(u=>(type==="All"||u.flat_type===type)&& (ownerMode==="All"||(ownerMode==="Multiple"?(ownerCounts.get(key(u.owner_name))||0)>1:(ownerCounts.get(key(u.owner_name))||0)<=1))).map(u=>{
   const pol=policies.find(p=>p.event_id===eventId&&p.flat_type===u.flat_type&&p.is_active);
   const standard=Number(pol?.standard_amount||0),discount=Number(pol?.early_payment_discount||0),deadline=pol?.discount_deadline||null;
   const payments=eventIncome.filter(x=>x.flat_no===u.flat_no).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

   // Manual/legacy entries often store contributor_source as "Resident".
   // Resolve Owner vs Tenant primarily from the contributor name, then from an
   // explicit Owner/Tenant source, and only then from current unit occupancy.
   const paymentSource=(x:Income):"Owner"|"Tenant"=>{
     const contributor=key(x.contributor);
     const owner=key(u.owner_name);
     const tenant=key(u.tenant_name||"");
     if(tenant&&contributor===tenant) return "Tenant";
     if(owner&&contributor===owner) return "Owner";
     const declared=key(x.contributor_source);
     if(declared==="tenant") return "Tenant";
     if(declared==="owner") return "Owner";
     return u.has_tenant ? "Tenant" : "Owner";
   };
   const paidOwner=payments.filter(x=>paymentSource(x)==="Owner").reduce((s,x)=>s+Number(x.amount||0),0);
   const paidTenant=payments.filter(x=>paymentSource(x)==="Tenant").reduce((s,x)=>s+Number(x.amount||0),0);
   const paid=paidOwner+paidTenant;
   const actualSource=paidTenant>paidOwner?"Tenant":paidOwner>0?"Owner":(u.has_tenant?"Tenant":"Owner");
   const first=payments[0]?.date||null;
   const before=deadline&&first?String(first)<=String(deadline):false;
   const discountEligible=!!deadline&&paid>=standard-discount&&before;
   const availed=discountEligible?discount:0;
   const net=standard-availed;
   const outstanding=Math.max(0,net-paid);
   const status=paid<=0?"Unpaid":outstanding>0.01?"Partial":"Paid";
   return {...u,standard,discount,availed,net,paid,paidOwner,paidTenant,outstanding,status,source:actualSource,payments,flatCount:ownerCounts.get(key(u.owner_name))||1};
 }).filter(r=>source==="All"||r.source===source),[units,type,ownerMode,policies,eventId,eventIncome,ownerCounts,source]);
 const kpi=useMemo(()=>({gross:rows.reduce((s,r)=>s+r.standard,0),discount:rows.reduce((s,r)=>s+r.availed,0),net:rows.reduce((s,r)=>s+r.net,0),paid:rows.reduce((s,r)=>s+r.paid,0),out:rows.reduce((s,r)=>s+r.outstanding,0),paidFlats:rows.filter(r=>r.status==="Paid").length,partial:rows.filter(r=>r.status==="Partial").length,unpaid:rows.filter(r=>r.status==="Unpaid").length}),[rows]);
 const byType=["HIG","MIG","LIG"].map(name=>{const x=rows.filter(r=>r.flat_type===name);return {name,Collected:x.reduce((s,r)=>s+r.paid,0),Outstanding:x.reduce((s,r)=>s+r.outstanding,0),"Collection %":x.reduce((s,r)=>s+r.net,0)?Math.round(x.reduce((s,r)=>s+r.paid,0)/x.reduce((s,r)=>s+r.net,0)*100):0};});
 const bySource=["Owner","Tenant"].map(name=>{
   const x=rows.filter(r=>r.source===name);
   return {name,value:x.reduce((s,r)=>s+(name==="Tenant"?r.paidTenant:r.paidOwner),0),flats:x.length};
 });
 const multi=useMemo(()=>{const map=new Map<string,any>();rows.forEach(r=>{const x=map.get(key(r.owner_name))||{owner:r.owner_name,flats:0,gross:0,paid:0,out:0};x.flats++;x.gross+=r.standard;x.paid+=r.paid;x.out+=r.outstanding;map.set(key(r.owner_name),x)});return [...map.values()].filter(x=>x.flats>1).sort((a,b)=>b.out-a.out)},[rows]);
 const policyFor=(ft:"HIG"|"MIG"|"LIG")=>policies.find(p=>p.event_id===eventId&&p.flat_type===ft)||{event_id:eventId,flat_type:ft,standard_amount:0,early_payment_discount:0,discount_deadline:null,is_active:true};
 const savePolicy=async(ft:"HIG"|"MIG"|"LIG")=>{const p=policyFor(ft);if(!eventId){setMsg("Select an event first.");return;}const payload={...p,event_id:eventId,flat_type:ft,standard_amount:Number(p.standard_amount),early_payment_discount:Number(p.early_payment_discount),discount_deadline:p.discount_deadline||null,is_active:true};delete (payload as any).id;const {error}=await supabase.from("puja_contribution_policies").upsert(payload,{onConflict:"event_id,flat_type"});setMsg(error?error.message:"Contribution policy saved.");if(!error)void load()};
 const updatePolicy=(ft:"HIG"|"MIG"|"LIG",field:string,value:any)=>setPolicies(ps=>{const found=ps.find(p=>p.event_id===eventId&&p.flat_type===ft);if(found)return ps.map(p=>p===found?{...p,[field]:value}:p);return [...ps,{event_id:eventId,flat_type:ft,standard_amount:0,early_payment_discount:0,discount_deadline:null,is_active:true,[field]:value} as Policy]});
 if(loading)return <div className="card">Loading Puja Contribution Intelligence…</div>;
 return <>
 <div className="pageHead"><div><h1>🪔 Puja Contribution Intelligence</h1><p className="muted">Flat-level collection, early-payment discount, resident/tenant and multi-flat owner analytics.</p></div><button className="btn secondary" onClick={()=>void load()}>Refresh</button></div>
 <div className="card" style={{marginBottom:16}}><div className="formGrid"><label>Event<select className="input" value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Flat Type<select className="input" value={type} onChange={e=>setType(e.target.value)}><option>All</option><option>HIG</option><option>MIG</option><option>LIG</option></select></label><label>Contributor<select className="input" value={source} onChange={e=>setSource(e.target.value)}><option>All</option><option>Owner</option><option>Tenant</option></select></label><label>Owner Portfolio<select className="input" value={ownerMode} onChange={e=>setOwnerMode(e.target.value)}><option value="All">All Owners</option><option value="Multiple">Multiple Flats</option><option value="Single">Single Flat</option></select></label></div></div>
 {msg&&<div className="card" style={{marginBottom:16,color:"#b42318"}}>{msg}</div>}
 <div className="grid" style={{marginBottom:16}}>{[["Gross Expected",kpi.gross],["Discount Availed",kpi.discount],["Net Expected",kpi.net],["Collected",kpi.paid],["Outstanding",kpi.out],["Collection %",kpi.net?`${(kpi.paid/kpi.net*100).toFixed(1)}%`:"—"]].map(([a,b])=><div className="card" key={String(a)}><div className="muted">{a}</div><div className="metric">{typeof b==="number"?money(b):b}</div></div>)}</div>
 <div className="grid" style={{marginBottom:16}}><div className="card"><h3>HIG / MIG / LIG Collection</h3><div style={{height:300}}><ResponsiveContainer width="100%" height="100%"><BarChart data={byType}><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(v:any)=>money(Number(v))}/><Legend/><Bar dataKey="Collected" fill="#059669"/><Bar dataKey="Outstanding" fill="#ef4444"/></BarChart></ResponsiveContainer></div></div><div className="card"><h3>Owner vs Tenant Contribution</h3><div style={{height:300}}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bySource} dataKey="value" nameKey="name" outerRadius={90} label>{bySource.map((x,i)=><Cell key={x.name} fill={COLORS[i]}/>)}</Pie><Tooltip formatter={(v:any)=>money(Number(v))}/><Legend/></PieChart></ResponsiveContainer></div></div></div>
 <div className="card" style={{marginBottom:16}}><h3>Contribution Policy & Early-Payment Discount</h3><p className="muted">Configure the standard contribution per flat and the discount available when the qualifying payment is received on/before the deadline.</p><div className="tableWrap"><table className="table"><thead><tr><th>Flat Type</th><th>Standard Contribution / Flat</th><th>Early Payment Discount</th><th>Discount Deadline</th><th>Net Early Amount</th><th></th></tr></thead><tbody>{(["HIG","MIG","LIG"] as const).map(ft=>{const p=policyFor(ft);return <tr key={ft}><td><b>{ft}</b></td><td><input className="input" type="number" value={p.standard_amount} onChange={e=>updatePolicy(ft,"standard_amount",Number(e.target.value))}/></td><td><input className="input" type="number" value={p.early_payment_discount} onChange={e=>updatePolicy(ft,"early_payment_discount",Number(e.target.value))}/></td><td><input className="input" type="date" value={p.discount_deadline||""} onChange={e=>updatePolicy(ft,"discount_deadline",e.target.value||null)}/></td><td>{money(Number(p.standard_amount)-Number(p.early_payment_discount))}</td><td><button className="btn small-btn" onClick={()=>void savePolicy(ft)}>Save</button></td></tr>})}</tbody></table></div></div>
 <div className="grid" style={{marginBottom:16}}><div className="card"><h3>Payment Status</h3><div className="metric">🟢 {kpi.paidFlats} Paid</div><div>🟡 {kpi.partial} Partial &nbsp; 🔴 {kpi.unpaid} Unpaid</div></div><div className="card"><h3>Collection Intelligence</h3><div className="muted">Multi-flat owners: <b>{multi.length}</b></div><div className="muted">Multi-flat owner outstanding: <b>{money(multi.reduce((s,x)=>s+x.out,0))}</b></div><div className="muted">Discount utilisation: <b>{kpi.gross?`${(kpi.discount/kpi.gross*100).toFixed(1)}% of gross potential`:"—"}</b></div></div></div>
 <div className="card" style={{marginBottom:16}}><h3>Multi-Flat Owner Priority List</h3><div className="tableWrap"><table className="table"><thead><tr><th>Owner</th><th>Flats</th><th>Gross Liability</th><th>Paid</th><th>Outstanding</th><th>Collection %</th></tr></thead><tbody>{multi.length?multi.slice(0,25).map(x=><tr key={x.owner}><td>{x.owner}</td><td>{x.flats}</td><td>{money(x.gross)}</td><td>{money(x.paid)}</td><td>{money(x.out)}</td><td>{x.gross?`${(x.paid/x.gross*100).toFixed(1)}%`:"—"}</td></tr>):<tr><td colSpan={6} className="empty">No multiple-flat owners in the selected scope.</td></tr>}</tbody></table></div></div>
 <div className="card"><h3>Flat-Level Contribution Drill-down</h3><div className="tableWrap"><table className="table"><thead><tr><th>Flat</th><th>Type</th><th>Owner</th><th>Contributor</th><th>Standard</th><th>Discount</th><th>Net Due</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{rows.sort((a,b)=>b.outstanding-a.outstanding).map(r=><tr key={r.id}><td>{r.flat_no}</td><td>{r.flat_type}</td><td>{r.owner_name}</td><td>{r.source}</td><td>{money(r.standard)}</td><td>{money(r.availed)}</td><td>{money(r.net)}</td><td>{money(r.paid)}</td><td>{money(r.outstanding)}</td><td>{r.status}</td></tr>)}</tbody></table></div></div>
 </>;
}
