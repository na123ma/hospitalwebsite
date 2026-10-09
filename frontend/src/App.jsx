import { useEffect, useState } from "react";
import { api, session } from "./api.js";

const ROLE_LABEL = { admin: "Administrator", doctor: "Doctor", nurse: "Nurse", receptionist: "Receptionist",
  lab: "Lab technician", pharmacist: "Pharmacist", patient: "Patient" };
const STAFF_OPTS = ["doctor", "nurse", "receptionist", "lab", "pharmacist"].map(v => ({ value: v, label: ROLE_LABEL[v] }));
const dir = r => `/auth/directory/?role=${r}`;

const PAGES = {
  users: { title: "Staff accounts", url: "/auth/users/", roles: ["admin"], create: ["admin"],
    fields: [["first_name", "First name"], ["last_name", "Last name"], ["username", "Username"], ["email", "Email", "email"],
      ["phone", "Phone"], ["role", "Role", "select", STAFF_OPTS],
      ["specialization", "Specialization", "text", null, null, f => f.role === "doctor"],
      ["degrees", "Degrees", "text", null, null, f => f.role === "doctor"],
      ["password", "Temporary password", "password"]],
    cols: ["username", "first_name", "last_name", "role", "specialization", "degrees", "is_active"],
    actions: [{ label: () => "Edit", roles: ["admin"], edit: true, show: r => STAFF_OPTS.some(o => o.value === r.role) },
      { label: r => r.is_active ? "Deactivate" : "Activate", roles: ["admin"], run: r => ["PATCH", `/auth/users/${r.id}/`, { is_active: !r.is_active }] },
      { label: () => "Delete", roles: ["admin"], danger: true, confirm: true, run: r => ["DELETE", `/auth/users/${r.id}/`] }] },
  appointments: { title: "Appointments & queue", url: "/appointments/", roles: ["patient", "receptionist", "doctor", "nurse", "admin"],
    create: ["patient", "receptionist"],
    fields: [["patient", "Patient", "select", dir("patient"), ["receptionist"]], ["doctor", "Doctor", "select", dir("doctor")],
      ["scheduled_at", "Date & time", "datetime-local"], ["reason", "Reason for visit"]],
    cols: ["token_number", "patient_name", "doctor_name", "scheduled_at", "status", "estimated_wait_min"],
    actions: [{ label: () => "Start", roles: ["doctor"], show: r => r.status === "waiting", run: r => ["PATCH", `/appointments/${r.id}/`, { status: "in_consultation" }] },
      { label: () => "Complete", roles: ["doctor"], show: r => r.status === "in_consultation", run: r => ["PATCH", `/appointments/${r.id}/`, { status: "completed" }] },
      { label: () => "Cancel", roles: ["patient", "receptionist"], show: r => r.status === "waiting", danger: true, run: r => ["PATCH", `/appointments/${r.id}/`, { status: "cancelled" }] }] },
  lab: { title: "Laboratory", url: "/lab-orders/", roles: ["patient", "doctor", "lab", "nurse"], create: ["doctor"],
    fields: [["appointment", "Appointment ID", "number"], ["test_name", "Test"]],
    cols: ["id", "patient_name", "test_name", "status", "result"],
    actions: [{ label: () => "Collect sample", roles: ["lab"], show: r => r.status === "ordered", run: r => ["PATCH", `/lab-orders/${r.id}/`, { status: "sample_collected" }] },
      { label: () => "Processing", roles: ["lab"], show: r => r.status === "sample_collected", run: r => ["PATCH", `/lab-orders/${r.id}/`, { status: "processing" }] },
      { label: () => "Enter result", roles: ["lab"], show: r => r.status === "processing", prompt: "Result", run: (r, v) => ["PATCH", `/lab-orders/${r.id}/`, { status: "completed", result: v }] }] },
  prescriptions: { title: "Prescriptions", url: "/prescriptions/", roles: ["patient", "doctor", "pharmacist"], create: ["doctor"],
    fields: [["appointment", "Appointment ID", "number"], ["medicine", "Medicine", "select", "/medicines/"], ["quantity", "Quantity", "number"], ["dose", "Dose & instructions"]],
    cols: ["id", "patient_name", "medicine_name", "quantity", "dose", "dispensed"],
    actions: [{ label: () => "Dispense", roles: ["pharmacist"], show: r => !r.dispensed, run: r => ["POST", `/prescriptions/${r.id}/dispense/`] }] },
  medicines: { title: "Pharmacy stock", url: "/medicines/", roles: ["pharmacist", "admin"], create: ["pharmacist"],
    fields: [["name", "Medicine"], ["stock", "Stock", "number"], ["reorder_level", "Reorder level", "number"], ["expiry_date", "Expiry", "date"]],
    cols: ["name", "stock", "reorder_level", "expiry_date", "low_stock"], actions: [] },
  beds: { title: "Beds & wards", url: "/beds/", roles: ["nurse", "admin", "receptionist", "doctor"], create: ["admin"],
    fields: [["ward", "Ward"], ["number", "Bed number"]], cols: ["ward", "number", "status"],
    actions: ["available", "occupied", "cleaning"].map(s => ({ label: () => `Mark ${s}`, roles: ["nurse", "admin"], show: r => r.status !== s, run: r => ["PATCH", `/beds/${r.id}/`, { status: s }] })) },
  invoices: { title: "Billing", url: "/invoices/", roles: ["patient", "receptionist", "admin"], create: ["receptionist", "admin"],
    fields: [["patient", "Patient", "select", dir("patient")], ["description", "Service"], ["amount", "Amount (₹)", "number"]],
    cols: ["id", "patient_name", "description", "amount", "status"],
    actions: [{ label: () => "Mark paid", roles: ["receptionist", "admin"], show: r => r.status === "unpaid", run: r => ["PATCH", `/invoices/${r.id}/`, { status: "paid" }] }] },
};
const NAV = ["dashboard", ...Object.keys(PAGES)];
const pretty = v => v === true ? "Yes" : v === false ? "No" : v == null || v === "" ? "—" : String(v).replace(/_/g, " ");
const head = c => c.replace(/_/g, " ").replace(/^./, s => s.toUpperCase());

