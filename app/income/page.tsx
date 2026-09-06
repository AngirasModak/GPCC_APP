"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Row = { id:string; date:string; contributor:string; flat_no:string|null; amount:number; mode:string; reference:string|null; status:string; income_type_id?:string|null; income_category_id?:string|null; contributor_source?:string|null; event_id?:string|null; contact_person?:string|null; contact_mobile?:string|null; contact_email?:string|null; sponsor_benefit_details?:string|null };
type FlatType = "LIG"|"MIG"|"HIG";
type ResidentialUnit = { id:string; flat_no:string; flat_type:FlatType|null; owner_name:string; has_tenant:boolean; tenant_name:string|null; is_active:boolean };
type IncomeType = { id:string; name:string; description:string|null; is_active:boolean; sort_order:number };
type IncomeCategory = { id:string; income_type_id:string; name:string; description:string|null; requires_flat:boolean; is_active:boolean; sort_order:number };
type EventMaster = { id:string; name:string; is_active:boolean; start_date:string|null };

const blank = () => ({ date:new Date().toISOString().slice(0,10), contributor:"", flat_no:"", amount:"", mode:"Cash", reference:"", status:"Cleared", income_type_id:"", income_category_id:"", contributor_source:"Resident", event_id:"", contact_person:"", contact_mobile:"", contact_email:"", sponsor_benefit_details:"" });
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));

