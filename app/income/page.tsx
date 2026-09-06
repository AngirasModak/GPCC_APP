"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Row = {
  id: string;
  date: string;
  contributor: string;
  flat_no: string;
  amount: number;
  mode: string;
  reference: string;
  status: string;
};
type FlatType = "LIG" | "MIG" | "HIG";
type ResidentialUnit = { id: string; flat_no: string; flat_type: FlatType | null; owner_name: string; has_tenant: boolean; tenant_name: string | null; is_active: boolean };

const initial = {
  date: new Date().toISOString().slice(0, 10),
  contributor: "",
  flat_no: "",
  amount: "",
  mode: "Cash",
  reference: "",
  status: "Cleared",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export default function Income() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<any>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [residences, setResidences] = useState<ResidentialUnit[]>([]);
  const [flatTypeFilter, setFlatTypeFilter] = useState<FlatType | "">("");
  const [tenantOccupied, setTenantOccupied] = useState(false);

  const load = async () => {
    setMsg("");

    const { data, error } = await supabase
      .from("income")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false });

    if (error) {
      setMsg(error.message);
    } else {
      setRows((data || []) as Row[]);
    }
  };

  useEffect(() => {
    load();
    loadResidences();
  }, []);

  const loadResidences = async () => {
    const { data } = await supabase.from("residential_units").select("id,flat_no,flat_type,owner_name,has_tenant,tenant_name,is_active").eq("is_active", true).order("flat_no");
    setResidences((data || []) as ResidentialUnit[]);
  };

  // A flat is intentionally unavailable until the user selects LIG, MIG or HIG.
  // When "Tenant Occupied" is checked, only active flats with a registered tenant
  // are offered and the contributor is populated with the tenant name.
  const filteredResidences = !flatTypeFilter
    ? []
    : residences.filter((r) => {
        const matchesType = r.flat_type === flatTypeFilter;
        const matchesOccupancy = !tenantOccupied || Boolean(r.has_tenant && r.tenant_name?.trim());
        return matchesType && matchesOccupancy;
      });

  const contributorFor = (unit: ResidentialUnit | undefined, useTenant: boolean) => {
    if (!unit) return "";
    return useTenant && unit.has_tenant && unit.tenant_name?.trim()
      ? unit.tenant_name.trim()
      : unit.owner_name;
  };

  const onFlatTypeChange = (type: FlatType | "") => {
    setFlatTypeFilter(type);
    // Changing the category always clears the old flat because it may belong
    // to another category and its contributor may no longer be valid.
    setForm({ ...form, flat_no: "", contributor: "" });
  };

  const onTenantOccupiedChange = (checked: boolean) => {
    setTenantOccupied(checked);
    const selectedUnit = residences.find((r) => r.flat_no === form.flat_no);

    // If the current flat has no tenant, clear it when switching to tenant mode.
    if (checked && selectedUnit && !(selectedUnit.has_tenant && selectedUnit.tenant_name?.trim())) {
      setForm({ ...form, flat_no: "", contributor: "" });
      return;
    }

    if (selectedUnit) {
      setForm({ ...form, contributor: contributorFor(selectedUnit, checked) });
    }
  };

  const onFlatChange = (flat: string) => {
    const unit = residences.find((r) => r.flat_no === flat);
    setForm({
      ...form,
      flat_no: flat,
      contributor: contributorFor(unit, tenantOccupied),
    });
  };

  const save = async () => {
    if (!form.contributor || !form.amount) {
      setMsg("Contributor and amount are required.");
      return;
    }

    if (Number(form.amount) <= 0) {
      setMsg("Amount must be greater than zero.");
      return;
    }

    const payload = {
      date: form.date,
      contributor: form.contributor.trim(),
      flat_no: form.flat_no.trim() || null,
      amount: Number(form.amount),
      mode: form.mode,
      reference: form.reference.trim() || null,
      status: form.status,
    };

    let error: any;

    if (editing) {
      ({ error } = await supabase
        .from("income")
        .update(payload)
        .eq("id", editing));
    } else {
      ({ error } = await supabase
        .from("income")
        .insert(payload));
    }

    if (error) {
      setMsg(error.message);
      return;
    }

    setOpen(false);
    setEditing(null);
    setForm(initial);
    setMsg("");

    load();
  };

  const edit = (r: Row) => {
    setEditing(r.id);

    setForm({
      ...r,
      amount: String(r.amount),
    });

    setOpen(true);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this income entry?")) return;

    const { error } = await supabase
      .from("income")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
    } else {
      load();
    }
  };

    /*
   * ============================================
   * FINANCIAL IMPACT CALCULATIONS
   *
   * Only CLEARED income affects GPCC balances.
   *
   * Cash      → Petty Cash
   * Non-Cash  → Bank
   * ============================================
   */

  const clearedRows = rows.filter(
    (r) =>
      String(r.status || "")
        .trim()
        .toLowerCase() === "cleared"
  );

  const totalIncome = clearedRows.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  const cashIncome = clearedRows
    .filter(
      (r) =>
        String(r.mode || "")
          .trim()
          .toLowerCase() === "cash"
    )
    .reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );


   const bankIncome = clearedRows
    .filter(
      (r) =>
        String(r.mode || "")
          .trim()
          .toLowerCase() !== "cash"
    )
    .reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

  return (
    <>
      <div className="pageHead">
        <div>
          <h1>Income & Puja Subscription</h1>

          <p className="muted">
            Cash receipts automatically contribute to
            Petty Cash. Non-cash receipts contribute
            to the Bank position.
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setEditing(null);
            setForm(initial);
            setFlatTypeFilter("");
            setTenantOccupied(false);
            setOpen(true);
          }}
        >
          + Add Income
        </button>
      </div>

      <div
        className="grid"
        style={{ marginBottom: 20 }}
      >
        <div className="card">
          <div className="muted">
            Cleared Income
          </div>

          <div className="metric">
            {money(totalIncome)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Cash → Petty Cash
          </div>

          <div className="metric">
            {money(cashIncome)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Non-Cash → Bank
          </div>

          <div className="metric">
            {money(bankIncome)}
          </div>
        </div>
      </div>

      {msg && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            color: "#b42318",
          }}
        >
          {msg}
        </div>
      )}

      <div className="card tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Contributor</th>
              <th>Flat</th>
              <th>Receipt Mode</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Fund Impact</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const isCash =
                    String(r.mode || "")
                        .trim()
                        .toLowerCase() === "cash";

                const isCleared =
                    String(r.status || "")
                        .trim()
                        .toLowerCase() === "cleared";

                return (
                  <tr key={r.id}>
                    <td>{r.date}</td>

                    <td>{r.contributor}</td>

                    <td>
                      {r.flat_no || "-"}
                    </td>

                    <td>{r.mode}</td>

                    <td>
                      {r.reference || "-"}
                    </td>

                    <td>
                      {money(Number(r.amount))}
                    </td>

                    <td>
                      <span className="status">
                        {r.status}
                      </span>
                    </td>

                    <td>
                      {!isCleared
                        ? "No balance impact"
                        : isCash
                        ? "Petty Cash +"
                        : "Bank +"}
                    </td>

                    <td className="actions">
                      <button
                        className="btn secondary"
                        onClick={() => edit(r)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn danger"
                        onClick={() => del(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="empty"
                >
                  No income entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modalBg">
          <div className="modal">
            <div className="pageHead">
              <h2>
                {editing
                  ? "Edit Income"
                  : "Add Income"}
              </h2>

              <button
                className="btn secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="formGrid">
              <label>
                Date

                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      date: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Contributor Name

                <input
                  className="input"
                  value={form.contributor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contributor: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Flat Category
                <select
                  className="input"
                  value={flatTypeFilter}
                  onChange={(e) => onFlatTypeChange(e.target.value as FlatType | "")}
                >
                  <option value="">Select Flat Category</option>
                  <option value="LIG">LIG</option>
                  <option value="MIG">MIG</option>
                  <option value="HIG">HIG</option>
                </select>
                <small className="muted">Select a category first. Only flats from that category will become available.</small>
              </label>

              <label className="tenantOccupiedControl">
                <span>Occupancy</span>
                <span className="tenantCheckboxRow">
                  <input
                    type="checkbox"
                    checked={tenantOccupied}
                    onChange={(e) => onTenantOccupiedChange(e.target.checked)}
                    disabled={!flatTypeFilter}
                  />
                  <span>
                    Tenant Occupied
                    <small className="muted">Show tenant name instead of owner name</small>
                  </span>
                </span>
              </label>

              <label>
                Flat / House No.
                <select
                  className="input"
                  value={form.flat_no}
                  onChange={(e) => onFlatChange(e.target.value)}
                  disabled={!flatTypeFilter || !residences.length}
                >
                  <option value="">
                    {!flatTypeFilter
                      ? "Select Flat Category first"
                      : tenantOccupied
                      ? `Select ${flatTypeFilter} Flat / House (Tenant)`
                      : `Select ${flatTypeFilter} Flat / House`}
                  </option>
                  {flatTypeFilter && filteredResidences.map((r) => (
                    <option key={r.id} value={r.flat_no}>
                      {r.flat_no} — {tenantOccupied ? r.tenant_name : r.owner_name}
                    </option>
                  ))}
                </select>
                {!flatTypeFilter && (
                  <small className="muted">Choose Flat Category before selecting a Flat / House No.</small>
                )}
                {residences.length === 0 && (
                  <small className="muted">No active residences configured. Ask an Administrator to add/import the Flat / House Directory.</small>
                )}
                {flatTypeFilter && residences.length > 0 && filteredResidences.length === 0 && (
                  <small className="muted">
                    {tenantOccupied
                      ? `No tenant-occupied ${flatTypeFilter} flats are configured.`
                      : `No active flats are configured for ${flatTypeFilter}.`}
                  </small>
                )}
              </label>

              <label>
                Amount

                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Receipt Mode

                <select
                  className="input"
                  value={form.mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mode: e.target.value,
                    })
                  }
                >
                  <option>Cash</option>
                  <option>Online</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </label>

              <label>
                Reference / Cheque / UTR / Receipt No.

                <input
                  className="input"
                  value={form.reference}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reference: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Status

                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value,
                    })
                  }
                >
                  <option>Cleared</option>
                  <option>Pending</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                className="btn"
                onClick={save}
              >
                {editing
                  ? "Update Entry"
                  : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}