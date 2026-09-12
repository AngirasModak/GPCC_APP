"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from "recharts";

type Unit={id:string;flat_no:string;flat_type:"HIG"|"MIG"|"LIG"|null;owner_name:string;has_tenant:boolean;tenant_name:string|null;is_active:boolean};
type Income={id:string;date:string;contributor:string;flat_no:string|null;amount:number;status:string;contributor_source:string|null;event_id:string|null;income_type_id:string|null;income_category_id:string|null};
type Event={id:string;name:string;is_active:boolean};
type Policy={id?:string;event_id:string;flat_type:"HIG"|"MIG"|"LIG";standard_amount:number;early_payment_discount:number;discount_deadline:string|null;is_active:boolean};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));
const num=(n:number)=>new Intl.NumberFormat("en-IN").format(Number(n||0));
const COLORS=["#5b3cc4","#0f8f7d","#f59e0b","#ef5b5b"];
const key=(s:string)=>String(s||"").trim().toLowerCase();
const pct=(a:number,b:number)=>b>0?Math.round(a/b*1000)/10:0;
const axisMoney=(n:number)=>{const v=Number(n||0);if(Math.abs(v)>=100000)return `₹${(v/100000).toFixed(v%100000===0?0:1)}L`;if(Math.abs(v)>=1000)return `₹${(v/1000).toFixed(v%1000===0?0:1)}K`;return `₹${v}`;};

