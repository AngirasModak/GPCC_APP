"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Role = "Administrator" | "Editor" | "Member";
type Status = "Pending" | "Approved" | "Rejected" | "Inactive";

type Profile = {
  id: string;
  full_name: string;
  email?: string | null;
  role: Role;
  status: Status;
  created_at: string;
  updated_at: string;
};

type BankAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
  created_at: string;
};

type CashAccount = BankAccount;

type Permission = {
  role: Role;
  module: string;
  action: string;
};

type AuditLog = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

const roles: Role[] = ["Administrator", "Editor", "Member"];
const statuses: Status[] = ["Pending", "Approved", "Rejected", "Inactive"];
const modules = [
  "dashboard",
  "income",
  "expenses",
  "petty_cash",
  "bank_transfers",
  "reports",
  "excel",
  "admin",
  "users",
  "bank_setup",
  "petty_cash_setup",
  "audit",
];

const labelize = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const emptyAccount = {
  account_name: "",
  opening_balance: "",
  opening_balance_date: new Date().toISOString().slice(0, 10),
  is_active: true,
};

export default function AdministrationPage() {
  const [tab, setTab] = useState("overview");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"All" | Status>("All");
  const [roleFilter, setRoleFilter] = useState<"All" | Role>("All");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [accountKind, setAccountKind] = useState<"bank" | "cash">("bank");
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject" | "inactive" | "activate";
    user: Profile;
  } | null>(null);

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    clearFeedback();
    try {
      const [profilesResult, permissionsResult, banksResult, cashResult, auditResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,email,role,status,created_at,updated_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("role_permissions")
            .select("role,module,action")
            .order("role")
            .order("module")
            .order("action"),
          supabase
            .from("bank_accounts")
            .select("id,account_name,opening_balance,opening_balance_date,is_active,created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("petty_cash_accounts")
            .select("id,account_name,opening_balance,opening_balance_date,is_active,created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("audit_logs")
            .select("id,occurred_at,actor_id,action,entity_type,entity_id,old_data,new_data,metadata")
            .order("occurred_at", { ascending: false })
            .limit(250),
        ]);

      const firstError =
        profilesResult.error ||
        permissionsResult.error ||
        banksResult.error ||
        cashResult.error ||
        auditResult.error;
      if (firstError) throw new Error(firstError.message);

      setProfiles((profilesResult.data || []) as Profile[]);
      setPermissions((permissionsResult.data || []) as Permission[]);
      setBanks((banksResult.data || []) as BankAccount[]);
      setCashAccounts((cashResult.data || []) as CashAccount[]);
      setAuditLogs((auditResult.data || []) as AuditLog[]);
    } catch (e: any) {
      setError(e.message || "Unable to load administration data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const counts = useMemo(() => ({
    total: profiles.length,
    pending: profiles.filter((p) => p.status === "Pending").length,
    approved: profiles.filter((p) => p.status === "Approved").length,
    inactive: profiles.filter((p) => p.status === "Inactive").length,
    admins: profiles.filter((p) => p.role === "Administrator" && p.status === "Approved").length,
    editors: profiles.filter((p) => p.role === "Editor" && p.status === "Approved").length,
    members: profiles.filter((p) => p.role === "Member" && p.status === "Approved").length,
  }), [profiles]);

  const filteredProfiles = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return profiles.filter((p) => {
      const matchesSearch = !query ||
        [p.full_name, p.email, p.id].some((v) => String(v || "").toLowerCase().includes(query));
      const matchesStatus = userFilter === "All" || p.status === userFilter;
      const matchesRole = roleFilter === "All" || p.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [profiles, userSearch, userFilter, roleFilter]);

  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditLogs;
    return auditLogs.filter((log) =>
      [log.action, log.entity_type, log.entity_id, log.actor_id]
        .some((v) => String(v || "").toLowerCase().includes(query))
    );
  }, [auditLogs, auditSearch]);

  const roleSummary = useMemo(() => {
    return roles.map((role) => ({
      role,
      permissions: permissions.filter((p) => p.role === role).length,
      modules: new Set(permissions.filter((p) => p.role === role).map((p) => p.module)).size,
    }));
  }, [permissions]);

  const updateUser = async (user: Profile, patch: { role?: Role; status?: Status; full_name?: string }) => {
    setBusy(true);
    clearFeedback();
    try {
      const { error: updateError } = await supabase.rpc("admin_update_profile", {
        p_user_id: user.id,
        p_full_name: patch.full_name ?? user.full_name,
        p_role: patch.role ?? user.role,
        p_status: patch.status ?? user.status,
      });
      if (updateError) throw new Error(updateError.message);
      setMessage(`${user.full_name || user.email || "User"} updated successfully.`);
      setSelectedUser(null);
      setConfirmAction(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Unable to update user.");
    } finally {
      setBusy(false);
    }
  };

  const submitAccount = async () => {
    if (!accountForm.account_name.trim() || !accountForm.opening_balance_date) {
      setError("Account name and opening balance date are required.");
      return;
    }
    const balance = Number(accountForm.opening_balance);
    if (!Number.isFinite(balance) || balance < 0) {
      setError("Opening balance must be zero or a positive number.");
      return;
    }

    setBusy(true);
    clearFeedback();
    try {
      const table = accountKind === "bank" ? "bank_accounts" : "petty_cash_accounts";
      const payload = {
        account_name: accountForm.account_name.trim(),
        opening_balance: balance,
        opening_balance_date: accountForm.opening_balance_date,
        is_active: accountForm.is_active,
      };
      const result = editingAccount
        ? await supabase.from(table).update(payload).eq("id", editingAccount)
        : await supabase.from(table).insert(payload);
      if (result.error) throw new Error(result.error.message);
      setMessage(`${accountKind === "bank" ? "Bank" : "Petty cash"} account ${editingAccount ? "updated" : "created"}.`);
      setAccountForm(emptyAccount);
      setEditingAccount(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Unable to save account.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async (kind: "bank" | "cash", id: string) => {
    if (!window.confirm("Delete this account? This is intended for an unused master account only.")) return;
    setBusy(true);
    clearFeedback();
    try {
      const table = kind === "bank" ? "bank_accounts" : "petty_cash_accounts";
      const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
      if (deleteError) throw new Error(deleteError.message);
      setMessage("Account deleted.");
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Unable to delete account.");
    } finally {
      setBusy(false);
    }
  };

  const startEditAccount = (kind: "bank" | "cash", account: BankAccount) => {
    setAccountKind(kind);
    setEditingAccount(account.id);
    setAccountForm({
      account_name: account.account_name,
      opening_balance: String(account.opening_balance),
      opening_balance_date: account.opening_balance_date,
      is_active: account.is_active,
    });
    setTab("accounts");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderStatus = (status: Status) => <span className={`admin-status admin-${status.toLowerCase()}`}>{status}</span>;

  return (
    <div className="admin-page">
      <div className="pageHead">
        <div>
          <div className="eyebrow admin-eyebrow">SYSTEM CONTROL CENTRE</div>
          <h1>Administration</h1>
          <p className="muted">User governance, access control, financial masters and audit oversight.</p>
        </div>
        <button className="btn secondary" onClick={loadAll} disabled={loading || busy}>↻ Refresh</button>
      </div>

      {error && <div className="admin-alert error">⚠ {error}</div>}
      {message && <div className="admin-alert success">✓ {message}</div>}

      <div className="admin-stat-grid">
        <div className="card admin-stat"><span>Total users</span><strong>{counts.total}</strong><small>{counts.pending} awaiting approval</small></div>
        <div className="card admin-stat"><span>Approved access</span><strong>{counts.approved}</strong><small>{counts.inactive} inactive</small></div>
        <div className="card admin-stat"><span>Administrators</span><strong>{counts.admins}</strong><small>{counts.editors} editors · {counts.members} members</small></div>
        <div className="card admin-stat"><span>Audit events loaded</span><strong>{auditLogs.length}</strong><small>Latest 250 events</small></div>
      </div>

      <div className="admin-tabs">
        {[
          ["overview", "Overview"],
          ["users", `Users & Access${counts.pending ? ` · ${counts.pending}` : ""}`],
          ["accounts", "Financial Masters"],
          ["permissions", "Privilege Matrix"],
          ["audit", "Audit Log"],
        ].map(([value, label]) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="card admin-loading">Loading administration centre…</div>
      ) : tab === "overview" ? (
        <Overview counts={counts} roleSummary={roleSummary} banks={banks} cashAccounts={cashAccounts} onTab={setTab} />
      ) : tab === "users" ? (
        <section className="admin-section">
          <div className="admin-section-head">
            <div><h2>User & Access Management</h2><p className="muted">Approve accounts, assign roles and control account status.</p></div>
            <div className="admin-filter-row">
              <input className="input admin-search" placeholder="Search name, email or ID" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              <select className="input admin-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value as any)}><option>All</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
              <select className="input admin-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}><option>All</option>{roles.map((r) => <option key={r}>{r}</option>)}</select>
            </div>
          </div>

          {counts.pending > 0 && <div className="admin-callout"><b>Approval queue:</b> {counts.pending} account{counts.pending === 1 ? "" : "s"} require administrator review.</div>}

          <div className="card table-card"><div className="tableWrap"><table className="table admin-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>
            {filteredProfiles.map((user) => <tr key={user.id}>
              <td><div className="admin-user"><b>{user.full_name || "Unnamed user"}</b><small>{user.email || user.id}</small></div></td>
              <td><span className={`role-chip role-${user.role.toLowerCase()}`}>{user.role}</span></td>
              <td>{renderStatus(user.status)}</td>
              <td>{new Date(user.created_at).toLocaleDateString("en-IN")}</td>
              <td><button className="btn secondary small-btn" onClick={() => setSelectedUser(user)}>Manage</button></td>
            </tr>)}
          </tbody></table></div>{filteredProfiles.length === 0 && <div className="empty">No users match the current filters.</div>}</div>
        </section>
      ) : tab === "accounts" ? (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>Financial Master Accounts</h2><p className="muted">Maintain the bank and petty-cash accounts used by GPCC financial modules.</p></div></div>
          <div className="admin-two-col">
            <div className="card admin-form-card">
              <div className="admin-card-title"><div><h3>{editingAccount ? "Edit master account" : "Add master account"}</h3><p className="muted">Administrator-only configuration.</p></div></div>
              <div className="admin-segment"><button className={accountKind === "bank" ? "active" : ""} onClick={() => setAccountKind("bank")}>🏦 Bank</button><button className={accountKind === "cash" ? "active" : ""} onClick={() => setAccountKind("cash")}>💵 Petty Cash</button></div>
              <div className="formGrid">
                <label>Account name<input className="input" value={accountForm.account_name} onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })} /></label>
                <label>Opening balance<input className="input" type="number" min="0" step="0.01" value={accountForm.opening_balance} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })} /></label>
                <label>Opening balance date<input className="input" type="date" value={accountForm.opening_balance_date} onChange={(e) => setAccountForm({ ...accountForm, opening_balance_date: e.target.value })} /></label>
                <label className="admin-check"><input type="checkbox" checked={accountForm.is_active} onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })} /> Active account</label>
              </div>
              <div className="actions"><button className="btn" onClick={submitAccount} disabled={busy}>{editingAccount ? "Save Changes" : "Create Account"}</button>{editingAccount && <button className="btn secondary" onClick={() => { setEditingAccount(null); setAccountForm(emptyAccount); }}>Cancel</button>}</div>
            </div>
            <div className="card"><div className="admin-card-title"><div><h3>{accountKind === "bank" ? "Bank accounts" : "Petty cash accounts"}</h3><p className="muted">Active and historical master records.</p></div></div>
              <AccountList accounts={accountKind === "bank" ? banks : cashAccounts} kind={accountKind} onEdit={startEditAccount} onDelete={deleteAccount} />
            </div>
          </div>
        </section>
      ) : tab === "permissions" ? (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>Privilege Matrix</h2><p className="muted">Authoritative permissions loaded from <code>role_permissions</code>. This matrix is read-only from the browser.</p></div></div>
          <div className="admin-role-cards">{roleSummary.map((r) => <div className="card" key={r.role}><span className="role-chip">{r.role}</span><strong>{r.permissions}</strong><small>{r.modules} modules enabled</small></div>)}</div>
          <div className="card table-card"><div className="tableWrap"><table className="table admin-permission-table"><thead><tr><th>Module</th>{roles.map((role) => <th key={role}>{role}</th>)}</tr></thead><tbody>{modules.map((module) => <tr key={module}><td><b>{labelize(module)}</b></td>{roles.map((role) => { const actions = permissions.filter((p) => p.role === role && p.module === module).map((p) => p.action); return <td key={role}>{actions.length ? <div className="permission-pills">{actions.map((a) => <span key={a}>{a}</span>)}</div> : <span className="permission-none">—</span>}</td>; })}</tr>)}</tbody></table></div></div>
          <div className="admin-note">Security note: changing the visual matrix is intentionally disabled. Permission definitions should be changed through reviewed database migrations, while financial data remains protected by Supabase RLS.</div>
        </section>
      ) : (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>Audit Log</h2><p className="muted">Immutable governance history generated by database triggers.</p></div><input className="input admin-search" placeholder="Filter action, entity or ID" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} /></div>
          <div className="card table-card"><div className="tableWrap"><table className="table admin-table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Record</th><th>Details</th></tr></thead><tbody>{filteredAudit.map((log) => <tr key={log.id}><td>{dateTime(log.occurred_at)}</td><td><span className={`audit-action audit-${log.action.toLowerCase()}`}>{log.action}</span></td><td>{labelize(log.entity_type)}</td><td className="mono">{log.actor_id ? `${log.actor_id.slice(0, 8)}…` : "System"}</td><td className="mono">{log.entity_id ? `${log.entity_id.slice(0, 12)}…` : "—"}</td><td><details><summary>View</summary><pre>{JSON.stringify({ old: log.old_data, new: log.new_data, metadata: log.metadata }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>{filteredAudit.length === 0 && <div className="empty">No audit events match the filter.</div>}</div>
        </section>
      )}

      {selectedUser && (
        <div className="modalBg" onMouseDown={() => !busy && setSelectedUser(null)}><div className="modal admin-user-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div><div className="eyebrow">ACCOUNT CONTROL</div><h2>{selectedUser.full_name || "User account"}</h2><p className="muted">{selectedUser.email || selectedUser.id}</p></div><button className="icon-btn" onClick={() => setSelectedUser(null)}>×</button></div>
          <div className="admin-detail-grid"><div><span>Status</span><b>{renderStatus(selectedUser.status)}</b></div><div><span>Current role</span><b>{selectedUser.role}</b></div><div><span>Created</span><b>{new Date(selectedUser.created_at).toLocaleString("en-IN")}</b></div><div><span>User ID</span><b className="mono">{selectedUser.id}</b></div></div>
          <div className="admin-edit-grid">
            <label>Full name<input className="input" value={selectedUser.full_name} onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })} /></label>
            <label>Role<select className="input" value={selectedUser.role} onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as Role })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label>Status<select className="input" value={selectedUser.status} onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value as Status })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <div className="admin-warning">Changing a user's role or approval status immediately changes their access to the protected application.</div>
          <div className="actions admin-modal-actions"><button className="btn" disabled={busy} onClick={() => updateUser(selectedUser, { full_name: selectedUser.full_name, role: selectedUser.role, status: selectedUser.status })}>Save Access Changes</button>{selectedUser.status === "Pending" && <button className="btn" disabled={busy} onClick={() => setConfirmAction({ type: "approve", user: selectedUser })}>Approve</button>}{selectedUser.status === "Approved" && <button className="btn danger" disabled={busy} onClick={() => setConfirmAction({ type: "inactive", user: selectedUser })}>Deactivate</button>}{selectedUser.status === "Inactive" && <button className="btn" disabled={busy} onClick={() => setConfirmAction({ type: "activate", user: selectedUser })}>Reactivate</button>}{selectedUser.status === "Pending" && <button className="btn secondary" disabled={busy} onClick={() => setConfirmAction({ type: "reject", user: selectedUser })}>Reject</button>}</div>
        </div></div>
      )}

      {confirmAction && (
        <div className="modalBg"><div className="modal confirm-modal"><div className="eyebrow">CONFIRM ACCESS CHANGE</div><h2>{labelize(confirmAction.type)} account?</h2><p className="muted">This changes the user's ability to enter GPCC Finance. The action will be recorded in the audit log.</p><div className="actions"><button className="btn secondary" disabled={busy} onClick={() => setConfirmAction(null)}>Cancel</button><button className={`btn ${confirmAction.type === "reject" || confirmAction.type === "inactive" ? "danger" : ""}`} disabled={busy} onClick={() => updateUser(confirmAction.user, { status: confirmAction.type === "approve" ? "Approved" : confirmAction.type === "reject" ? "Rejected" : confirmAction.type === "inactive" ? "Inactive" : "Approved" })}>Confirm</button></div></div></div>
      )}
    </div>
  );
}