function Field({ f, value, onChange, optional = false }) {
  const [name, label, type = "text", src] = f;
  const [opts, setOpts] = useState(Array.isArray(src) ? src : []);
  useEffect(() => { if (typeof src === "string") api(src).then(d => setOpts(d.map(x => ({ value: x.id, label: x.name })))).catch(() => {}); }, [src]);
  return (<label className="field"><span>{label}</span>
    {type === "select" ? (<select required value={value || ""} onChange={e => onChange(e.target.value)}>
      <option value="">Select…</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)
      : <input required={!optional && name !== "email" && name !== "phone" && name !== "reason" && name !== "expiry_date"} type={type} value={value || ""} onChange={e => onChange(e.target.value)} />}
  </label>);
}

function Resource({ page, user }) {
  const [rows, setRows] = useState(null), [form, setForm] = useState({}), [err, setErr] = useState(""), [open, setOpen] = useState(false), [editing, setEditing] = useState(null);
  const load = () => api(page.url).then(setRows).catch(e => setErr(e.message));
  useEffect(() => { setRows(null); setForm({}); setErr(""); setOpen(false); setEditing(null); load(); }, [page]);
  const canCreate = page.create?.includes(user.role);
  const fields = page.fields?.filter(f => (!f[4] || f[4].includes(user.role)) && (!f[5] || f[5](form))) || [];
  const beginEdit = row => {
    setForm(Object.fromEntries(page.fields.map(([name]) => [name, name === "password" ? "" : row[name] ?? ""])));
    setEditing(row); setOpen(true); setErr("");
  };
  const submit = async e => { e.preventDefault(); setErr("");
    const payload = { ...form };
    if (editing && !payload.password) delete payload.password;
    try {
      await api(editing ? `${page.url}${editing.id}/` : page.url, editing ? "PATCH" : "POST", payload);
      setForm({}); setOpen(false); setEditing(null); load();
    } catch (x) { setErr(x.message); } };
  const run = async (a, r) => {
    if (a.confirm && !window.confirm("Are you sure?")) return;
    let v; if (a.prompt) { v = window.prompt(a.prompt); if (!v) return; }
    const [m, p, b] = a.run(r, v);
    try { await api(p, m, b); load(); } catch (x) { setErr(x.message); } };
  const acts = (page.actions || []).filter(a => a.roles.includes(user.role));
  return (<section>
    <header className="page-head"><h1>{page.title}</h1>
      {canCreate && <button className="btn" onClick={() => setOpen(!open)}>{open ? "Close" : "Add new"}</button>}</header>
    {err && <p className="error" role="alert">{err}</p>}
    {open && <form className="card form" onSubmit={submit}>
      {fields.map(f => <Field key={f[0]} f={f} value={form[f[0]]} optional={editing && f[0] === "password"} onChange={v => setForm({ ...form, [f[0]]: v })} />)}
      <div className="form-actions"><button className="btn">{editing ? "Save changes" : "Save"}</button>
        {editing && <button type="button" className="link" onClick={() => { setOpen(false); setEditing(null); setForm({}); }}>Cancel</button>}</div></form>}
    <div className="card table-wrap">
      {!rows ? <p className="muted pad">Loading…</p> : rows.length === 0 ? <p className="muted pad">Nothing here yet.{canCreate ? " Use “Add new” to create the first record." : ""}</p> :
        <table><thead><tr>{page.cols.map(c => <th key={c}>{head(c)}</th>)}{acts.length > 0 && <th />}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}>
            {page.cols.map(c => <td key={c}>{c === "status" ? <span className={`pill ${r[c]}`}>{pretty(r[c])}</span> : c === "low_stock" && r[c] ? <span className="pill cancelled">Low</span> : c === "estimated_wait_min" && r[c] != null ? `${r[c]} min` : pretty(r[c])}</td>)}
            {acts.length > 0 && <td className="actions">{acts.filter(a => !a.show || a.show(r)).map((a, i) =>
              <button key={i} className={`link ${a.danger ? "danger" : ""}`} onClick={() => a.edit ? beginEdit(r) : run(a, r)}>{a.label(r)}</button>)}</td>}
          </tr>)}</tbody></table>}
    </div></section>);
}

