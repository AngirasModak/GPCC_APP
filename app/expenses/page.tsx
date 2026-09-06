"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Expense = {
  id: string; date: string; requisition_no: string; vendor: string; beneficiary_pan?: string | null;
  bill_no: string; bill_date: string; payment_mode: string; cheque_or_utr: string; payment_date: string;
  gross_amount: number; tds_rate: number; tds_amount: number; net_amount: number; category: string;
  event_id?: string | null; responsible_person_id?: string | null; responsible_person_name?: string | null;
  remarks: string; status: string;
};
type EventMaster = { id:string; name:string; event_type?:string|null; is_active:boolean; start_date?:string|null; end_date?:string|null };
type Profile = { id:string; full_name:string; role:string; status:string };

const freshBlank = () => ({
  date: new Date().toISOString().slice(0, 10), requisition_no: "", vendor: "", beneficiary_pan: "",
  event_id: "", responsible_person_id: "", responsible_person_name: "", bill_no: "", bill_date: "",
  payment_mode: "Bank Transfer", cheque_or_utr: "", payment_date: "", gross_amount: "",
  tds_rate: "0", category: "", remarks: "", status: "Paid",
});
const money = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export default function ExpensesPage() {
  const [rows,setRows]=useState<Expense[]>([]);
  const [form,setForm]=useState<any>(freshBlank);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [msg,setMsg]=useState("");
  const [categories,setCategories]=useState<{id:string;name:string;is_active:boolean}[]>([]);
  const [events,setEvents]=useState<EventMaster[]>([]);
  const [people,setPeople]=useState<Profile[]>([]);

  const load=async()=>{
    setMsg("");
    const [categoryResult,eventResult,peopleResult,expenseResult]=await Promise.all([
      supabase.from("expense_categories").select("id,name,is_active").eq("is_active",true).order("sort_order").order("name"),
      supabase.from("events").select("id,name,event_type,is_active,start_date,end_date").eq("is_active",true).order("start_date",{ascending:false}),
      supabase.from("profiles").select("id,full_name,role,status").eq("status","Approved").order("full_name"),
      supabase.from("expenses").select("*").is("deleted_at",null).order("date",{ascending:false}),
    ]);
    if(categoryResult.error) setMsg(categoryResult.error.message); else setCategories((categoryResult.data||[]) as any);
    if(eventResult.error && !categoryResult.error) setMsg(eventResult.error.message); else setEvents((eventResult.data||[]) as any);
    if(peopleResult.error && !categoryResult.error && !eventResult.error) setMsg(peopleResult.error.message); else setPeople((peopleResult.data||[]) as any);
    if(expenseResult.error) setMsg(expenseResult.error.message); else setRows((expenseResult.data||[]) as Expense[]);
  };
  useEffect(()=>{load();},[]);

  const gross=Number(form.gross_amount||0), rate=Number(form.tds_rate||0);
  const tdsAmount=gross*rate/100, netAmount=gross-tdsAmount;
  const selectedEvent=useMemo(()=>events.find(e=>e.id===form.event_id),[events,form.event_id]);

  const save=async()=>{
    setMsg("");
    if(!form.requisition_no.trim()||!form.vendor.trim()||!form.gross_amount){setMsg("Requisition Number, In favour of M/S and Gross Amount are required.");return;}
    if(gross<=0){setMsg("Gross Amount must be greater than zero.");return;}
    if(rate<0||rate>100){setMsg("TDS Rate must be between 0 and 100.");return;}
    const pan=String(form.beneficiary_pan||"").trim().toUpperCase();
    if(pan&&!panPattern.test(pan)){setMsg("PAN must follow the format ABCDE1234F.");return;}
    const person=people.find(p=>p.id===form.responsible_person_id);
    const payload:any={
      date:form.date,requisition_no:form.requisition_no.trim(),vendor:form.vendor.trim(),
      beneficiary_pan:pan||null,event_id:form.event_id||null,
      responsible_person_id:person?.id||null,responsible_person_name:person?.full_name||form.responsible_person_name?.trim()||null,
      bill_no:form.bill_no.trim()||null,bill_date:form.bill_date||null,payment_mode:form.payment_mode,
      cheque_or_utr:form.cheque_or_utr.trim()||null,payment_date:form.payment_date||null,
      gross_amount:gross,tds_rate:rate,tds_amount:tdsAmount,net_amount:netAmount,
      category:form.category||null,remarks:form.remarks.trim()||null,status:form.status,
    };
    let error:any;
    if(editing) ({error}=await supabase.from("expenses").update(payload).eq("id",editing));
    else ({error}=await supabase.from("expenses").insert(payload));
    if(error){setMsg(error.message);return;}
    setOpen(false);setEditing(null);setForm(freshBlank());await load();
  };

  const edit=(r:Expense)=>{setEditing(r.id);setForm({...freshBlank(),...r,beneficiary_pan:r.beneficiary_pan||"",event_id:r.event_id||"",responsible_person_id:r.responsible_person_id||"",responsible_person_name:r.responsible_person_name||"",gross_amount:String(r.gross_amount),tds_rate:String(r.tds_rate),bill_date:r.bill_date||"",payment_date:r.payment_date||""});setOpen(true);};
  const del=async(id:string)=>{if(!confirm("Delete this expenditure entry?"))return;const {error}=await supabase.from("expenses").update({deleted_at:new Date().toISOString()}).eq("id",id);if(error)setMsg(error.message);else load();};

  const paidRows=rows.filter(r=>String(r.status).toLowerCase()==="paid");
  const totalGross=paidRows.reduce((s,r)=>s+Number(r.gross_amount||0),0);
  const totalTds=paidRows.reduce((s,r)=>s+Number(r.tds_amount||0),0);
  const totalNet=paidRows.reduce((s,r)=>s+Number(r.net_amount||0),0);
  const pettyCashExpense=paidRows.filter(r=>String(r.payment_mode).toLowerCase()==="petty cash").reduce((s,r)=>s+Number(r.net_amount||0),0);
  const bankExpense=totalNet-pettyCashExpense;

  return <div>
    <div className="pageHead"><div><h1>Expenditure & TDS</h1><p className="muted">Track expenditure, accountability, beneficiaries and event / campaign financial impact.</p></div>
      <button className="btn" onClick={()=>{setEditing(null);setForm(freshBlank());setOpen(true);}}>+ Add Expenditure</button></div>
    <div className="grid" style={{marginBottom:20}}>
      <Metric label="Paid Gross Expenditure" value={money(totalGross)}/><Metric label="Total TDS" value={money(totalTds)}/>
      <Metric label="Bank Paid" value={money(bankExpense)}/><Metric label="Petty Cash Paid" value={money(pettyCashExpense)}/>
    </div>
    {msg&&<div className="card" style={{marginBottom:14,color:"#b42318"}}>{msg}</div>}
    <div className="card tableWrap"><table className="table"><thead><tr><th>Date</th><th>Event / Campaign</th><th>Category</th><th>In favour of M/S</th><th>Responsible</th><th>Gross</th><th>Net Paid</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{rows.length?rows.map(r=>{const ev=events.find(e=>e.id===r.event_id);return <tr key={r.id}><td>{r.date}</td><td>{ev?.name||"General / Non-event"}</td><td>{r.category||"-"}</td><td><b>{r.vendor}</b>{r.beneficiary_pan&&<small style={{display:"block"}}>PAN: {r.beneficiary_pan}</small>}</td><td>{r.responsible_person_name||"-"}</td><td>{money(r.gross_amount)}</td><td>{money(r.net_amount)}</td><td><span className="status">{r.status}</span></td><td className="actions"><button className="btn secondary" onClick={()=>edit(r)}>Edit</button><button className="btn danger" onClick={()=>del(r.id)}>Delete</button></td></tr>}):<tr><td colSpan={9} className="empty">No expenditure entries yet.</td></tr>}</tbody>
    </table></div>

    {open&&<div className="modalBg"><div className="modal modalWide">
      <div className="pageHead"><div><h2>{editing?"Edit Expenditure":"Add Expenditure"}</h2><p className="muted">Record the transaction with event linkage, accountability and beneficiary details.</p></div><button className="btn secondary" onClick={()=>setOpen(false)}>Close</button></div>

      <section className="formSection"><div className="formSectionTitle">Transaction Details</div><div className="formGrid">
        <Field label="Transaction Date" type="date" value={form.date} set={v=>setForm({...form,date:v})}/>
        <Field label="Requisition Number *" value={form.requisition_no} set={v=>setForm({...form,requisition_no:v})}/>
        <label>Event / Campaign<select className="input" value={form.event_id} onChange={e=>setForm({...form,event_id:e.target.value})}><option value="">General / Non-event Expense</option>{events.map(ev=><option key={ev.id} value={ev.id}>{ev.name}{ev.event_type?` — ${ev.event_type}`:""}</option>)}</select><small className="field-hint">Shared with Income for event-wise financial reporting.</small></label>
        <label><span style={{display:"flex",justifyContent:"space-between"}}><span>Expense Category</span><a href="/admin" className="field-hint" target="_blank" rel="noreferrer">Manage categories</a></span><select className="input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
        <label>Responsible Person Handling Expense<select className="input" value={form.responsible_person_id} onChange={e=>setForm({...form,responsible_person_id:e.target.value})}><option value="">Select responsible person</option>{people.map(p=><option key={p.id} value={p.id}>{p.full_name} — {p.role}</option>)}</select></label>
        <label>Status<select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Paid</option><option>Pending</option><option>Cancelled</option></select></label>
      </div></section>

      <section className="formSection"><div className="formSectionTitle">Beneficiary & Bill Details</div><div className="formGrid">
        <Field label="In favour of M/S *" value={form.vendor} set={v=>setForm({...form,vendor:v})}/>
        <Field label="PAN of Payee / Beneficiary" value={form.beneficiary_pan} set={v=>setForm({...form,beneficiary_pan:v.toUpperCase()})}/>
        <Field label="Bill Number" value={form.bill_no} set={v=>setForm({...form,bill_no:v})}/>
        <Field label="Bill Date" type="date" value={form.bill_date||""} set={v=>setForm({...form,bill_date:v})}/>
      </div></section>

      <section className="formSection"><div className="formSectionTitle">Payment & TDS</div><div className="formGrid">
        <label>Payment Mode<select className="input" value={form.payment_mode} onChange={e=>setForm({...form,payment_mode:e.target.value})}><option>Bank Transfer</option><option>Cheque</option><option>Petty Cash</option></select></label>
        <Field label="Cheque Number / UTR" value={form.cheque_or_utr} set={v=>setForm({...form,cheque_or_utr:v})}/>
        <Field label="Cheque / Transfer Issue Date" type="date" value={form.payment_date||""} set={v=>setForm({...form,payment_date:v})}/>
        <Field label="Gross Amount *" type="number" value={form.gross_amount} set={v=>setForm({...form,gross_amount:v})}/>
        <Field label="TDS Rate (%)" type="number" value={form.tds_rate} set={v=>setForm({...form,tds_rate:v})}/>
        <div className="input" style={{display:"flex",alignItems:"center",background:"#f7fbfa"}}><b>Net Payable: {money(netAmount)}</b></div>
      </div>
      <div className="card" style={{marginTop:14,background:"#f7fbfa"}}><b>Calculated TDS: {money(tdsAmount)}</b><br/><span className="muted">Net payment: {money(netAmount)}{selectedEvent?` · Allocated to ${selectedEvent.name}`:" · General / Non-event expenditure"}</span></div></section>

      <label style={{display:"block",marginTop:14}}>Remarks<textarea className="input" rows={3} value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
      <div style={{marginTop:20}}><button className="btn" onClick={save}>{editing?"Update Expenditure":"Save Expenditure"}</button></div>
    </div></div>}
  </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="card"><div className="muted">{label}</div><div className="metric">{value}</div></div>}
function Field({label,type="text",value,set}:{label:string;type?:string;value:any;set:(v:string)=>void}){return <label>{label}<input className="input" type={type} value={value??""} onChange={e=>set(e.target.value)}/></label>}