function Overview({ counts, roleSummary, banks, cashAccounts, onTab }: any) {
  const quick = [
    ["Pending approvals", counts.pending, "users", "users"],
    ["Approved administrators", counts.admins, "accounts", "users"],
    ["Active bank masters", banks.filter((a: BankAccount) => a.is_active).length, "accounts", "accounts"],
    ["Active petty cash masters", cashAccounts.filter((a: BankAccount) => a.is_active).length, "accounts", "accounts"],
  ];
  return <section className="admin-section"><div className="admin-section-head"><div><h2>Governance Overview</h2><p className="muted">A single control centre for GPCC account and financial administration.</p></div></div><div className="admin-overview-grid">{quick.map(([title, value, suffix, target]: any) => <button className="card admin-quick" key={title} onClick={() => onTab(target)}><span>{title}</span><strong>{value}</strong><small>Open {suffix} →</small></button>)}</div><div className="admin-two-col"><div className="card"><h3>Role distribution</h3><div className="role-distribution">{roleSummary.map((r: any) => <div key={r.role}><div><span className="role-chip">{r.role}</span><b>{r.permissions} permissions</b></div><div className="role-bar"><span style={{ width: `${Math.min(100, (r.permissions / 20) * 100)}%` }} /></div></div>)}</div></div><div className="card"><h3>Administration controls</h3><ul className="admin-checklist"><li>✓ Account approval and deactivation</li><li>✓ Role-based access management</li><li>✓ Bank and petty-cash master setup</li><li>✓ Read-only privilege matrix</li><li>✓ Immutable audit visibility</li><li>✓ Database RLS remains the final boundary</li></ul></div></div></section>;
}

function AccountList({ accounts, kind, onEdit, onDelete }: { accounts: BankAccount[]; kind: "bank" | "cash"; onEdit: (kind: "bank" | "cash", account: BankAccount) => void; onDelete: (kind: "bank" | "cash", id: string) => void }) {
  return <div className="account-list">{accounts.length === 0 ? <div className="empty">No master accounts configured.</div> : accounts.map((a) => <div className="account-list-item" key={a.id}><div><b>{a.account_name}</b><small>Opening: {money(a.opening_balance)} · {new Date(a.opening_balance_date).toLocaleDateString("en-IN")}</small></div><div className="account-row-actions">{a.is_active ? <span className="admin-status admin-approved">Active</span> : <span className="admin-status admin-inactive">Inactive</span>}<button className="btn secondary small-btn" onClick={() => onEdit(kind, a)}>Edit</button><button className="btn danger small-btn" onClick={() => onDelete(kind, a.id)}>Delete</button></div></div>)}</div>;
}