function Dashboard({ user }) {
  const [s, setS] = useState(null);
  useEffect(() => { if (user.role === "admin") api("/stats/").then(setS).catch(() => {}); }, []);
  const tiles = s && [["Registered patients", s.patients], ["Staff accounts", s.staff], ["Appointments today", s.appointments_today],
    ["Patients waiting", s.waiting_now], ["Pending lab tests", s.pending_labs], ["Free beds", `${s.beds_available} / ${s.beds_total}`], ["Unpaid invoices", s.unpaid_invoices]];
  return (<section><header className="page-head"><h1>Welcome, {user.first_name || user.username}</h1></header>
    {user.role !== "admin" && <p className="muted">Signed in as {ROLE_LABEL[user.role]}. Use the menu to open the sections you have access to.</p>}
    {tiles && <div className="tiles">{tiles.map(([l, v]) => <div className="card tile" key={l}><b>{v}</b><span>{l}</span></div>)}</div>}
    {s?.low_stock?.length > 0 && <p className="error">Low stock: {s.low_stock.join(", ")}</p>}
  </section>);
}

function Auth({ onLogin }) {
  const [tab, setTab] = useState("login"), [f, setF] = useState({}), [err, setErr] = useState(""), [needsAdmin, setNeeds] = useState(false), [ok, setOk] = useState("");
  useEffect(() => { api("/auth/setup-admin/").then(d => setNeeds(d.needs_admin)).catch(() => setErr("Cannot reach the server. Is the Django backend running?")); }, []);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); setErr(""); setOk("");
    try {
      if (tab === "login") { const d = await api("/auth/login/", "POST", { username: f.username, password: f.password }); session.save(d); onLogin(d.user); }
      else { await api(tab === "admin" ? "/auth/setup-admin/" : "/auth/register/", "POST", f); setTab("login"); setOk("Account created. Sign in to continue."); setNeeds(false); }
    } catch (x) { setErr(x.message); } };
  const reg = tab !== "login";
  return (<main className="auth"><div className="auth-art"><h1>MediCore AI</h1><p>One shared view of the patient journey, from the front desk to discharge.</p></div>
    <form className="auth-card" onSubmit={submit}>
      <div className="tabs">{[["login", "Sign in"], ["register", "Patient sign-up"], ...(needsAdmin ? [["admin", "Admin setup"]] : [])].map(([k, l]) =>
        <button type="button" key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setErr(""); }}>{l}</button>)}</div>
      {reg && <div className="two"><label className="field"><span>First name</span><input required onChange={set("first_name")} /></label>
        <label className="field"><span>Last name</span><input required onChange={set("last_name")} /></label></div>}
      <label className="field"><span>Username</span><input required autoComplete="username" onChange={set("username")} /></label>
      {reg && <><label className="field"><span>Email</span><input type="email" required onChange={set("email")} /></label>
        <label className="field"><span>Phone</span><input onChange={set("phone")} /></label></>}
      <label className="field"><span>Password{reg && " (8+ characters)"}</span><input type="password" required minLength={reg ? 8 : 1} autoComplete={reg ? "new-password" : "current-password"} onChange={set("password")} /></label>
      {err && <p className="error" role="alert">{err}</p>}{ok && <p className="ok">{ok}</p>}
      <button className="btn wide">{tab === "login" ? "Sign in" : tab === "admin" ? "Create admin account" : "Create patient account"}</button>
      {tab === "login" && <p className="muted small">Staff accounts are created by your hospital administrator.</p>}
    </form></main>);
}

export default function App() {
  const [user, setUser] = useState(session.user), [page, setPage] = useState("dashboard"), [menu, setMenu] = useState(false);
  if (!user) return <Auth onLogin={setUser} />;
  const items = NAV.filter(k => k === "dashboard" || PAGES[k].roles.includes(user.role));
  const label = k => k === "dashboard" ? "Dashboard" : PAGES[k].title;
  return (<div className="shell">
    <aside className={menu ? "side open" : "side"}><div className="brand">MediCore AI</div>
      <nav>{items.map(k => <button key={k} className={page === k ? "on" : ""} onClick={() => { setPage(k); setMenu(false); }}>{label(k)}</button>)}</nav>
      <div className="me"><b>{user.first_name || user.username}</b><span>{ROLE_LABEL[user.role]}</span>
        <button onClick={() => { session.clear(); setUser(null); }}>Sign out</button></div></aside>
    <main className="content"><button className="burger" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
      {page === "dashboard" ? <Dashboard user={user} /> : <Resource page={PAGES[page]} user={user} />}</main></div>);
}
