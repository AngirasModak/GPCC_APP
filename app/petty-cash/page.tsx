"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Row={id:string;date:string;requisition_no:string;type:string;particulars:string;amount:number;reference:string;remarks:string};

const blank={date:new Date().toISOString().slice(0,10),requisition_no:"",type:"Expense",particulars:"",amount:"",reference:"",remarks:""};

export default function PettyCashPage(){
 const [rows,setRows]=useState<Row[]>([]),[form,setForm]=useState<any>(blank),[open,setOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[msg,setMsg]=useState("");
 const load=async()=>{const{data,error}=await supabase.from("fund_transfers").select("*").is("deleted_at",null).order("date",{ascending:false});if(error)setMsg(error.message);else setRows((data||[]) as Row[])};
 useEffect(()=>{load()},[]);
 const balance=rows.reduce((a,r)=>a+(r.type==="Withdrawal"||r.type==="Cash Income"?Number(r.amount): -Number(r.amount)),0);
 const save = async () => {
  if (!form.particulars || !form.amount) {
    setMsg("Particulars and amount are required.");
    return;
  }

  const payload = {
    ...form,
    amount: Number(form.amount),
  };

  let error: any;

  if (editing) {
    ({ error } = await supabase
      .from("fund_transfers")
      .update(payload)
      .eq("id", editing));
  } else {
    ({ error } = await supabase
      .from("fund_transfers")
      .insert(payload));
  }

  if (error) {
    setMsg(error.message);
    return;
  }

  setOpen(false);
  setEditing(null);
  setForm(blank);
  setMsg("");
  load();
};
 const edit=(r:Row)=>{setEditing(r.id);setForm({...r,amount:String(r.amount)});setOpen(true)};
 const del=async(id:string)=>{if(!confirm("Delete this petty cash entry?"))return;const{error}=await supabase.from("fund_transfers").update({deleted_at:new Date().toISOString()}).eq("id",id);if(error)setMsg(error.message);else load()};
 return <div><div className="pageHead"><div><h1>Petty Cash</h1><p className="muted">Cash withdrawals, cash receipts and petty expenses</p></div><button className="btn" onClick={()=>{setEditing(null);setForm(blank);setOpen(true)}}>+ Add Petty Cash Entry</button></div>
 <div className="grid" style={{marginBottom:20}}><div className="card"><div className="muted">Current Petty Cash</div><div className="metric">₹{balance.toLocaleString("en-IN")}</div></div><div className="card"><div className="muted">Entries</div><div className="metric">{rows.length}</div></div></div>
 {msg&&<div className="card" style={{marginBottom:14,color:"#b42318"}}>{msg}</div>}
 <div className="card tableWrap"><table className="table"><thead><tr><th>Date</th><th>Requisition No.</th><th>Type</th><th>Particulars</th><th>Reference</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.requisition_no||"-"}</td><td>{r.type}</td><td>{r.particulars}</td><td>{r.reference||"-"}</td><td>₹{Number(r.amount).toLocaleString("en-IN")}</td><td className="actions"><button className="btn secondary" onClick={()=>edit(r)}>Edit</button><button className="btn danger" onClick={()=>del(r.id)}>Delete</button></td></tr>):<tr><td colSpan={7} className="empty">No petty cash entries yet.</td></tr>}</tbody></table></div>
 {open&&<div className="modalBg"><div className="modal"><div className="pageHead"><h2>{editing?"Edit Petty Cash Entry":"Add Petty Cash Entry"}</h2><button className="btn secondary" onClick={()=>setOpen(false)}>Close</button></div><div className="formGrid">
 <Field label="Date" type="date" value={form.date} set={v=>setForm({...form,date:v})}/><Field label="Requisition Number" value={form.requisition_no} set={v=>setForm({...form,requisition_no:v})}/>
 <label>Entry Type<select className="input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Withdrawal</option><option>Cash Income</option><option>Expense</option></select></label>
 <Field label="Amount" type="number" value={form.amount} set={v=>setForm({...form,amount:v})}/><Field label="Particulars" value={form.particulars} set={v=>setForm({...form,particulars:v})}/><Field label="Reference / Voucher / Bill No." value={form.reference} set={v=>setForm({...form,reference:v})}/>
 </div><label style={{display:"block",marginTop:14}}>Remarks<textarea className="input" rows={3} value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label><div style={{marginTop:20}}><button className="btn" onClick={save}>{editing?"Update Entry":"Save Entry"}</button></div></div></div>}
 </div>
}
function Field({label,type="text",value,set}:{label:string,type?:string,value:any,set:(v:string)=>void}){return <label>{label}<input className="input" type={type} value={value??""} onChange={e=>set(e.target.value)}/></label>}