export default function PujaContribution(){
 const [loading,setLoading]=useState(true),[units,setUnits]=useState<Unit[]>([]),[income,setIncome]=useState<Income[]>([]),[events,setEvents]=useState<Event[]>([]),[policies,setPolicies]=useState<Policy[]>([]),[eventId,setEventId]=useState(""),[type,setType]=useState("All"),[source,setSource]=useState("All"),[ownerMode,setOwnerMode]=useState("All"),[statusFilter,setStatusFilter]=useState("All"),[msg,setMsg]=useState("");
 const load=async()=>{setLoading(true);const [u,i,e,p,t,c]=await Promise.all([
  supabase.from("residential_units").select("*").eq("is_active",true),supabase.from("income").select("*").is("deleted_at",null).eq("status","Cleared"),supabase.from("events").select("id,name,is_active").order("name"),supabase.from("puja_contribution_policies").select("*"),supabase.from("income_types").select("id,name"),supabase.from("income_categories").select("id,name")]);
 if(u.error||i.error||e.error||p.error)setMsg([u.error,i.error,e.error,p.error].filter(Boolean).map((x:any)=>x.message).join(" | "));
 setUnits((u.data||[]) as Unit[]);
 const pujaTypeIds=new Set((t.data||[]).filter((x:any)=>key(x.name)==="puja contribution").map((x:any)=>x.id));
 const pujaCatIds=new Set((c.data||[]).filter((x:any)=>key(x.name)==="durga puja").map((x:any)=>x.id));
 setIncome(((i.data||[]) as Income[]).filter(x=>pujaTypeIds.size===0||pujaTypeIds.has(x.income_type_id||"")||pujaCatIds.has(x.income_category_id||"")));
 setEvents((e.data||[]) as Event[]);setPolicies((p.data||[]) as Policy[]);
 const d=(e.data||[]).find((x:any)=>x.name==="Durga Puja 2026")||(e.data||[]).find((x:any)=>x.is_active);if(!eventId&&d)setEventId(d.id);setLoading(false);
 };
 useEffect(()=>{void load()},[]);
 const eventIncome=useMemo(()=>income.filter(x=>!eventId||x.event_id===eventId),[income,eventId]);
 const ownerCounts=useMemo(()=>{const m=new Map<string,number>();units.forEach(u=>m.set(key(u.owner_name),(m.get(key(u.owner_name))||0)+1));return m},[units]);
 const allRows=useMemo(()=>units.map(u=>{
   const pol=policies.find(p=>p.event_id===eventId&&p.flat_type===u.flat_type&&p.is_active);
   const standard=Number(pol?.standard_amount||0),discount=Number(pol?.early_payment_discount||0),deadline=pol?.discount_deadline||null;
   const payments=eventIncome.filter(x=>x.flat_no===u.flat_no).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
   const paymentSource=(x:Income):"Owner"|"Tenant"=>{const contributor=key(x.contributor),owner=key(u.owner_name),tenant=key(u.tenant_name||"");if(tenant&&contributor===tenant)return "Tenant";if(owner&&contributor===owner)return "Owner";const declared=key(x.contributor_source);if(declared==="tenant")return "Tenant";if(declared==="owner")return "Owner";return u.has_tenant?"Tenant":"Owner";};
   const paidOwner=payments.filter(x=>paymentSource(x)==="Owner").reduce((s,x)=>s+Number(x.amount||0),0);
   const paidTenant=payments.filter(x=>paymentSource(x)==="Tenant").reduce((s,x)=>s+Number(x.amount||0),0);
   const paid=paidOwner+paidTenant, actualSource=paidTenant>paidOwner?"Tenant":paidOwner>0?"Owner":(u.has_tenant?"Tenant":"Owner");
   const sourcePayments=payments.filter(x=>paymentSource(x)===actualSource);
   const contributorName=sourcePayments.length?sourcePayments[sourcePayments.length-1]?.contributor||"—":(actualSource==="Tenant"?(u.tenant_name||"—"):(u.owner_name||"—"));
   const first=payments[0]?.date||null;const before=!!deadline&&!!first&&String(first)<=String(deadline);
   const discountEligible=!!deadline&&paid>=standard-discount&&before;const availed=discountEligible?discount:0;const net=standard-availed;const outstanding=Math.max(0,net-paid);const status=paid<=0?"Unpaid":outstanding>0.01?"Partial":"Paid";
   const flatCount=ownerCounts.get(key(u.owner_name))||1;
   const priority=(status==="Unpaid"?100:status==="Partial"?65:0)+(net?Math.min(35,outstanding/net*35):0)+(flatCount>1?Math.min(20,(flatCount-1)*5):0);
   return {...u,standard,discount,availed,net,paid,paidOwner,paidTenant,outstanding,status,source:actualSource,contributorName,payments,flatCount,priority};
 }),[units,policies,eventId,eventIncome,ownerCounts]);
 const rows=useMemo(()=>allRows.filter(r=>(type==="All"||r.flat_type===type)&&(ownerMode==="All"||(ownerMode==="Multiple"?r.flatCount>1:r.flatCount<=1))&&(source==="All"||r.source===source)&&(statusFilter==="All"||r.status===statusFilter)),[allRows,type,ownerMode,source,statusFilter]);
 const kpi=useMemo(()=>{const gross=rows.reduce((s,r)=>s+r.standard,0),discount=rows.reduce((s,r)=>s+r.availed,0),net=rows.reduce((s,r)=>s+r.net,0),paid=rows.reduce((s,r)=>s+r.paid,0),out=rows.reduce((s,r)=>s+r.outstanding,0);const paidFlats=rows.filter(r=>r.status==="Paid").length,partial=rows.filter(r=>r.status==="Partial").length,unpaid=rows.filter(r=>r.status==="Unpaid").length;return {gross,discount,net,paid,out,paidFlats,partial,unpaid,eligible:rows.length,collectionPct:pct(paid,net),completionPct:pct(paidFlats,rows.length),avgPaid:rows.length?paid/rows.length:0,discountFlats:rows.filter(r=>r.availed>0).length,targetFlats:rows.filter(r=>r.status!=="Paid").length};},[rows]);
 const byType=["HIG","MIG","LIG"].map(name=>{const x=allRows.filter(r=>r.flat_type===name);const paid=x.reduce((s,r)=>s+r.paid,0),net=x.reduce((s,r)=>s+r.net,0),out=x.reduce((s,r)=>s+r.outstanding,0);return {name,Flats:x.length,PaidFlats:x.filter(r=>r.status==="Paid").length,Collected:paid,Outstanding:out,"Collection %":pct(paid,net)};});
 const bySource=["Owner","Tenant"].map(name=>{const x=allRows.filter(r=>r.source===name);const value=x.reduce((s,r)=>s+(name==="Tenant"?r.paidTenant:r.paidOwner),0);const flats=x.length;const paidFlats=x.filter(r=>r.status==="Paid").length;return {name,value,flats,paidFlats,paymentPct:pct(value,allRows.reduce((s,r)=>s+r.paid,0)),collectionPct:pct(value,x.reduce((s,r)=>s+r.net,0))};});
 const sourceLabel=(x:any)=>`${x.name}: ${num(x.flats)} flats | ${x.paymentPct}% of collection`;
 const multi=useMemo(()=>{const map=new Map<string,any>();allRows.forEach(r=>{const x=map.get(key(r.owner_name))||{owner:r.owner_name,flats:0,gross:0,paid:0,out:0,priority:0};x.flats++;x.gross+=r.standard;x.paid+=r.paid;x.out+=r.outstanding;x.priority=Math.max(x.priority,r.priority);map.set(key(r.owner_name),x)});return [...map.values()].filter(x=>x.flats>1).sort((a,b)=>b.out-a.out)},[allRows]);
 const targets=useMemo(()=>rows.filter(r=>r.status!=="Paid").sort((a,b)=>b.priority-a.priority||b.outstanding-a.outstanding),[rows]);
 const targetSummary=useMemo(()=>({owner:targets.filter(r=>r.source==="Owner"),tenant:targets.filter(r=>r.source==="Tenant")}),[targets]);
 const insights=useMemo(()=>{
  const strongest=byType.slice().sort((a,b)=>b["Collection %"]-a["Collection %"])[0];
  const sourceGap=Math.abs((bySource[0]?.collectionPct||0)-(bySource[1]?.collectionPct||0));
  const leader=(bySource[0]?.collectionPct||0)>=(bySource[1]?.collectionPct||0)?"Owner":"Tenant";
  const topTarget=targets[0];
  return [
   {icon:"🎯",title:"Immediate follow-up pool",text:`${num(kpi.targetFlats)} flats still need attention; ${num(kpi.unpaid)} are completely unpaid.`},
   {icon:"👥",title:"Owner vs tenant gap",text:`${leader} collection performance leads by ${sourceGap.toFixed(1)} percentage points in the current portfolio.`},
   {icon:"🏢",title:"Best category visibility",text:strongest?`${strongest.name}: ${num(strongest.Flats)} flats, ${num(strongest.PaidFlats)} fully paid, ${strongest["Collection %"]}% collection.`:"No category data available."},
   {icon:"⚠️",title:"Top priority",text:topTarget?`${topTarget.flat_no} (${topTarget.source}) has ${money(topTarget.outstanding)} outstanding and priority score ${Math.round(topTarget.priority)}.`:"No pending flats in current selection."}
  ];
 },[byType,bySource,targets,kpi]);
 const policyFor=(ft:"HIG"|"MIG"|"LIG")=>policies.find(p=>p.event_id===eventId&&p.flat_type===ft)||{event_id:eventId,flat_type:ft,standard_amount:0,early_payment_discount:0,discount_deadline:null,is_active:true};
 const savePolicy=async(ft:"HIG"|"MIG"|"LIG")=>{const p=policyFor(ft);if(!eventId){setMsg("Select an event first.");return;}const payload={...p,event_id:eventId,flat_type:ft,standard_amount:Number(p.standard_amount),early_payment_discount:Number(p.early_payment_discount),discount_deadline:p.discount_deadline||null,is_active:true};delete (payload as any).id;const {error}=await supabase.from("puja_contribution_policies").upsert(payload,{onConflict:"event_id,flat_type"});setMsg(error?error.message:"Contribution policy saved.");if(!error)void load()};
 const updatePolicy=(ft:"HIG"|"MIG"|"LIG",field:string,value:any)=>setPolicies(ps=>{const found=ps.find(p=>p.event_id===eventId&&p.flat_type===ft);if(found)return ps.map(p=>p===found?{...p,[field]:value}:p);return [...ps,{event_id:eventId,flat_type:ft,standard_amount:0,early_payment_discount:0,discount_deadline:null,is_active:true,[field]:value} as Policy]});
 if(loading)return <div className="card">Loading Puja Contribution Intelligence…</div>;
 const metricCards=[
  ["₹","Gross Expected",money(kpi.gross),`${num(kpi.eligible)} flats in scope`],
  ["✓","Collected",money(kpi.paid),`${kpi.collectionPct}% of net expected`],
  ["!","Outstanding",money(kpi.out),`${num(kpi.targetFlats)} flats need follow-up`],
  ["%","Collection Rate",`${kpi.collectionPct}%`,`${num(kpi.paidFlats)} fully paid flats`],
  ["▣","Unpaid",num(kpi.unpaid),`${kpi.eligible?pct(kpi.unpaid,kpi.eligible):0}% of selected flats`],
  ["◐","Partial",num(kpi.partial),"Immediate balance recovery opportunity"],
  ["🎁","Discount Availed",money(kpi.discount),`${num(kpi.discountFlats)} flats qualified early`],
  ["≈","Average / Flat",money(kpi.avgPaid),"Average amount collected per flat"]
 ];
 return <div className="puja-page">
  <div className="puja-hero"><div><span className="puja-kicker">EVENT COLLECTION COMMAND CENTRE</span><h1>🪔 Puja Contribution Intelligence</h1><p>One view for collection performance, early-payment discounts and priority targeting across owners, tenants and flat categories.</p></div><button className="btn secondary" onClick={()=>void load()}>↻ Refresh data</button></div>
  <div className="puja-filter-card"><div className="puja-filter-grid">
   <label>Event<select className="input" value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label>Flat Type<select className="input" value={type} onChange={e=>setType(e.target.value)}><option>All</option><option>HIG</option><option>MIG</option><option>LIG</option></select></label>
   <label>Contributor<select className="input" value={source} onChange={e=>setSource(e.target.value)}><option>All</option><option>Owner</option><option>Tenant</option></select></label>
   <label>Payment Status<select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option><option>Paid</option><option>Partial</option><option>Unpaid</option></select></label>
   <label>Owner Portfolio<select className="input" value={ownerMode} onChange={e=>setOwnerMode(e.target.value)}><option value="All">All Owners</option><option value="Multiple">Multiple Flats</option><option value="Single">Single Flat</option></select></label>
  </div></div>
  {msg&&<div className="card" style={{marginBottom:16,color:"#b42318"}}>{msg}</div>}
  <div className="puja-metric-grid">{metricCards.map(([icon,title,value,sub])=><div className="puja-metric-card" key={String(title)}><div className="puja-metric-icon">{icon}</div><div><span>{title}</span><b>{value}</b><small>{sub}</small></div></div>)}</div>
  <div className="puja-analytics-grid">
   <div className="card puja-chart-card"><div className="puja-card-head"><div><h3>HIG / MIG / LIG Collection Performance</h3><p>Amount plus flat-count visibility</p></div></div><div className="puja-category-strip">{byType.map(x=><div key={x.name}><b>{x.name}</b><span>{num(x.Flats)} flats</span><strong>{num(x.PaidFlats)} paid · {x["Collection %"]}%</strong></div>)}</div><div className="puja-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={byType} margin={{top:26,right:94,left:62,bottom:8}}><XAxis dataKey="name"/><YAxis yAxisId="money" width={70} tickFormatter={axisMoney} label={{value:"Amount (₹)",angle:-90,position:"insideLeft",offset:-38,style:{fill:"#617184",fontSize:11,fontWeight:700}}}/><YAxis yAxisId="flats" orientation="right" width={82} allowDecimals={false} label={{value:"No. of Flats",angle:90,position:"insideRight",offset:-44,style:{fill:"#617184",fontSize:11,fontWeight:700}}}/><Tooltip formatter={(v:any,n:any)=>String(n).includes("Flats")?num(Number(v)):money(Number(v))}/><Legend/><Bar yAxisId="money" dataKey="Collected" fill="#0f8f7d" radius={[6,6,0,0]}/><Bar yAxisId="money" dataKey="Outstanding" fill="#ef5b5b" radius={[6,6,0,0]}/><Bar yAxisId="flats" dataKey="Flats" fill="#7c6be8" radius={[6,6,0,0]}><LabelList dataKey="Flats" position="top"/></Bar></BarChart></ResponsiveContainer></div></div>
   <div className="card puja-chart-card"><div className="puja-card-head"><div><h3>Owner vs Tenant Contribution</h3><p>Amount, flats and collection share</p></div></div><div className="puja-source-summary">{bySource.map((x,i)=><div key={x.name}><span style={{background:COLORS[i]}}></span><div><b>{x.name}</b><small>{num(x.flats)} flats · {x.paymentPct}% of total collection</small></div><strong>{money(x.value)}</strong></div>)}</div><div className="puja-chart source-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bySource} dataKey="value" nameKey="name" outerRadius={82} label={({name,value})=>`${name} ${money(value)}`}>{bySource.map((x,i)=><Cell key={x.name} fill={COLORS[i]}/>)}</Pie><Tooltip formatter={(v:any)=>money(Number(v))}/><Legend formatter={(v:string)=>sourceLabel(bySource.find(x=>x.name===v)||{name:v,flats:0,paymentPct:0})}/></PieChart></ResponsiveContainer></div></div>
  </div>
  <div className="puja-insight-grid">{insights.map(x=><div className="puja-insight" key={x.title}><span>{x.icon}</span><div><b>{x.title}</b><p>{x.text}</p></div></div>)}</div>
  <div className="puja-priority-layout">
   <div className="card"><div className="puja-card-head"><div><h3>Priority Targeting — Owner vs Tenant</h3><p>Ranked by payment status, outstanding ratio and multi-flat impact.</p></div></div><div className="puja-target-grid"><TargetPanel title="Owner follow-up" rows={targetSummary.owner}/><TargetPanel title="Tenant follow-up" rows={targetSummary.tenant}/></div></div>
   <div className="card puja-status-card"><h3>Payment Status Mix</h3><div className="puja-status-list"><StatusRow label="Paid" value={kpi.paidFlats} total={kpi.eligible} tone="paid"/><StatusRow label="Partial" value={kpi.partial} total={kpi.eligible} tone="partial"/><StatusRow label="Unpaid" value={kpi.unpaid} total={kpi.eligible} tone="unpaid"/></div><div className="puja-status-footer"><b>{num(kpi.targetFlats)}</b><span>priority flats remaining</span></div></div>
  </div>
  <div className="card" style={{marginBottom:16}}><div className="puja-card-head"><div><h3>Contribution Policy & Early-Payment Discount</h3><p>Configure contribution per flat and the qualifying early-payment benefit.</p></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Flat Type</th><th>Standard Contribution / Flat</th><th>Early Payment Discount</th><th>Discount Deadline</th><th>Net Early Amount</th><th></th></tr></thead><tbody>{(["HIG","MIG","LIG"] as const).map(ft=>{const p=policyFor(ft);return <tr key={ft}><td><b>{ft}</b></td><td><input className="input" type="number" value={p.standard_amount} onChange={e=>updatePolicy(ft,"standard_amount",Number(e.target.value))}/></td><td><input className="input" type="number" value={p.early_payment_discount} onChange={e=>updatePolicy(ft,"early_payment_discount",Number(e.target.value))}/></td><td><input className="input" type="date" value={p.discount_deadline||""} onChange={e=>updatePolicy(ft,"discount_deadline",e.target.value||null)}/></td><td><b>{money(Number(p.standard_amount)-Number(p.early_payment_discount))}</b></td><td><button className="btn small-btn" onClick={()=>void savePolicy(ft)}>Save</button></td></tr>})}</tbody></table></div></div>
  <div className="card" style={{marginBottom:16}}><div className="puja-card-head"><div><h3>Multi-Flat Owner Priority List</h3><p>Consolidated exposure highlights owners where one follow-up can unlock multiple contributions.</p></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Owner</th><th>Flats</th><th>Gross Liability</th><th>Paid</th><th>Outstanding</th><th>Collection %</th><th>Priority</th></tr></thead><tbody>{multi.length?multi.slice(0,25).map(x=><tr key={x.owner}><td><b>{x.owner}</b></td><td>{x.flats}</td><td>{money(x.gross)}</td><td>{money(x.paid)}</td><td className="puja-outstanding">{money(x.out)}</td><td>{x.gross?`${pct(x.paid,x.gross)}%`:"—"}</td><td><span className="puja-priority-pill">{Math.round(x.priority)}</span></td></tr>):<tr><td colSpan={7} className="empty">No multiple-flat owners in the selected scope.</td></tr>}</tbody></table></div></div>
  <div className="card"><div className="puja-card-head"><div><h3>Flat-Level Contribution Drill-down</h3><p>Sorted by targeting priority. Use the filters above to narrow down action lists.</p></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Priority</th><th>Flat</th><th>Type</th><th>Owner</th><th>Contributor Name</th><th>Contributor Type</th><th>Standard</th><th>Discount</th><th>Net Due</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{targets.concat(rows.filter(r=>r.status==="Paid").sort((a,b)=>a.flat_no.localeCompare(b.flat_no))).map(r=><tr key={r.id}><td><span className="puja-priority-pill">{Math.round(r.priority)}</span></td><td><b>{r.flat_no}</b></td><td>{r.flat_type}</td><td>{r.owner_name}</td><td>{r.contributorName}</td><td>{r.source}</td><td>{money(r.standard)}</td><td>{money(r.availed)}</td><td>{money(r.net)}</td><td>{money(r.paid)}</td><td className="puja-outstanding">{money(r.outstanding)}</td><td><span className={`puja-status-pill ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>)}</tbody></table></div></div>
 </div>;
}
function StatusRow({label,value,total,tone}:{label:string;value:number;total:number;tone:string}){const p=pct(value,total);return <div className="puja-status-row"><div><span className={`puja-dot ${tone}`}></span><b>{label}</b></div><strong>{num(value)} <small>({p}%)</small></strong><div className="puja-progress"><span className={tone} style={{width:`${p}%`}}></span></div></div>}
function TargetPanel({title,rows}:{title:string;rows:any[]}){const total=rows.reduce((s,r)=>s+r.outstanding,0);return <div className="puja-target-panel"><div className="puja-target-head"><div><h4>{title}</h4><small>{num(rows.length)} flats · {money(total)} outstanding</small></div></div>{rows.length?rows.slice(0,6).map((r:any)=><div className="puja-target-item" key={r.id}><div><b>{r.flat_no}</b><span>{r.owner_name}</span></div><div><strong>{money(r.outstanding)}</strong><small>{r.status} · score {Math.round(r.priority)}</small></div></div>):<div className="empty">No pending flats in this group.</div>}</div>}