export default function Income(){
  const [rows,setRows]=useState<Row[]>([]); const [form,setForm]=useState<any>(blank()); const [open,setOpen]=useState(false); const [editing,setEditing]=useState<string|null>(null); const [msg,setMsg]=useState("");
  const [residences,setResidences]=useState<ResidentialUnit[]>([]); const [types,setTypes]=useState<IncomeType[]>([]); const [categories,setCategories]=useState<IncomeCategory[]>([]); const [events,setEvents]=useState<EventMaster[]>([]);
  const [flatTypeFilter,setFlatTypeFilter]=useState<FlatType|"">(""); const [tenantOccupied,setTenantOccupied]=useState(false);

  const load=async()=>{ setMsg(""); const {data,error}=await supabase.from("income").select("*").is("deleted_at",null).order("date",{ascending:false}); if(error)setMsg(error.message); else setRows((data||[]) as Row[]); };
  const loadMasters=async()=>{
    const [r,t,c,e]=await Promise.all([
      supabase.from("residential_units").select("id,flat_no,flat_type,owner_name,has_tenant,tenant_name,is_active").eq("is_active",true).order("flat_no"),
      supabase.from("income_types").select("id,name,description,is_active,sort_order").eq("is_active",true).order("sort_order").order("name"),
      supabase.from("income_categories").select("id,income_type_id,name,description,requires_flat,is_active,sort_order").eq("is_active",true).order("sort_order").order("name"),
      supabase.from("events").select("id,name,is_active,start_date").eq("is_active",true).order("start_date",{ascending:false})
    ]);
    if(r.data)setResidences(r.data as ResidentialUnit[]); if(t.data)setTypes(t.data as IncomeType[]); if(c.data)setCategories(c.data as IncomeCategory[]); if(e.data)setEvents(e.data as EventMaster[]);
    const masterError=[t.error,c.error,e.error].find(Boolean); if(masterError) setMsg("Income masters are not available yet. Run supabase/V26_INCOME_MASTERS_SPONSORSHIP.sql in Supabase SQL Editor.");
  };
  useEffect(()=>{void load();void loadMasters();},[]);

  const selectedType=types.find(t=>t.id===form.income_type_id);
  const selectedCategory=categories.find(c=>c.id===form.income_category_id);
  const filteredCategories=categories.filter(c=>c.income_type_id===form.income_type_id);
  const requiresFlat=Boolean(selectedCategory?.requires_flat);
  const isSponsorship=selectedType?.name==="Sponsorship";
  const filteredResidences=useMemo(()=>!flatTypeFilter?[]:residences.filter(r=>r.flat_type===flatTypeFilter && (!tenantOccupied || Boolean(r.has_tenant&&r.tenant_name?.trim()))),[residences,flatTypeFilter,tenantOccupied]);
  const contributorFor=(u:ResidentialUnit|undefined)=>!u?"":tenantOccupied&&u.has_tenant&&u.tenant_name?.trim()?u.tenant_name.trim():u.owner_name;

  const chooseType=(id:string)=>{ setForm({...form,income_type_id:id,income_category_id:"",flat_no:"",contributor:""}); setFlatTypeFilter(""); setTenantOccupied(false); };
  const chooseCategory=(id:string)=>{ setForm({...form,income_category_id:id,flat_no:"",contributor:""}); setFlatTypeFilter(""); setTenantOccupied(false); };
  const chooseFlatType=(v:FlatType|"")=>{ setFlatTypeFilter(v); setForm({...form,flat_no:"",contributor:""}); };
  const chooseTenant=(checked:boolean)=>{ setTenantOccupied(checked); const u=residences.find(r=>r.flat_no===form.flat_no); if(checked&&u&&!(u.has_tenant&&u.tenant_name?.trim()))setForm({...form,flat_no:"",contributor:""}); else if(u)setForm({...form,contributor:contributorFor(u)}); };
  const chooseFlat=(flat:string)=>{ const u=residences.find(r=>r.flat_no===flat); setForm({...form,flat_no:flat,contributor:contributorFor(u)}); };

  const save=async()=>{
    if(!form.income_type_id||!form.income_category_id){setMsg("Income Type and Income Category are required.");return;}
    if(!form.contributor.trim()||!form.amount){setMsg("Contributor and amount are required.");return;}
    if(requiresFlat&&!form.flat_no){setMsg("This income category requires a Flat / House No.");return;}
    if(Number(form.amount)<=0){setMsg("Amount must be greater than zero.");return;}
    const payload={date:form.date,contributor:form.contributor.trim(),flat_no:form.flat_no.trim()||null,amount:Number(form.amount),mode:form.mode,reference:form.reference.trim()||null,status:form.status,income_type_id:form.income_type_id,income_category_id:form.income_category_id,contributor_source:form.contributor_source,event_id:form.event_id||null,contact_person:form.contact_person.trim()||null,contact_mobile:form.contact_mobile.trim()||null,contact_email:form.contact_email.trim()||null,sponsor_benefit_details:form.sponsor_benefit_details.trim()||null};
    const result=editing?await supabase.from("income").update(payload).eq("id",editing):await supabase.from("income").insert(payload); if(result.error){setMsg(result.error.message);return;}
    setOpen(false);setEditing(null);setForm(blank());setFlatTypeFilter("");setTenantOccupied(false);await load();
  };
  const edit=(r:Row)=>{setEditing(r.id);setForm({...blank(),...r,amount:String(r.amount),income_type_id:r.income_type_id||"",income_category_id:r.income_category_id||"",contributor_source:r.contributor_source||"Resident",event_id:r.event_id||"",contact_person:r.contact_person||"",contact_mobile:r.contact_mobile||"",contact_email:r.contact_email||"",sponsor_benefit_details:r.sponsor_benefit_details||"",flat_no:r.flat_no||"",reference:r.reference||""}); const u=residences.find(x=>x.flat_no===r.flat_no);setFlatTypeFilter(u?.flat_type||"");setTenantOccupied(Boolean(u?.has_tenant&&u?.tenant_name===r.contributor));setOpen(true);};
  const del=async(id:string)=>{if(!confirm("Delete this income entry?"))return;const {error}=await supabase.from("income").update({deleted_at:new Date().toISOString()}).eq("id",id);if(error)setMsg(error.message);else void load();};
  const cleared=rows.filter(r=>String(r.status).toLowerCase()==="cleared"); const total=cleared.reduce((s,r)=>s+Number(r.amount||0),0); const cash=cleared.filter(r=>String(r.mode).toLowerCase()==="cash").reduce((s,r)=>s+Number(r.amount||0),0); const bank=total-cash;
  const typeName=(r:Row)=>types.find(t=>t.id===r.income_type_id)?.name||"—"; const catName=(r:Row)=>categories.find(c=>c.id===r.income_category_id)?.name||"—";

  return <>
    <div className="pageHead"><div><h1>Income & Puja Subscription</h1><p className="muted">Controlled income classification with residential, sponsorship and event workflows.</p></div><button className="btn" onClick={()=>{setEditing(null);setForm(blank());setFlatTypeFilter("");setTenantOccupied(false);setOpen(true);}}>+ Add Income</button></div>
    <div className="grid" style={{marginBottom:20}}><div className="card"><div className="muted">Cleared Income</div><div className="metric">{money(total)}</div></div><div className="card"><div className="muted">Cash → Petty Cash</div><div className="metric">{money(cash)}</div></div><div className="card"><div className="muted">Non-Cash → Bank</div><div className="metric">{money(bank)}</div></div></div>
    {msg&&<div className="card" style={{marginBottom:14,color:"#b42318"}}>{msg}</div>}
    <div className="card tableWrap"><table className="table"><thead><tr><th>Date</th><th>Income Type</th><th>Category</th><th>Contributor</th><th>Flat</th><th>Receipt Mode</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.date}</td><td>{typeName(r)}</td><td>{catName(r)}</td><td>{r.contributor}</td><td>{r.flat_no||"-"}</td><td>{r.mode}</td><td>{money(r.amount)}</td><td><span className="status">{r.status}</span></td><td className="actions"><button className="btn secondary small-btn" onClick={()=>edit(r)}>Edit</button><button className="btn danger small-btn" onClick={()=>del(r.id)}>Delete</button></td></tr>):<tr><td colSpan={9} className="empty">No income entries yet.</td></tr>}</tbody></table></div>
    {open&&<div className="modalBg"><div className="modal"><div className="pageHead"><h2>{editing?"Edit Income":"Add Income"}</h2><button className="btn secondary" onClick={()=>setOpen(false)}>Close</button></div><div className="formGrid">
      <label>Date<input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      <label>Income Type<select className="input" value={form.income_type_id} onChange={e=>chooseType(e.target.value)}><option value="">Select Income Type</option>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Income Category<select className="input" disabled={!form.income_type_id} value={form.income_category_id} onChange={e=>chooseCategory(e.target.value)}><option value="">{form.income_type_id?"Select Income Category":"Select Income Type first"}</option>{filteredCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Contributor Source<select className="input" value={form.contributor_source} onChange={e=>setForm({...form,contributor_source:e.target.value})}><option>Resident</option><option>External Individual</option><option>Organisation / Company</option></select></label>
      {requiresFlat&&<><label>Flat Category<select className="input" value={flatTypeFilter} onChange={e=>chooseFlatType(e.target.value as FlatType|"")}><option value="">Select Flat Category</option><option value="LIG">LIG</option><option value="MIG">MIG</option><option value="HIG">HIG</option></select><small className="muted">Select a category before Flat / House No.</small></label><label className="tenantOccupiedControl"><span>Occupancy</span><span className="tenantCheckboxRow"><input type="checkbox" checked={tenantOccupied} onChange={e=>chooseTenant(e.target.checked)} disabled={!flatTypeFilter}/><span>Tenant Occupied<small className="muted">Show tenant instead of owner</small></span></span></label><label>Flat / House No.<select className="input" disabled={!flatTypeFilter} value={form.flat_no} onChange={e=>chooseFlat(e.target.value)}><option value="">{!flatTypeFilter?"Select Flat Category first":tenantOccupied?`Select ${flatTypeFilter} Tenant Flat`:`Select ${flatTypeFilter} Flat / House`}</option>{filteredResidences.map(r=><option key={r.id} value={r.flat_no}>{r.flat_no} — {tenantOccupied?r.tenant_name:r.owner_name}</option>)}</select></label></>}
      <label>Contributor Name<input className="input" value={form.contributor} onChange={e=>setForm({...form,contributor:e.target.value})}/></label>
      <label>Amount<input className="input" type="number" min="1" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
      <label>Event / Campaign (optional)<select className="input" value={form.event_id} onChange={e=>setForm({...form,event_id:e.target.value})}><option value="">Not linked to an event</option>{events.map(ev=><option key={ev.id} value={ev.id}>{ev.name}</option>)}</select></label>
      {isSponsorship&&<><label>Contact Person<input className="input" value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})}/></label><label>Mobile Number<input className="input" value={form.contact_mobile} onChange={e=>setForm({...form,contact_mobile:e.target.value})}/></label><label>Email<input className="input" type="email" value={form.contact_email} onChange={e=>setForm({...form,contact_email:e.target.value})}/></label><label>Sponsorship Benefit / Details<input className="input" value={form.sponsor_benefit_details} placeholder="e.g. Stage branding" onChange={e=>setForm({...form,sponsor_benefit_details:e.target.value})}/></label></>}
      <label>Receipt Mode<select className="input" value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}><option>Cash</option><option>Online</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option></select></label>
      <label>Reference / Cheque / UTR / Receipt No.<input className="input" value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label>
      <label>Status<select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Cleared</option><option>Pending</option><option>Cancelled</option></select></label>
    </div><div style={{marginTop:20}}><button className="btn" onClick={save}>{editing?"Update Entry":"Save Entry"}</button></div></div></div>}
  </>;
}
