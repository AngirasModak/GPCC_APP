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
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  created_at: string;
  updated_at: string;
};

type CustomRole = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

type CustomPermission = {
  custom_role_id: string;
  module: string;
  action: string;
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
type ExpenseCategory = { id: string; name: string; description: string | null; is_active: boolean; sort_order: number; created_at: string };
type FlatType = "LIG" | "MIG" | "HIG";
type ResidentialUnit = { id: string; flat_no: string; owner_name: string; flat_type: FlatType | null; has_tenant: boolean; tenant_name: string | null; is_active: boolean; created_at: string; updated_at: string };

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
const moduleActions: Record<string, string[]> = {
  dashboard: ["view"],
  income: ["view", "create", "update", "delete"],
  expenses: ["view", "create", "update", "delete"],
  petty_cash: ["view", "create", "update", "delete"],
  bank_transfers: ["view", "create", "update", "delete"],
  reports: ["view"],
  excel: ["view", "import"],
  admin: ["view"],
  users: ["manage"],
  bank_setup: ["manage"],
  petty_cash_setup: ["manage"],
  audit: ["view"],
};
const modules = Object.keys(moduleActions);

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
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customPermissions, setCustomPermissions] = useState<CustomPermission[]>([]);
  const [permissionTarget, setPermissionTarget] = useState<{ kind: "standard"; role: Role } | { kind: "custom"; id: string }>({ kind: "standard", role: "Administrator" });
  const [customRoleForm, setCustomRoleForm] = useState({ name: "", description: "", copyFrom: "Member" as Role });
  const [showCustomRoleForm, setShowCustomRoleForm] = useState(false);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [residentialUnits, setResidentialUnits] = useState<ResidentialUnit[]>([]);
  const [residentForm, setResidentForm] = useState({ flat_no: "", owner_name: "", flat_type: "" as FlatType | "", has_tenant: false, tenant_name: "", is_active: true });
  const [editingResident, setEditingResident] = useState<string | null>(null);
  const [residentFile, setResidentFile] = useState<File | null>(null);
  const [residentFileBuffer, setResidentFileBuffer] = useState<ArrayBuffer | null>(null);
  const [residentFileInfo, setResidentFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [residentImportPreview, setResidentImportPreview] = useState<Array<{ flat_no: string; flat_type: FlatType; owner_name: string; has_tenant: boolean; tenant_name: string | null }>>([]);
  const [residentPanel, setResidentPanel] = useState<"property" | "flatType" | "occupancy">("property");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [schemaWarning, setSchemaWarning] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"All" | Status>("All");
  const [roleFilter, setRoleFilter] = useState<"All" | Role>("All");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [accountKind, setAccountKind] = useState<"bank" | "cash">("bank");
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", is_active: true, sort_order: 0 });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
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
      // Keep the administration centre usable while an older database is being
      // migrated. The email column was added after the original schema; if the
      // deployed database does not have it yet, load the rest of the profile
      // record and show a migration notice instead of blanking the whole page.
      let profilesResult = await supabase
        .from("profiles")
        .select("id,full_name,email,role,status,custom_role_id,created_at,updated_at")
        .order("created_at", { ascending: false });

      if (profilesResult.error?.message?.toLowerCase().includes("profiles.email")) {
        setSchemaWarning("The deployed Supabase database is missing the profiles.email column. Run supabase/admin_migration.sql once, then refresh this page.");
        profilesResult = await supabase
          .from("profiles")
          .select("id,full_name,role,status,custom_role_id,created_at,updated_at")
          .order("created_at", { ascending: false }) as typeof profilesResult;
      } else {
        setSchemaWarning("");
      }

      const [permissionsResult, customRolesResult, customPermissionsResult, banksResult, cashResult, categoriesResult, residentialResult, auditResult] = await Promise.all([
        supabase
          .from("role_permissions")
          .select("role,module,action")
          .order("role")
          .order("module")
          .order("action"),
        supabase
          .from("custom_roles")
          .select("id,name,description,is_active,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("custom_role_permissions")
          .select("custom_role_id,module,action")
          .order("custom_role_id")
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
          .from("expense_categories")
          .select("id,name,description,is_active,sort_order,created_at")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("residential_units")
          .select("id,flat_no,owner_name,flat_type,has_tenant,tenant_name,is_active,created_at,updated_at")
          .order("flat_no"),
        supabase
          .from("audit_logs")
          .select("id,occurred_at,actor_id,action,entity_type,entity_id,old_data,new_data,metadata")
          .order("occurred_at", { ascending: false })
          .limit(250),
      ]);

      // Older production databases may have audit_logs without metadata.
      // Fall back to the core audit columns so Administration remains usable
      // even before the compatibility migration is applied.
      let resolvedAuditResult = auditResult;
      if (auditResult.error?.message?.toLowerCase().includes("audit_logs.metadata")) {
        const fallback = await supabase
          .from("audit_logs")
          .select("id,occurred_at,actor_id,action,entity_type,entity_id,old_data,new_data")
          .order("occurred_at", { ascending: false })
          .limit(250);
        if (!fallback.error) {
          resolvedAuditResult = { data: (fallback.data || []).map((row: any) => ({ ...row, metadata: null })), error: null } as typeof auditResult;
          setSchemaWarning("Your audit log table is from an older GPCC schema. The console is working, but run the V11 production migration to add metadata support.");
        }
      }

      const firstError =
        profilesResult.error ||
        permissionsResult.error ||
        customRolesResult.error ||
        customPermissionsResult.error ||
        banksResult.error ||
        cashResult.error ||
        categoriesResult.error ||
        residentialResult.error ||
        resolvedAuditResult.error;
      if (firstError) throw new Error(firstError.message);

      setProfiles((profilesResult.data || []) as Profile[]);
      setPermissions((permissionsResult.data || []) as Permission[]);
      const loadedCustomRoles = (customRolesResult.data || []) as CustomRole[];
      const roleNames = new Map(loadedCustomRoles.map((r) => [r.id, r.name]));
      setCustomPermissions((customPermissionsResult.data || []) as CustomPermission[]);
      setCustomRoles(loadedCustomRoles);
      setProfiles(((profilesResult.data || []) as Profile[]).map((p) => ({ ...p, custom_role_name: p.custom_role_id ? roleNames.get(p.custom_role_id) || null : null })));
      setBanks((banksResult.data || []) as BankAccount[]);
      setCashAccounts((cashResult.data || []) as CashAccount[]);
      setExpenseCategories((categoriesResult.data || []) as ExpenseCategory[]);
      setResidentialUnits((residentialResult.data || []) as ResidentialUnit[]);
      setAuditLogs((resolvedAuditResult.data || []) as AuditLog[]);
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
        [p.full_name, p.email, p.id, p.custom_role_name].some((v) => String(v || "").toLowerCase().includes(query));
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

  const selectedPermissionCount = permissionTarget.kind === "standard"
    ? permissions.filter((p) => p.role === permissionTarget.role).length
    : customPermissions.filter((p) => p.custom_role_id === permissionTarget.id).length;
  const selectedPermissionModules = permissionTarget.kind === "standard"
    ? new Set(permissions.filter((p) => p.role === permissionTarget.role).map((p) => p.module)).size
    : new Set(customPermissions.filter((p) => p.custom_role_id === permissionTarget.id).map((p) => p.module)).size;
  const selectedAffectedUsers = permissionTarget.kind === "standard"
    ? profiles.filter((p) => p.role === permissionTarget.role && p.status === "Approved" && !p.custom_role_id).length
    : profiles.filter((p) => p.custom_role_id === permissionTarget.id && p.status === "Approved").length;

  const setPermission = async (role: Role, module: string, action: string, enabled: boolean) => {
    if (!enabled && !window.confirm(`Remove ${action} permission from ${role} → ${labelize(module)}?`)) return;
    setBusy(true);
    clearFeedback();
    try {
      const rpc = enabled ? "admin_set_permission" : "admin_remove_permission";
      const { error: permissionError } = await supabase.rpc(rpc, {
        p_role: role,
        p_module: module,
        p_action: action,
      });
      if (permissionError) throw new Error(permissionError.message);
      setPermissions((current) => enabled
        ? current.some((p) => p.role === role && p.module === module && p.action === action)
          ? current
          : [...current, { role, module, action }]
        : current.filter((p) => !(p.role === role && p.module === module && p.action === action))
      );
      setMessage(`${enabled ? "Granted" : "Removed"} ${action} permission for ${role} → ${labelize(module)}.`);
    } catch (e: any) {
      setError(e.message || "Unable to change permission.");
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const permissionEnabled = (role: Role, module: string, action: string) =>
    permissions.some((p) => p.role === role && p.module === module && p.action === action);

  const customPermissionEnabled = (roleId: string, module: string, action: string) =>
    customPermissions.some((p) => p.custom_role_id === roleId && p.module === module && p.action === action);

  const bulkPermissionAction = async (kind: "standard" | "custom", target: string, mode: "grant_all" | "remove_all" | "reset" | "copy_member" | "copy_editor" | "copy_admin") => {
    const destructive = mode === "remove_all" || mode === "reset" || mode.startsWith("copy_");
    const targetName = kind === "standard" ? target : (customRoles.find((r) => r.id === target)?.name || "custom role");
    if (destructive && !window.confirm(`${labelize(mode)} for ${targetName}? Existing permissions may be replaced or removed.`)) return;
    setBusy(true);
    clearFeedback();
    try {
      const rpc = kind === "standard" ? "admin_bulk_role_permissions" : "admin_bulk_custom_role_permissions";
      const payload = kind === "standard"
        ? { p_role: target, p_mode: mode }
        : { p_custom_role_id: target, p_mode: mode };
      const { error: rpcError } = await supabase.rpc(rpc, payload);
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`${mode.replaceAll("_", " ")} completed successfully.`);
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Unable to change permissions.");
    } finally {
      setBusy(false);
    }
  };

  const createCustomRole = async () => {
    if (!customRoleForm.name.trim()) { setError("Custom role name is required."); return; }
    setBusy(true); clearFeedback();
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_create_custom_role", {
        p_name: customRoleForm.name.trim(),
        p_description: customRoleForm.description.trim(),
        p_copy_from_role: customRoleForm.copyFrom,
      });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`Custom role “${customRoleForm.name.trim()}” created.`);
      setCustomRoleForm({ name: "", description: "", copyFrom: "Member" });
      setShowCustomRoleForm(false);
      await loadAll();
      if (data?.id) setPermissionTarget({ kind: "custom", id: data.id });
    } catch (e: any) { setError(e.message || "Unable to create custom role."); }
    finally { setBusy(false); }
  };

  const editCustomRole = async (role: CustomRole) => {
    const name = window.prompt("Custom role name", role.name);
    if (name === null) return;
    const description = window.prompt("Role description", role.description);
    if (description === null) return;
    if (!name.trim()) { setError("Role name is required."); return; }
    setBusy(true); clearFeedback();
    try {
      const { error: rpcError } = await supabase.rpc("admin_update_custom_role", { p_custom_role_id: role.id, p_name: name.trim(), p_description: description.trim() });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`Custom role “${name.trim()}” updated.`);
      await loadAll();
    } catch (e: any) { setError(e.message || "Unable to update custom role."); }
    finally { setBusy(false); }
  };

  const setCustomRoleStatus = async (role: CustomRole) => {
    const next = !role.is_active;
    if (!next && !window.confirm(`Deactivate “${role.name}”? Assigned users will temporarily fall back to their base role permissions.`)) return;
    setBusy(true); clearFeedback();
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_custom_role_status", { p_custom_role_id: role.id, p_is_active: next });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`Custom role “${role.name}” is now ${next ? "active" : "inactive"}.`);
      await loadAll();
    } catch (e: any) { setError(e.message || "Unable to change custom role status."); }
    finally { setBusy(false); }
  };

  const deleteCustomRole = async (role: CustomRole) => {
    if (!window.confirm(`Delete custom role “${role.name}”? It must not be assigned to any user.`)) return;
    setBusy(true); clearFeedback();
    try {
      const { error: rpcError } = await supabase.rpc("admin_delete_custom_role", { p_custom_role_id: role.id });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`Custom role “${role.name}” deleted.`);
      setPermissionTarget({ kind: "standard", role: "Administrator" });
      await loadAll();
    } catch (e: any) { setError(e.message || "Unable to delete custom role."); }
    finally { setBusy(false); }
  };

  const copyStandardToCustom = async (customId: string, sourceRole: Role) =>
    bulkPermissionAction("custom", customId, sourceRole === "Administrator" ? "copy_admin" : sourceRole === "Editor" ? "copy_editor" : "copy_member");

  const updateUser = async (user: Profile, patch: { role?: Role; status?: Status; full_name?: string; custom_role_id?: string | null }) => {
    setBusy(true);
    clearFeedback();
    try {
      const { error: updateError } = await supabase.rpc("admin_update_profile", {
        p_user_id: user.id,
        p_full_name: patch.full_name ?? user.full_name,
        p_role: patch.role ?? user.role,
        p_status: patch.status ?? user.status,
        p_custom_role_id: patch.custom_role_id ?? user.custom_role_id ?? null,
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

  const submitCategory = async () => {
    clearFeedback();
    const name = categoryForm.name.trim();
    if (!name) { setError("Category name is required."); return; }
    setBusy(true);
    try {
      const rpcName = editingCategory ? "admin_update_expense_category" : "admin_create_expense_category";
      const args = editingCategory
        ? { p_category_id: editingCategory, p_name: name, p_description: categoryForm.description.trim() || null, p_is_active: categoryForm.is_active, p_sort_order: Number(categoryForm.sort_order || 0) }
        : { p_name: name, p_description: categoryForm.description.trim() || null, p_is_active: categoryForm.is_active, p_sort_order: Number(categoryForm.sort_order || 0) };
      const { error: rpcError } = await supabase.rpc(rpcName, args);
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`Category ${editingCategory ? "updated" : "created"}.`);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", is_active: true, sort_order: 0 });
      await loadAll();
    } catch (e: any) { setError(e?.message || "Unable to save category."); } finally { setBusy(false); }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Archive this expense category? Existing transactions will retain the category.")) return;
    setBusy(true); clearFeedback();
    try {
      const { error: rpcError } = await supabase.rpc("admin_delete_expense_category", { p_category_id: id });
      if (rpcError) throw new Error(rpcError.message);
      setMessage("Category archived. Existing transactions were not changed.");
      await loadAll();
    } catch (e: any) { setError(e?.message || "Unable to archive category."); } finally { setBusy(false); }
  };

  const startEditCategory = (category: ExpenseCategory) => {
    setEditingCategory(category.id);
    setCategoryForm({ name: category.name, description: category.description || "", is_active: category.is_active, sort_order: category.sort_order || 0 });
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

  const submitResident = async () => {
    clearFeedback();
    const flat_no = residentForm.flat_no.trim();
    const owner_name = residentForm.owner_name.trim();
    const flat_type = residentForm.flat_type;
    const tenant_name = residentForm.tenant_name.trim();
    if (!flat_no || !owner_name) { setError("Flat / House No. and Owner Name are required."); return; }
    if (!flat_type) { setError("Flat Type is required. Select LIG, MIG or HIG."); return; }
    if (residentForm.has_tenant && !tenant_name) { setError("Tenant Name is required when Tenant is Yes."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_upsert_residential_unit", {
        p_id: editingResident,
        p_flat_no: flat_no,
        p_owner_name: owner_name,
        p_flat_type: flat_type,
        p_has_tenant: residentForm.has_tenant,
        p_tenant_name: residentForm.has_tenant ? tenant_name : null,
        p_is_active: residentForm.is_active,
      });
      if (error) throw new Error(error.message);
      setMessage(editingResident ? "Residential record updated." : "Flat / House No. added.");
      setEditingResident(null);
      setResidentForm({ flat_no: "", owner_name: "", flat_type: "", has_tenant: false, tenant_name: "", is_active: true });
      await loadAll();
    } catch (e: any) { setError(e?.message || "Unable to save residential record."); }
    finally { setBusy(false); }
  };

  const startEditResident = (r: ResidentialUnit) => {
    setEditingResident(r.id);
    setResidentForm({ flat_no: r.flat_no, owner_name: r.owner_name, flat_type: r.flat_type || "", has_tenant: r.has_tenant, tenant_name: r.tenant_name || "", is_active: r.is_active });
  };

  const archiveResident = async (id: string) => {
    if (!confirm("Archive this Flat / House No.? Historical income entries will remain unchanged.")) return;
    setBusy(true); clearFeedback();
    try {
      const { error } = await supabase.rpc("admin_upsert_residential_unit", { p_id: id, p_flat_no: null, p_owner_name: null, p_flat_type: null, p_has_tenant: null, p_tenant_name: null, p_is_active: false });
      if (error) throw new Error(error.message);
      setMessage("Residential record archived."); await loadAll();
    } catch (e: any) { setError(e?.message || "Unable to archive residential record."); }
    finally { setBusy(false); }
  };

  const downloadResidentTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet([
      { "Flat / House No.": "A-101", "Flat Type": "MIG", "Owner Name": "Example Owner", "Tenant Yes/No": "No", "Tenant Name": "" },
      { "Flat / House No.": "A-102", "Flat Type": "LIG", "Owner Name": "Example Owner 2", "Tenant Yes/No": "Yes", "Tenant Name": "Example Tenant" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Residential Directory");
    XLSX.writeFile(wb, "GPCC_Residential_Directory_Template.xlsx");
  };

  const readResidentFile = async (file: File) => {
    clearFeedback();
    setResidentImportPreview([]);
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setResidentFile(null);
      setResidentFileBuffer(null);
      setResidentFileInfo(null);
      setError("Please select an Excel workbook (.xlsx or .xls).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResidentFile(null);
      setResidentFileBuffer(null);
      setResidentFileInfo(null);
      setError("The residential workbook must be 10 MB or smaller.");
      return;
    }
    try {
      // Snapshot the file immediately. Retaining a live File reference until
      // a later button click can fail in Chrome when the local file handle
      // becomes unavailable. Keeping an ArrayBuffer avoids that issue.
      let buffer: ArrayBuffer;
      try {
        buffer = await file.arrayBuffer();
      } catch {
        // Fallback for browsers/environments that reject a retained local-file reference.
        buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Unable to read the selected workbook."));
          reader.onerror = () => reject(reader.error || new Error("Unable to read the selected workbook."));
          reader.readAsArrayBuffer(file);
        });
      }
      setResidentFile(file);
      setResidentFileBuffer(buffer);
      setResidentFileInfo({ name: file.name, size: file.size });
      setMessage(`${file.name} is ready. Click Validate Workbook to continue.`);
    } catch (e: any) {
      setResidentFile(null);
      setResidentFileBuffer(null);
      setResidentFileInfo(null);
      setError(e?.message || "The selected workbook could not be read. Please choose the file again.");
    }
  };

  const parseResidentWorkbook = async () => {
    if (!residentFileBuffer) { setError("Choose an Excel file first."); return; }
    clearFeedback();
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(residentFileBuffer, { type: "array" });
      const sheetName = wb.SheetNames.find((n: string) => /flat|house|resident|unit/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
      const normalized = rows.map((r) => {
        const get = (...keys: string[]) => {
          const normalizedKeys = keys.map(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
          const hit = Object.keys(r).find(k => normalizedKeys.includes(k.trim().toLowerCase().replace(/[^a-z0-9]/g, "")));
          return hit ? String(r[hit] ?? "").trim() : "";
        };
        const tenantFlag = get("tenantyesno", "tenant", "hastenant", "tenantstatus").toLowerCase();
        const has_tenant = ["yes","y","true","1"].includes(tenantFlag);
        const tenant_name = get("tenantname");
        return { flat_no: get("flathouseno", "flathousenumber", "flatno", "flatnumber", "houseno", "housenumber", "unitno", "unitnumber"), flat_type: get("flattype", "flatcategory", "category", "type").toUpperCase(), owner_name: get("ownername", "nameofowner", "nameofownername", "owner", "residentowner"), has_tenant, tenant_name: has_tenant ? tenant_name || null : null };
      }).filter(r => r.flat_no || r.owner_name || r.flat_type || r.tenant_name);
      if (!normalized.length) throw new Error("No data rows found in the selected worksheet. Please use the official GPCC template or check that the first row contains column headings.");
      const missing = [
        normalized.some(r => !r.flat_no) ? "Flat / House No." : "",
        normalized.some(r => !r.flat_type) ? "Flat Type" : "",
        normalized.some(r => !r.owner_name) ? "Owner Name" : ""
      ].filter(Boolean);
      if (missing.length) throw new Error(`Required data is missing in one or more rows: ${missing.join(", ")}. Check the workbook headings and values.`);
      if (normalized.some(r => !["LIG","MIG","HIG"].includes(r.flat_type))) throw new Error("Flat Type must be LIG, MIG or HIG for every row.");
      if (normalized.some(r => r.has_tenant && !r.tenant_name)) throw new Error("At least one row has Tenant = Yes but no Tenant Name.");
      setResidentImportPreview(normalized as Array<{ flat_no: string; flat_type: FlatType; owner_name: string; has_tenant: boolean; tenant_name: string | null }>);
      setMessage(`${normalized.length} residential rows ready for import.`);
    } catch (e: any) { setError(e?.message || "Unable to read the workbook."); setResidentImportPreview([]); }
  };

  const commitResidentImport = async () => {
    if (!residentImportPreview.length) return;
    setBusy(true); clearFeedback();
    try {
      const { error } = await supabase.rpc("admin_import_residential_units", { p_rows: residentImportPreview });
      if (error) throw new Error(error.message);
      setMessage(`${residentImportPreview.length} residential records imported.`);
      setResidentImportPreview([]); setResidentFile(null); setResidentFileBuffer(null); setResidentFileInfo(null); await loadAll();
    } catch (e: any) { setError(e?.message || "Unable to import residential records."); }
    finally { setBusy(false); }
  };

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

      {schemaWarning && <div className="admin-alert warning">⚠ {schemaWarning}</div>}
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
              <td><span className={`role-chip role-${user.role.toLowerCase()}`}>{user.custom_role_name || user.role}</span>{user.custom_role_name && <small className="custom-role-sub">Base: {user.role}</small>}</td>
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

          <div className="card admin-category-card">
            <div className="admin-category-hero">
              <div className="admin-category-hero-icon">▦</div>
              <div className="admin-category-hero-copy">
                <div className="excel-kicker">MASTER DATA</div>
                <h3>Expense Categories</h3>
                <p>Standardise how expenditure is classified across transactions, reports and Excel imports.</p>
              </div>
              <div className="admin-category-metrics">
                <div><strong>{expenseCategories.length}</strong><span>Total</span></div>
                <div className="active"><strong>{expenseCategories.filter((c) => c.is_active).length}</strong><span>Active</span></div>
                <div className="archived"><strong>{expenseCategories.filter((c) => !c.is_active).length}</strong><span>Archived</span></div>
              </div>
            </div>

            <div className="admin-category-body">
              <div className="admin-category-editor">
                <div className="admin-category-editor-head">
                  <div><span className="admin-form-step">{editingCategory ? "02" : "01"}</span><div><h4>{editingCategory ? "Edit category" : "Create a category"}</h4><p>{editingCategory ? "Update the master record without affecting historical transactions." : "Add a controlled category for the Expenditure & TDS module."}</p></div></div>
                  {editingCategory && <span className="impact-chip">Editing</span>}
                </div>
                <div className="admin-category-field-grid">
                  <label className="category-field-wide"><span>Category name</span><input className="input" placeholder="e.g. Maintenance" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /><small>Use a clear, reusable business classification.</small></label>
                  <label><span>Description</span><input className="input" placeholder="e.g. Building repairs and upkeep" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /><small>Optional context shown to administrators.</small></label>
                  <label><span>Display order</span><input className="input" type="number" min="0" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value || 0) })} /><small>Lower numbers appear first.</small></label>
                </div>
                <label className="category-active-toggle"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} /><span><b>Active category</b><small>Available for new expenditure entries</small></span></label>
                <div className="actions category-actions"><button className="btn" disabled={busy} onClick={submitCategory}>{editingCategory ? "Save Changes" : "Add Category"}</button>{editingCategory && <button className="btn secondary" disabled={busy} onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", description: "", is_active: true, sort_order: 0 }); }}>Cancel</button>}</div>
              </div>

              <div className="admin-category-library">
                <div className="admin-category-library-head"><div><h4>Category library</h4><p>Active categories appear in the expenditure dropdown.</p></div><span className="impact-chip">{expenseCategories.filter((c) => c.is_active).length} available</span></div>
                <div className="category-list">
                  {expenseCategories.length === 0 ? <div className="category-empty"><div>▦</div><b>No categories yet</b><span>Create your first expense category to start classifying transactions.</span></div> : expenseCategories.map((category, index) => <div className={`category-list-item ${!category.is_active ? "archived" : ""}`} key={category.id}>
                    <div className="category-list-main"><div className="category-number">{String(index + 1).padStart(2, "0")}</div><div><div className="category-title-row"><b>{category.name}</b>{category.is_active ? <span className="category-status active">Active</span> : <span className="category-status archived">Archived</span>}</div><small>{category.description || "No description provided"}</small><span className="category-order">Display order · {category.sort_order}</span></div></div>
                    <div className="account-row-actions"><button className="btn secondary small-btn" disabled={busy} onClick={() => startEditCategory(category)}>Edit</button>{category.is_active && <button className="btn danger small-btn" disabled={busy} onClick={() => deleteCategory(category.id)}>Archive</button>}</div>
                  </div>)}
                </div>
              </div>
            </div>
          </div>

          <div className="card admin-resident-card">
            <div className="admin-category-hero">
              <div className="admin-category-hero-icon">⌂</div>
              <div className="admin-category-hero-copy"><div className="excel-kicker">RESIDENTIAL MASTER</div><h3>Flat / House Directory</h3><p>Maintain the controlled list of GPCC flats and houses, owners and tenant occupancy. This list powers the Income dropdown.</p></div>
              <div className="admin-category-metrics"><div><strong>{residentialUnits.length}</strong><span>Total</span></div><div className="active"><strong>{residentialUnits.filter(r => r.is_active).length}</strong><span>Active</span></div><div><strong>{residentialUnits.filter(r => r.has_tenant && r.is_active).length}</strong><span>Tenanted</span></div></div>
            </div>
            <div className="admin-category-body">
              <div className="admin-category-editor">
                <div className="admin-category-editor-head"><div><span className="admin-form-step">01</span><div><h4>{editingResident ? "Edit residence" : "Add Flat / House"}</h4><p>Owner information is the master record; tenant details are conditional.</p></div></div>{editingResident && <span className="impact-chip">Editing</span>}</div>
                <div className="admin-category-field-grid">
                  <label><span>Flat / House No.</span><input className="input" placeholder="e.g. A-101" value={residentForm.flat_no} onChange={e => setResidentForm({ ...residentForm, flat_no: e.target.value })}/></label>
                  <label><span>Name of Owner</span><input className="input" placeholder="e.g. Mr. Sharma" value={residentForm.owner_name} onChange={e => setResidentForm({ ...residentForm, owner_name: e.target.value })}/></label>
                </div>
                <div className="resident-panel-tabs"><button type="button" className={residentPanel === "property" ? "active" : ""} onClick={() => setResidentPanel("property")}>⌂ Property & Owner</button><button type="button" className={residentPanel === "flatType" ? "active" : ""} onClick={() => setResidentPanel("flatType")}>▦ Flat Type</button><button type="button" className={residentPanel === "occupancy" ? "active" : ""} onClick={() => setResidentPanel("occupancy")}>♙ Tenant / Occupancy</button></div>
                {residentPanel === "flatType" && <div className="tenant-panel flat-type-panel"><div><b>Residential classification</b><small>Select the official GPCC housing category for this unit.</small></div><label><span>Flat Type</span><select className="input" value={residentForm.flat_type} onChange={e => setResidentForm({ ...residentForm, flat_type: e.target.value as FlatType })}><option value="">Select Flat Type</option><option value="LIG">LIG</option><option value="MIG">MIG</option><option value="HIG">HIG</option></select></label><div className="flat-type-info"><span>LIG</span><small>Low Income Group</small><span>MIG</span><small>Middle Income Group</small><span>HIG</span><small>High Income Group</small></div></div>}
                {residentPanel === "occupancy" && <div className="tenant-panel"><div><b>Is this unit currently tenanted?</b><small>Choose Yes to maintain the current tenant name.</small></div><div className="admin-segment"><button type="button" className={!residentForm.has_tenant ? "active" : ""} onClick={() => setResidentForm({ ...residentForm, has_tenant: false, tenant_name: "" })}>No</button><button type="button" className={residentForm.has_tenant ? "active" : ""} onClick={() => setResidentForm({ ...residentForm, has_tenant: true })}>Yes</button></div>{residentForm.has_tenant && <label><span>Tenant Name</span><input className="input" placeholder="Enter current tenant name" value={residentForm.tenant_name} onChange={e => setResidentForm({ ...residentForm, tenant_name: e.target.value })}/></label>}</div>}
                <label className="category-active-toggle"><input type="checkbox" checked={residentForm.is_active} onChange={e => setResidentForm({ ...residentForm, is_active: e.target.checked })}/><span><b>Active residence</b><small>Available in the Income Flat / House dropdown</small></span></label>
                <div className="actions category-actions"><button className="btn" disabled={busy} onClick={submitResident}>{editingResident ? "Save Changes" : "Add Residence"}</button>{editingResident && <button className="btn secondary" disabled={busy} onClick={() => {setEditingResident(null);setResidentForm({flat_no:"",owner_name:"",flat_type:"",has_tenant:false,tenant_name:"",is_active:true});}}>Cancel</button>}</div>
              </div>
              <div className="admin-category-library resident-import-panel">
                <div className="resident-import-titlebar"><div><div className="excel-kicker">CONTROLLED DATA INGESTION</div><h4>Import Residential Directory</h4><p>Load flats, housing type, owners and occupancy from Excel through a controlled validation workflow.</p></div><div className="resident-import-badge">XLSX / XLS · 10 MB</div></div>
                <div className="resident-import-steps"><div className="resident-import-step active"><span>01</span><div><b>Select</b><small>Choose workbook</small></div></div><div className="resident-import-connector"/><div className={`resident-import-step ${residentFileInfo ? "active" : ""}`}><span>02</span><div><b>Validate</b><small>Check structure & data</small></div></div><div className="resident-import-connector"/><div className={`resident-import-step ${residentImportPreview.length ? "active" : ""}`}><span>03</span><div><b>Review</b><small>Preview rows</small></div></div><div className="resident-import-connector"/><div className={`resident-import-step ${residentImportPreview.length ? "active" : ""}`}><span>04</span><div><b>Import</b><small>Commit securely</small></div></div></div>
                <div className="resident-import-box">
                  <div className="resident-import-head"><div><b>Upload workbook</b><small>Required: <strong>Flat / House No.</strong>, <strong>Flat Type</strong> (LIG/MIG/HIG), <strong>Owner Name</strong>. Optional: Tenant Yes/No and Tenant Name.</small></div><button className="btn secondary small-btn" type="button" onClick={downloadResidentTemplate}>↓ Download Template</button></div>
                  <div className="resident-file-picker"><label className={`resident-dropzone ${residentFileInfo ? "has-file" : ""}`}><input type="file" accept=".xlsx,.xls" onChange={e => { const file = e.target.files?.[0]; if (file) void readResidentFile(file); e.currentTarget.value = ""; }} /><span className="resident-dropzone-icon">{residentFileInfo ? "✓" : "↑"}</span><span><b>{residentFileInfo ? residentFileInfo.name : "Drop your residential workbook here"}</b><small>{residentFileInfo ? `${(residentFileInfo.size / 1024).toFixed(1)} KB · File snapshot captured · Ready for validation` : "or click Browse · .xlsx / .xls · maximum 10 MB"}</small></span><span className="resident-browse">{residentFileInfo ? "Replace" : "Browse"}</span></label></div>
                  <div className="resident-import-actions"><button className="btn secondary" disabled={!residentFileInfo || busy} onClick={parseResidentWorkbook}>✓ Validate Workbook</button>{residentImportPreview.length > 0 && <button className="btn" disabled={busy} onClick={commitResidentImport}>Import {residentImportPreview.length} Rows →</button>}</div>
                  {residentImportPreview.length > 0 && <div className="resident-preview"><div className="resident-preview-summary"><div><span className="preview-check">✓</span><div><b>{residentImportPreview.length} rows validated successfully</b><small>Review the sample below before committing.</small></div></div><span className="impact-chip">Ready to import</span></div><div className="tableWrap"><table className="table"><thead><tr><th>Flat / House</th><th>Type</th><th>Owner</th><th>Tenant</th><th>Tenant Name</th></tr></thead><tbody>{residentImportPreview.slice(0,8).map((r,i)=><tr key={i}><td><b>{r.flat_no}</b></td><td><span className={`flat-type-badge flat-type-${r.flat_type.toLowerCase()}`}>{r.flat_type}</span></td><td>{r.owner_name}</td><td>{r.has_tenant ? "Yes" : "No"}</td><td>{r.tenant_name || "—"}</td></tr>)}</tbody></table></div>{residentImportPreview.length>8 && <small>Showing first 8 rows of {residentImportPreview.length} validated records.</small>}</div>}
                </div>
              </div>
            <div className="resident-directory"><div className="admin-category-library-head"><div><h4>Residential directory</h4><p>Only active records are available for new income entries.</p></div></div>{residentialUnits.length === 0 ? <div className="category-empty"><div>⌂</div><b>No residences configured</b><span>Add a Flat / House No. or import your directory.</span></div> : <div className="resident-grid">{residentialUnits.map(r => <div className={`resident-item ${!r.is_active ? "archived" : ""}`} key={r.id}><div className="resident-item-top"><div className="resident-flat">{r.flat_no}<span className={`flat-type-badge flat-type-${(r.flat_type || "unknown").toLowerCase()}`}>{r.flat_type || "Unclassified"}</span></div><span className={`category-status ${r.is_active ? "active" : "archived"}`}>{r.is_active ? "Active" : "Archived"}</span></div><b>{r.owner_name}</b><small>{r.has_tenant ? `Tenant · ${r.tenant_name}` : "Owner occupied"}</small><div className="account-row-actions"><button className="btn secondary small-btn" disabled={busy} onClick={() => startEditResident(r)}>Edit</button>{r.is_active && <button className="btn danger small-btn" disabled={busy} onClick={() => archiveResident(r.id)}>Archive</button>}</div></div>)}</div>}</div>
          </div>
          </div>
        </section>
      ) : tab === "permissions" ? (
        <section className="admin-section">
          <div className="admin-section-head">
            <div><h2>Privilege & Role Management</h2><p className="muted">Manage standard role permissions, create custom roles, copy access profiles and preview who will be affected.</p></div>
            <button className="btn" onClick={() => setShowCustomRoleForm((v) => !v)}>{showCustomRoleForm ? "Close" : "+ Create Custom Role"}</button>
          </div>

          {showCustomRoleForm && <div className="card admin-form-card">
            <div className="admin-card-title"><div><h3>Create Custom Role</h3><p className="muted">Create a tailored access profile without changing the built-in Administrator, Editor or Member roles.</p></div></div>
            <div className="admin-edit-grid">
              <label>Role name<input className="input" placeholder="e.g. Finance Reviewer" value={customRoleForm.name} onChange={(e) => setCustomRoleForm({ ...customRoleForm, name: e.target.value })} /></label>
              <label>Copy permissions from<select className="input" value={customRoleForm.copyFrom} onChange={(e) => setCustomRoleForm({ ...customRoleForm, copyFrom: e.target.value as Role })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
              <label>Description<input className="input" placeholder="Purpose of this role" value={customRoleForm.description} onChange={(e) => setCustomRoleForm({ ...customRoleForm, description: e.target.value })} /></label>
            </div>
            <div className="actions"><button className="btn" disabled={busy} onClick={createCustomRole}>Create Role</button></div>
          </div>}

          <div className="admin-role-cards">{roleSummary.map((r) => <button className={`card admin-role-select ${permissionTarget.kind === "standard" && permissionTarget.role === r.role ? "selected" : ""}`} key={r.role} onClick={() => setPermissionTarget({ kind: "standard", role: r.role })}><span className="role-chip">{r.role}</span><strong>{r.permissions}</strong><small>{r.modules} modules enabled · {profiles.filter((p) => p.role === r.role && p.status === "Approved" && !p.custom_role_id).length} users</small></button>)}{customRoles.map((r) => <button className={`card admin-role-select ${permissionTarget.kind === "custom" && permissionTarget.id === r.id ? "selected" : ""}`} key={r.id} onClick={() => setPermissionTarget({ kind: "custom", id: r.id })}><span className="role-chip role-custom">Custom · {r.is_active ? "Active" : "Inactive"}</span><strong>{customPermissions.filter((p) => p.custom_role_id === r.id).length}</strong><small>{r.name} · {profiles.filter((p) => p.custom_role_id === r.id && p.status === "Approved").length} users</small></button>)}</div>

          {permissionTarget.kind === "standard" ? <div className="card admin-permission-toolbar">
            <div><b>{permissionTarget.role}</b><span className="muted"> Standard role · changes affect all users assigned to this role.</span></div>
            <div className="actions">
              <button className="btn secondary small-btn" disabled={busy} onClick={() => bulkPermissionAction("standard", permissionTarget.role, "grant_all")}>Grant All</button>
              <button className="btn secondary small-btn" disabled={busy} onClick={() => bulkPermissionAction("standard", permissionTarget.role, "reset")}>Reset Default</button>
              <button className="btn danger small-btn" disabled={busy} onClick={() => bulkPermissionAction("standard", permissionTarget.role, "remove_all")}>Remove All</button>
            </div>
          </div> : <div className="card admin-permission-toolbar">
            {(() => { const cr = customRoles.find((r) => r.id === permissionTarget.id); const affected = profiles.filter((p) => p.custom_role_id === permissionTarget.id && p.status === "Approved").length; return <><div><b>{cr?.name || "Custom role"}</b><span className="muted"> · {affected} approved users affected</span><p className="muted">{cr?.description || "No description"}</p></div><div className="actions"><button className="btn secondary small-btn" disabled={busy} onClick={() => copyStandardToCustom(permissionTarget.id, "Administrator")}>Copy Admin</button><button className="btn secondary small-btn" disabled={busy} onClick={() => copyStandardToCustom(permissionTarget.id, "Editor")}>Copy Editor</button><button className="btn secondary small-btn" disabled={busy} onClick={() => copyStandardToCustom(permissionTarget.id, "Member")}>Copy Member</button><button className="btn secondary small-btn" disabled={busy} onClick={() => bulkPermissionAction("custom", permissionTarget.id, "grant_all")}>Grant All</button><button className="btn secondary small-btn" disabled={busy} onClick={() => bulkPermissionAction("custom", permissionTarget.id, "remove_all")}>Remove All</button>{cr && <><button className="btn secondary small-btn" disabled={busy} onClick={() => editCustomRole(cr)}>Edit Details</button><button className="btn secondary small-btn" disabled={busy} onClick={() => setCustomRoleStatus(cr)}>{cr.is_active ? "Deactivate" : "Activate"}</button><button className="btn danger small-btn" disabled={busy} onClick={() => deleteCustomRole(cr)}>Delete Role</button></>}</div></> })()}
          </div>}

          <div className="admin-effective-grid">
            <div className="card"><span>Effective permissions</span><strong>{selectedPermissionCount}</strong><small>{selectedPermissionModules} modules enabled</small></div>
            <div className="card"><span>Approved users affected</span><strong>{selectedAffectedUsers}</strong><small>Changes apply immediately</small></div>
            <div className="card"><span>Available controls</span><strong>{Object.values(moduleActions).reduce((n, actions) => n + actions.length, 0)}</strong><small>Across {modules.length} modules</small></div>
          </div>
          <div className="card table-card"><div className="tableWrap"><table className="table admin-permission-table"><thead><tr><th>Module / Action</th><th>{permissionTarget.kind === "standard" ? permissionTarget.role : (customRoles.find((r) => r.id === permissionTarget.id)?.name || "Custom Role")}</th><th>Impact</th></tr></thead><tbody>{modules.map((module) => <tr key={module}><td><b>{labelize(module)}</b><div className="permission-action-list">{moduleActions[module].map((action) => <span key={action}>{action}</span>)}</div></td><td><div className="permission-check-list">{moduleActions[module].map((action) => { const enabled = permissionTarget.kind === "standard" ? permissionEnabled(permissionTarget.role, module, action) : customPermissionEnabled(permissionTarget.id, module, action); const locked = permissionTarget.kind === "standard" && permissionTarget.role === "Administrator" && ["admin:view", "users:manage", "audit:view"].includes(`${module}:${action}`); return <label className={`permission-toggle ${locked ? "locked" : ""}`} key={action}><input type="checkbox" checked={enabled} disabled={busy || locked} onChange={(e) => { const checked = e.target.checked; if (permissionTarget.kind === "standard") { void setPermission(permissionTarget.role, module, action, checked); } else { const customId = permissionTarget.id; void (async () => { setBusy(true); clearFeedback(); try { const { error: rpcError } = await supabase.rpc(checked ? "admin_set_custom_permission" : "admin_remove_custom_permission", { p_custom_role_id: customId, p_module: module, p_action: action }); if (rpcError) throw new Error(rpcError.message); setMessage(`${checked ? "Granted" : "Removed"} ${action} → ${labelize(module)}.`); await loadAll(); } catch (error: any) { setError(error?.message || "Unable to change custom-role permission."); await loadAll(); } finally { setBusy(false); } })(); } }} /><span>{action}</span>{locked && <small>protected</small>}</label>; })}</div></td><td><span className="impact-chip">{permissionTarget.kind === "standard" ? `${profiles.filter((p) => p.role === permissionTarget.role && p.status === "Approved" && !p.custom_role_id).length} users` : `${profiles.filter((p) => p.custom_role_id === permissionTarget.id && p.status === "Approved").length} users`}</span></td></tr>)}</tbody></table></div></div>
          <div className="admin-note"><b>Governance:</b> Grant All, Remove All, Reset Default and Copy operations are performed by protected database functions and written to the audit log. Critical Administrator controls remain protected. Custom roles can be assigned to approved non-Administrator users from User & Access.</div>
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
          <div className="admin-detail-grid"><div><span>Status</span><b>{renderStatus(selectedUser.status)}</b></div><div><span>Current role</span><b>{selectedUser.custom_role_name || selectedUser.role}</b></div><div><span>Created</span><b>{new Date(selectedUser.created_at).toLocaleString("en-IN")}</b></div><div><span>User ID</span><b className="mono">{selectedUser.id}</b></div></div>
          <div className="admin-edit-grid">
            <label>Full name<input className="input" value={selectedUser.full_name} onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })} /></label>
            <label>Base role<select className="input" value={selectedUser.role} onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as Role, custom_role_id: e.target.value === "Administrator" ? null : selectedUser.custom_role_id })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label>Status<select className="input" value={selectedUser.status} onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value as Status })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Custom role<select className="input" value={selectedUser.role === "Administrator" ? "" : (selectedUser.custom_role_id || "")} disabled={selectedUser.role === "Administrator"} onChange={(e) => setSelectedUser({ ...selectedUser, custom_role_id: e.target.value || null })}><option value="">Use base role permissions</option>{customRoles.filter((r) => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          </div>
          <div className="admin-warning">Changing a user's role or approval status immediately changes their access to the protected application.</div>
          <div className="actions admin-modal-actions"><button className="btn" disabled={busy} onClick={() => updateUser(selectedUser, { full_name: selectedUser.full_name, role: selectedUser.role, status: selectedUser.status, custom_role_id: selectedUser.role === "Administrator" ? null : selectedUser.custom_role_id })}>Save Access Changes</button>{selectedUser.status === "Pending" && <button className="btn" disabled={busy} onClick={() => setConfirmAction({ type: "approve", user: selectedUser })}>Approve</button>}{selectedUser.status === "Approved" && <button className="btn danger" disabled={busy} onClick={() => setConfirmAction({ type: "inactive", user: selectedUser })}>Deactivate</button>}{selectedUser.status === "Inactive" && <button className="btn" disabled={busy} onClick={() => setConfirmAction({ type: "activate", user: selectedUser })}>Reactivate</button>}{selectedUser.status === "Pending" && <button className="btn secondary" disabled={busy} onClick={() => setConfirmAction({ type: "reject", user: selectedUser })}>Reject</button>}</div>
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
