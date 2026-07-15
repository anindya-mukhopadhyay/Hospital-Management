import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Award,
  BedDouble,
  Building2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  FilePlus2,
  FileText,
  Filter,
  HeartPulse,
  IndianRupee,
  LayoutDashboard,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const navItems = [
  { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "patients", label: "Patient Registry", icon: Users },
  { id: "appointments", label: "Triage & Queue", icon: CalendarClock },
  { id: "treatments", label: "Clinical EMR", icon: Stethoscope },
  { id: "billing", label: "Revenue & Billing", icon: ReceiptText },
  { id: "wards", label: "Wards & Staff", icon: BedDouble }
];

const emptyState = {
  mode: "supabase-postgresql",
  patients: [],
  doctors: [],
  treatments: [],
  appointments: [],
  treatmentRecords: [],
  bills: [],
  payments: []
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Request failed");
  return payload;
}

function calcAge(dateOfBirth) {
  if (!dateOfBirth) return "N/A";
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function initials(name = "Patient") {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [theme] = useState("light-medical");
  const [data, setData] = useState(emptyState);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [quickActionModal, setQuickActionModal] = useState(null); // "patient" | "appointment" | "treatment" | null

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api("/api/bootstrap");
      setData(res);
      if (selectedPatient) {
        const updated = res.patients.find((p) => p.id === selectedPatient.id);
        if (updated) setSelectedPatient(updated);
      }
    } catch (error) {
      setToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patientMap = useMemo(() => new Map(data.patients.map((p) => [p.id, p])), [data.patients]);
  const doctorMap = useMemo(() => new Map(data.doctors.map((d) => [d.id, d])), [data.doctors]);
  const treatmentMap = useMemo(() => new Map(data.treatments.map((t) => [t.code, t])), [data.treatments]);

  const metrics = useMemo(() => {
    const outstanding = data.bills.reduce((sum, bill) => sum + Math.max(0, Number(bill.totalAmount) - Number(bill.amountPaid)), 0);
    const collected = data.bills.reduce((sum, bill) => sum + Number(bill.amountPaid), 0);
    const scheduled = data.appointments.filter((a) => a.status === "SCHEDULED").length;
    const completedApps = data.appointments.filter((a) => a.status === "COMPLETED").length;
    
    return [
      {
        label: "Registered Patients",
        value: data.patients.length,
        detail: "+3 this month",
        trend: "up",
        icon: Users,
        badge: "EMR Active"
      },
      {
        label: "Active Triage Queue",
        value: scheduled,
        detail: `${completedApps} consultations completed`,
        trend: "neutral",
        icon: CalendarClock,
        badge: "Real-Time"
      },
      {
        label: "Revenue Collected",
        value: money.format(collected),
        detail: "Across all billing modes",
        trend: "up",
        icon: IndianRupee,
        badge: "99.4% Verified"
      },
      {
        label: "Outstanding Balance",
        value: money.format(outstanding),
        detail: `${data.bills.filter((b) => b.paymentStatus !== "PAID").length} open invoices`,
        trend: outstanding > 0 ? "down" : "up",
        icon: Activity,
        badge: "Receivables"
      }
    ];
  }, [data]);

  const patientBalance = (patientId) =>
    data.bills
      .filter((bill) => bill.patientId === patientId)
      .reduce((sum, bill) => sum + Math.max(0, Number(bill.totalAmount) - Number(bill.amountPaid)), 0);

  const matches = (text = "") => text.toLowerCase().includes(query.trim().toLowerCase());

  const submit = async (path, formData, successMessage) => {
    try {
      await api(path, { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
      setToast(successMessage);
      await load();
      return true;
    } catch (error) {
      setToast(error.message);
      return false;
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await api(`/api/appointments/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      setToast(`Appointment marked as ${newStatus}`);
      await load();
    } catch (error) {
      setToast(error.message);
    }
  };

  const rescheduleAppointment = async (id, newDateTime) => {
    try {
      await api(`/api/appointments/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ appointmentAt: newDateTime })
      });
      setToast("Appointment rescheduled successfully.");
      await load();
      return true;
    } catch (error) {
      setToast(error.message);
      return false;
    }
  };

  const addDoctor = async (payload) => {
    try {
      await api("/api/doctors", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setToast("Specialist registered successfully.");
      await load();
      return true;
    } catch (error) {
      setToast(error.message);
      return false;
    }
  };

  const editDoctor = async (id, payload) => {
    try {
      await api(`/api/doctors/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setToast("Specialist profile updated.");
      await load();
      return true;
    } catch (error) {
      setToast(error.message);
      return false;
    }
  };

  const deleteDoctor = async (id) => {
    try {
      await api(`/api/doctors/${id}`, {
        method: "DELETE"
      });
      setToast("Specialist removed from directory.");
      await load();
      return true;
    } catch (error) {
      setToast(error.message);
      return false;
    }
  };

  const appointmentOptions = data.appointments.filter(
    (a) => a.status === "COMPLETED" && !data.treatmentRecords.some((t) => t.appointmentId === a.id)
  );
  const unpaidBills = data.bills.filter((bill) => Number(bill.totalAmount) > Number(bill.amountPaid));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse size={26} />
          </div>
          <div>
            <strong>TINT Care+</strong>
            <small>made by Anindya</small>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const count =
              item.id === "patients"
                ? data.patients.length
                : item.id === "appointments"
                ? data.appointments.filter((a) => a.status === "SCHEDULED").length
                : item.id === "billing"
                ? unpaidBills.length
                : null;
            return (
              <button
                className={`nav-item ${activeView === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                type="button"
                title={item.label}
              >
                <Icon />
                <span>{item.label}</span>
                {count !== null && count > 0 && <span className="nav-badge">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="stack-panel">
          <div className="stack-row">
            <Database />
            <div>
              <strong>Supabase PostgreSQL</strong>
              <small>Prisma ORM • Pooler v2.0</small>
            </div>
          </div>
          <div className="stack-row">
            <ShieldCheck />
            <div>
              <strong>ICD-10 Clinical Sync</strong>
              <small>Auto-billing & EMR audit</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Medical Enterprise Command Center</p>
            <h1>{navItems.find((item) => item.id === activeView)?.label || "Dashboard"}</h1>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient, EMR code, diagnosis, doctor..."
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} style={{ background: "transparent", border: 0, padding: 0 }}>
                  <X size={16} color="var(--muted)" />
                </button>
              )}
            </label>

            <button className="icon-button" onClick={load} type="button" title="Sync Live Database">
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        {toast && (
          <div className="toast" role="status" onAnimationEnd={() => setToast("")}>
            <CheckCircle2 color="var(--primary)" size={22} />
            <span>{toast}</span>
          </div>
        )}

        {activeView === "dashboard" && (
          <Dashboard
            metrics={metrics}
            data={data}
            patientMap={patientMap}
            doctorMap={doctorMap}
            treatmentMap={treatmentMap}
            matches={matches}
            onSelectPatient={setSelectedPatient}
            onNavigate={setActiveView}
            onOpenQuickAction={setQuickActionModal}
            updateStatus={updateStatus}
            rescheduleAppointment={rescheduleAppointment}
          />
        )}

        {activeView === "patients" && (
          <Patients
            data={data}
            patientBalance={patientBalance}
            matches={matches}
            submit={submit}
            onSelectPatient={setSelectedPatient}
            quickActionModal={quickActionModal}
            setQuickActionModal={setQuickActionModal}
          />
        )}

        {activeView === "appointments" && (
          <Appointments
            data={data}
            patientMap={patientMap}
            doctorMap={doctorMap}
            matches={matches}
            submit={submit}
            updateStatus={updateStatus}
            onSelectPatient={setSelectedPatient}
            rescheduleAppointment={rescheduleAppointment}
          />
        )}

        {activeView === "treatments" && (
          <Treatments
            data={data}
            appointmentOptions={appointmentOptions}
            patientMap={patientMap}
            doctorMap={doctorMap}
            treatmentMap={treatmentMap}
            matches={matches}
            submit={submit}
          />
        )}

        {activeView === "billing" && (
          <Billing
            data={data}
            patientMap={patientMap}
            unpaidBills={unpaidBills}
            matches={matches}
            submit={submit}
            onSelectPatient={setSelectedPatient}
          />
        )}

        {activeView === "wards" && (
          <WardsAndStaff
            data={data}
            matches={matches}
            addDoctor={addDoctor}
            editDoctor={editDoctor}
            deleteDoctor={deleteDoctor}
          />
        )}
      </main>

      {/* Slide-over Patient Drawer */}
      {selectedPatient && (
        <PatientDrawer
          patient={selectedPatient}
          balance={patientBalance(selectedPatient.id)}
          data={data}
          doctorMap={doctorMap}
          treatmentMap={treatmentMap}
          onClose={() => setSelectedPatient(null)}
          onBookAppointment={() => {
            setSelectedPatient(null);
            setActiveView("appointments");
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Dashboard View
   ========================================================================== */
function Dashboard({ metrics, data, patientMap, doctorMap, treatmentMap, matches, onSelectPatient, onNavigate, onOpenQuickAction, updateStatus }) {
  const billingMix = ["PAID", "PARTIAL", "UNPAID"].map((status) => ({
    name: status,
    value: data.bills.filter((bill) => bill.paymentStatus === status).length || 0
  }));

  const departmentLoad = data.doctors.map((doctor) => ({
    name: doctor.department,
    appointments: data.appointments.filter((a) => a.doctorId === doctor.id).length,
    doctorName: doctor.fullName
  }));

  const feed = [
    ...data.treatmentRecords.map((record) => ({
      type: "Treatment",
      text: `${patientMap.get(record.patientId)?.fullName || "Patient"} underwent ${treatmentMap.get(record.treatmentCode)?.description || record.treatmentCode}`,
      detail: `Diagnosis: ${record.diagnosis}`,
      date: record.treatmentDate,
      patientId: record.patientId
    })),
    ...data.payments.map((payment) => ({
      type: "Payment",
      text: `Invoice #${payment.billId} received ${money.format(payment.amount)} via ${payment.paymentMode}`,
      detail: payment.referenceNo ? `Ref: ${payment.referenceNo}` : "Verified Transaction",
      date: payment.paymentDate,
      patientId: data.bills.find((b) => b.id === payment.billId)?.patientId
    }))
  ]
    .filter((item) => matches(`${item.type} ${item.text} ${item.detail}`))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  return (
    <section className="view-grid">
      {/* Quick Actions Command Bar */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            onNavigate("patients");
          }}
          style={{ minHeight: "42px", padding: "0 18px" }}
        >
          <UserPlus size={18} /> Patient Intake
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onNavigate("appointments")}
          style={{ minHeight: "42px" }}
        >
          <CalendarPlus size={18} /> Schedule Triage
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onNavigate("treatments")}
          style={{ minHeight: "42px" }}
        >
          <Stethoscope size={18} /> Clinical Diagnosis
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onNavigate("wards")}
          style={{ minHeight: "42px" }}
        >
          <BedDouble size={18} /> Ward & Bed Map
        </button>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top">
                <span>{metric.label}</span>
                <div className="metric-icon-wrap">
                  <Icon size={22} />
                </div>
              </div>
              <strong className="mono">{metric.value}</strong>
              <div className="metric-bottom">
                <small>{metric.detail}</small>
                <span className={`trend-badge ${metric.trend}`}>
                  <TrendingUp size={12} /> {metric.badge}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="panel wide">
          <PanelTitle kicker="Live Triage & Queue" title="Schedule & Active Appointments" badge="Real-Time Sync" />
          <div className="timeline">
            {data.appointments
              .filter((a) => matches(`${patientMap.get(a.patientId)?.fullName} ${doctorMap.get(a.doctorId)?.fullName} ${a.reason}`))
              .map((appointment) => {
                const p = patientMap.get(appointment.patientId);
                const d = doctorMap.get(appointment.doctorId);
                return (
                  <article className="timeline-item" key={appointment.id}>
                    <div className="time-block">
                      <div>{shortTime.format(new Date(appointment.appointmentAt))}</div>
                      <small style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                        {shortDate.format(new Date(appointment.appointmentAt))}
                      </small>
                    </div>
                    <div style={{ cursor: "pointer" }} onClick={() => p && onSelectPatient(p)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "1.02rem" }}>{p?.fullName || "Patient"}</strong>
                        <span className="badge" style={{ fontSize: "0.7rem", padding: "1px 8px" }}>
                          {p?.bloodGroup || "GEN"}
                        </span>
                      </div>
                      <small style={{ color: "var(--primary)", fontWeight: "600", marginTop: "2px" }}>
                        {d?.fullName || "Doctor"} — {d?.specialization}
                      </small>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>{appointment.reason}</p>
                    </div>
                    <div>
                      <Status status={appointment.status} />
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {appointment.status === "SCHEDULED" && (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: "4px 10px", fontSize: "0.76rem" }}
                            title="Mark Completed"
                            onClick={() => updateStatus(appointment.id, "COMPLETED")}
                          >
                            ✓ Done
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>

        <section className="panel">
          <PanelTitle kicker="Analytics" title="Billing & Revenue Mix" />
          <div className="chart-box">
            {data.bills.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={billingMix} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={5}>
                    {billingMix.map((entry, index) => (
                      <Cell key={entry.name} fill={["#10b981", "#f59e0b", "#f43f5e"][index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-solid)",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      color: "var(--ink)",
                      fontFamily: "Plus Jakarta Sans"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty label="No generated invoices yet" />
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: "10px" }}>
            {billingMix.map((item, idx) => (
              <div key={item.name} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: ["#10b981", "#f59e0b", "#f43f5e"][idx]
                    }}
                  />
                  <strong style={{ fontSize: "0.88rem" }}>{item.name}</strong>
                </div>
                <small style={{ color: "var(--muted)", fontWeight: "700" }}>{item.value} invoices</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <PanelTitle kicker="Workload" title="Department Consultations" />
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={departmentLoad}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="var(--muted)" fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-solid)",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    color: "var(--ink)"
                  }}
                />
                <Bar dataKey="appointments" radius={[8, 8, 0, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel wide">
          <PanelTitle kicker="Live Stream" title="Clinical & Financial Feed" badge="Live Logs" />
          <div className="feed">
            {feed.length ? (
              feed.map((item) => (
                <article
                  className="feed-item"
                  key={`${item.type}-${item.date}-${item.text}`}
                  style={{ cursor: item.patientId ? "pointer" : "default" }}
                  onClick={() => {
                    const p = item.patientId && patientMap.get(item.patientId);
                    if (p) onSelectPatient(p);
                  }}
                >
                  <span className="feed-icon">{item.type === "Treatment" ? <Stethoscope /> : <CreditCard />}</span>
                  <div>
                    <strong>{item.text}</strong>
                    <small style={{ display: "block" }}>{item.detail}</small>
                    <small style={{ color: "var(--primary)", fontSize: "0.72rem", fontWeight: "700" }}>
                      {shortDate.format(new Date(item.date))} • {shortTime.format(new Date(item.date))}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <Empty label="No recent clinical or payment stream" />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

/* ==========================================================================
   Patients View
   ========================================================================== */
function Patients({ data, patientBalance, matches, submit, onSelectPatient }) {
  const [filterBlood, setFilterBlood] = useState("ALL");
  const bloodGroups = ["ALL", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  const filteredPatients = data.patients.filter((patient) => {
    const matchQuery = matches(`${patient.id} ${patient.fullName} ${patient.phone} ${patient.bloodGroup} ${patient.address}`);
    const matchBlood = filterBlood === "ALL" || patient.bloodGroup === filterBlood;
    return matchQuery && matchBlood;
  });

  return (
    <section className="content-grid">
      <section className="panel">
        <PanelTitle kicker="Intake Form" title="Register New Patient" />
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await submit("/api/patients", new FormData(event.currentTarget), "Patient registered to EMR directory.")) {
              event.currentTarget.reset();
            }
          }}
        >
          <Field name="fullName" label="Full Legal Name" placeholder="e.g. Vikramaditya Roy" required />
          <Field name="dateOfBirth" label="Date of Birth" type="date" required />
          <Select name="gender" label="Gender" options={["MALE", "FEMALE", "OTHER"]} />
          <Select name="bloodGroup" label="Blood Group" options={["B+", "O+", "A+", "AB+", "B-", "O-", "A-", "AB-"]} />
          <Field name="phone" label="Contact Phone" placeholder="9876543210" required />
          <Field name="emergencyContact" label="Emergency Contact (Name & Phone)" placeholder="e.g. Anita - 9876511111" />
          <Field name="address" label="Residential Address" placeholder="Street, City, Postal Code" className="full" />
          <button className="primary-button full" type="submit">
            <UserPlus size={18} /> Register Patient Profile
          </button>
        </form>
      </section>

      <section className="panel large">
        <PanelTitle kicker="Directory" title="EMR Patient Directory" badge={`${filteredPatients.length} Active Profiles`} />
        
        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
          {bloodGroups.map((bg) => (
            <button
              key={bg}
              type="button"
              onClick={() => setFilterBlood(bg)}
              className="secondary-button"
              style={{
                minHeight: "30px",
                padding: "0 12px",
                fontSize: "0.76rem",
                background: filterBlood === bg ? "var(--primary)" : "var(--surface-soft)",
                color: filterBlood === bg ? "var(--primary-text)" : "var(--ink)",
                borderColor: filterBlood === bg ? "var(--primary)" : "var(--line)"
              }}
            >
              {bg === "ALL" ? "All Blood Groups" : `Group ${bg}`}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient Profile</th>
                <th>Age</th>
                <th>Blood</th>
                <th>Contact</th>
                <th>Outstanding</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => {
                const balance = patientBalance(patient.id);
                return (
                  <tr key={patient.id} style={{ cursor: "pointer" }} onClick={() => onSelectPatient(patient)}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">{initials(patient.fullName)}</span>
                        <div>
                          <strong>{patient.fullName}</strong>
                          <small>EMR #{patient.id} • Registered {shortDate.format(new Date(patient.createdAt))}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="mono">{calcAge(patient.dateOfBirth)} yrs</span></td>
                    <td>
                      <span className="badge" style={{ fontWeight: "800", color: "var(--primary)" }}>
                        {patient.bloodGroup || "N/A"}
                      </span>
                    </td>
                    <td>{patient.phone}</td>
                    <td>
                      <span className="mono" style={{ fontWeight: "700", color: balance > 0 ? "var(--coral)" : "var(--green)" }}>
                        {money.format(balance)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ padding: "4px 10px", fontSize: "0.76rem" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPatient(patient);
                        }}
                      >
                        Open Record <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

/* ==========================================================================
   Appointments View
   ========================================================================== */
function Appointments({ data, patientMap, doctorMap, matches, submit, updateStatus, onSelectPatient, rescheduleAppointment }) {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [rescheduleId, setRescheduleId] = useState(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedTime, setReschedTime] = useState("");

  const filteredAppointments = data.appointments.filter((a) => {
    const matchQuery = matches(`${patientMap.get(a.patientId)?.fullName} ${doctorMap.get(a.doctorId)?.fullName} ${a.reason}`);
    const matchStatus = filterStatus === "ALL" || a.status === filterStatus;
    return matchQuery && matchStatus;
  });

  return (
    <section className="content-grid">
      <section className="panel">
        <PanelTitle kicker="Queue Management" title="Schedule Medical Consultation" />
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            form.set("appointmentAt", `${form.get("date")}T${form.get("time")}:00`);
            form.delete("date");
            form.delete("time");
            if (await submit("/api/appointments", form, "Consultation scheduled.")) {
              event.currentTarget.reset();
            }
          }}
        >
          <Select name="patientId" label="Patient Profile" options={data.patients.map((p) => [p.id, `${p.fullName} (#${p.id})`])} />
          <Select name="doctorId" label="Attending Specialist" options={data.doctors.map((d) => [d.id, `${d.fullName} — ${d.specialization}`])} />
          <Field name="date" label="Appointment Date" type="date" required />
          <Field name="time" label="Time Slot" type="time" required />
          <Field name="reason" label="Chief Complaint / Reason" placeholder="Symptoms, routine checkup, ECG..." className="full" required />
          <button className="primary-button full" type="submit">
            <CalendarPlus size={18} /> Book & Add to Queue
          </button>
        </form>
      </section>

      <section className="panel large">
        <PanelTitle kicker="Triage Center" title="Live Consultations" badge={`${filteredAppointments.length} Found`} />

        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          {["ALL", "SCHEDULED", "COMPLETED", "CANCELLED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className="secondary-button"
              style={{
                minHeight: "30px",
                padding: "0 12px",
                fontSize: "0.76rem",
                background: filterStatus === st ? "var(--primary)" : "var(--surface-soft)",
                color: filterStatus === st ? "var(--primary-text)" : "var(--ink)"
              }}
            >
              {st === "ALL" ? "All Queue" : st}
            </button>
          ))}
        </div>

        <div className="card-list">
          {filteredAppointments.map((appointment) => {
            const p = patientMap.get(appointment.patientId);
            const d = doctorMap.get(appointment.doctorId);
            const isRescheduling = rescheduleId === appointment.id;
            return (
              <article className="data-card" key={appointment.id} style={{ cursor: "pointer" }} onClick={() => p && onSelectPatient(p)}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h3 style={{ margin: 0 }}>{p?.fullName || "Patient"}</h3>
                    <span className="badge" style={{ fontSize: "0.72rem" }}>{p?.bloodGroup || "GEN"}</span>
                  </div>
                  <small style={{ color: "var(--primary)", fontWeight: "600", display: "block", marginTop: "2px" }}>
                    Attending: {d?.fullName} ({d?.specialization})
                  </small>
                </div>
                <Status status={appointment.status} />
                <div className="meta-line" style={{ width: "100%" }}>
                  <span className="mono">{shortDate.format(new Date(appointment.appointmentAt))}</span>
                  <span className="mono">{shortTime.format(new Date(appointment.appointmentAt))}</span>
                  <span style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--ink)" }}>{appointment.reason}</span>
                </div>
                {appointment.status === "SCHEDULED" && (
                  <div style={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
                    {isRescheduling ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px", alignItems: "center" }}>
                        <input
                          type="date"
                          value={reschedDate}
                          onChange={(e) => setReschedDate(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", fontSize: "0.85rem", color: "var(--ink)" }}
                        />
                        <input
                          type="time"
                          value={reschedTime}
                          onChange={(e) => setReschedTime(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", fontSize: "0.85rem", color: "var(--ink)" }}
                        />
                        <button
                          type="button"
                          className="primary-button"
                          style={{ minHeight: "34px", padding: "0 12px", fontSize: "0.78rem" }}
                          onClick={async () => {
                            if (!reschedDate || !reschedTime) return;
                            const ok = await rescheduleAppointment(appointment.id, `${reschedDate}T${reschedTime}:00`);
                            if (ok) setRescheduleId(null);
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ minHeight: "34px", padding: "0 12px", fontSize: "0.78rem" }}
                          onClick={() => setRescheduleId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ minHeight: "34px", padding: "0 14px", fontSize: "0.8rem" }}
                          onClick={() => updateStatus(appointment.id, "COMPLETED")}
                        >
                          ✓ Mark Completed
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ minHeight: "34px", padding: "0 14px", fontSize: "0.8rem" }}
                          onClick={() => {
                            const dt = new Date(appointment.appointmentAt);
                            // Adjust for timezone offset to prevent date shifting in inputs
                            const year = dt.getFullYear();
                            const month = String(dt.getMonth() + 1).padStart(2, "0");
                            const date = String(dt.getDate()).padStart(2, "0");
                            const hours = String(dt.getHours()).padStart(2, "0");
                            const minutes = String(dt.getMinutes()).padStart(2, "0");
                            setReschedDate(`${year}-${month}-${date}`);
                            setReschedTime(`${hours}:${minutes}`);
                            setRescheduleId(appointment.id);
                          }}
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ minHeight: "34px", padding: "0 14px", fontSize: "0.8rem", color: "var(--coral)" }}
                          onClick={() => updateStatus(appointment.id, "CANCELLED")}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

/* ==========================================================================
   Treatments View
   ========================================================================== */
function Treatments({ data, appointmentOptions, patientMap, doctorMap, treatmentMap, matches, submit }) {
  return (
    <section className="content-grid">
      <section className="panel">
        <PanelTitle kicker="Clinical EMR" title="Record Diagnosis & Generate Bill" />
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await submit("/api/treatments", new FormData(event.currentTarget), "Diagnosis saved & automated invoice created.")) {
              event.currentTarget.reset();
            }
          }}
        >
          <Select
            name="appointmentId"
            label="Select Active Appointment"
            options={appointmentOptions.map((a) => [
              a.id,
              `${patientMap.get(a.patientId)?.fullName} — ${doctorMap.get(a.doctorId)?.fullName} (${shortTime.format(new Date(a.appointmentAt))})`
            ])}
          />
          <Select
            name="treatmentCode"
            label="ICD / Treatment Procedure"
            options={data.treatments.map((t) => [t.code, `${t.description} — ${money.format(t.standardCost)}`])}
          />
          <Field name="quantity" label="Units / Sessions" type="number" min="1" defaultValue="1" required />
          <Field name="discountPercent" label="Patient Discount (%)" type="number" min="0" defaultValue="5" />
          <TextArea name="diagnosis" label="Clinical Diagnosis & Findings" placeholder="Detail symptoms, vitals, exam notes..." className="full" required />
          <TextArea name="prescription" label="E-Prescription & Advice" placeholder="Medications, dosage, follow-up..." className="full" />
          <button className="primary-button full" type="submit">
            <FilePlus2 size={18} /> Record Clinical EMR & Generate Invoice
          </button>
        </form>
      </section>

      <section className="panel large">
        <PanelTitle kicker="Audit Trail" title="Past Clinical Records" />
        <div className="card-list">
          {data.treatmentRecords.length ? (
            data.treatmentRecords
              .filter((record) => matches(`${patientMap.get(record.patientId)?.fullName} ${record.diagnosis} ${record.treatmentCode}`))
              .map((record) => {
                const p = patientMap.get(record.patientId);
                const d = doctorMap.get(record.doctorId);
                const t = treatmentMap.get(record.treatmentCode);
                return (
                  <article className="data-card" key={record.id}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3 style={{ margin: 0 }}>{p?.fullName || "Patient"}</h3>
                        <span className="badge" style={{ fontSize: "0.72rem" }}>Invoice #{record.billId || "Auto"}</span>
                      </div>
                      <small style={{ color: "var(--primary)", fontWeight: "600", display: "block", marginTop: "4px" }}>
                        {t?.description} ({record.treatmentCode}) by {d?.fullName}
                      </small>
                    </div>
                    <span className="mono" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {shortDate.format(new Date(record.treatmentDate))}
                    </span>
                    <div style={{ width: "100%", background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                      <strong style={{ fontSize: "0.82rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>DIAGNOSIS:</strong>
                      <p style={{ margin: 0, color: "var(--ink)", fontSize: "0.9rem" }}>{record.diagnosis}</p>
                      {record.prescription && (
                        <>
                          <strong style={{ fontSize: "0.82rem", color: "var(--primary)", display: "block", marginTop: "8px", marginBottom: "4px" }}>
                            PRESCRIPTION:
                          </strong>
                          <p style={{ margin: 0, color: "var(--ink-secondary)", fontSize: "0.88rem", fontStyle: "italic" }}>
                            {record.prescription}
                          </p>
                        </>
                      )}
                    </div>
                  </article>
                );
              })
          ) : (
            <Empty label="No clinical treatment records yet" />
          )}
        </div>
      </section>
    </section>
  );
}

/* ==========================================================================
   Billing & Revenue View
   ========================================================================== */
function Billing({ data, patientMap, unpaidBills, matches, submit, onSelectPatient }) {
  return (
    <section className="content-grid">
      <section className="panel">
        <PanelTitle kicker="Cashier & Billing" title="Process Payment" />
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await submit("/api/payments", new FormData(event.currentTarget), "Payment recorded & receipt updated.")) {
              event.currentTarget.reset();
            }
          }}
        >
          <Select
            name="billId"
            label="Pending Invoice"
            options={unpaidBills.map((b) => [
              b.id,
              `Invoice #${b.id} — ${patientMap.get(b.patientId)?.fullName} (Due: ${money.format(Number(b.totalAmount) - Number(b.amountPaid))})`
            ])}
          />
          <Field name="amount" label="Payment Amount (INR)" type="number" min="0.01" step="0.01" required />
          <Select name="paymentMode" label="Payment Mode" options={["UPI", "CARD", "CASH", "INSURANCE"]} />
          <Field name="referenceNo" label="Transaction / Claim ID" placeholder="e.g. UPI/3192019201" className="full" />
          <button className="primary-button full" type="submit">
            <CreditCard size={18} /> Record & Clear Balance
          </button>
        </form>
      </section>

      <section className="panel large">
        <PanelTitle kicker="Ledger" title="All Generated Medical Bills" />
        <div className="card-list">
          {data.bills
            .filter((bill) => matches(`${bill.id} ${patientMap.get(bill.patientId)?.fullName} ${bill.paymentStatus}`))
            .map((bill) => {
              const p = patientMap.get(bill.patientId);
              const due = Number(bill.totalAmount) - Number(bill.amountPaid);
              return (
                <article className="bill-card" key={bill.id} style={{ cursor: "pointer" }} onClick={() => p && onSelectPatient(p)}>
                  <div>
                    <h3 style={{ margin: 0 }}>Invoice #{bill.id}</h3>
                    <small style={{ display: "block", marginTop: "2px" }}>
                      {p?.fullName || "Patient"} • {shortDate.format(new Date(bill.billDate))}
                    </small>
                  </div>
                  <strong className="mono">{money.format(bill.totalAmount)}</strong>
                  <div className="meta-line">
                    <span>Paid: {money.format(bill.amountPaid)}</span>
                    <span style={{ color: due > 0 ? "var(--coral)" : "var(--green)" }}>Balance: {money.format(due)}</span>
                    <Status status={bill.paymentStatus} />
                  </div>
                  <div className="bill-items">
                    {bill.items?.map((item) => (
                      <span key={item.id}>{item.description} × {Number(item.quantity)}</span>
                    ))}
                  </div>
                </article>
              );
            })}
        </div>
      </section>
    </section>
  );
}

/* ==========================================================================
   Wards & Staff Directory View (New Module)
   ========================================================================== */
function WardsAndStaff({ data, matches, addDoctor, editDoctor, deleteDoctor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [fullName, setFullName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consultationFee, setConsultationFee] = useState("");

  const filteredDoctors = data.doctors.filter((doc) =>
    matches(`${doc.fullName} ${doc.specialization} ${doc.department}`)
  );

  const openAdd = () => {
    setFullName("");
    setSpecialization("");
    setDepartmentName("");
    setPhone("");
    setEmail("");
    setConsultationFee("500");
    setEditId(null);
    setIsOpen(true);
  };

  const openEdit = (doc) => {
    setFullName(doc.fullName);
    setSpecialization(doc.specialization);
    setDepartmentName(doc.department);
    setPhone(doc.phone);
    setEmail(doc.email || "");
    setConsultationFee(String(doc.consultationFee));
    setEditId(doc.id);
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      fullName,
      specialization,
      departmentName,
      phone,
      email: email || null,
      consultationFee: Number(consultationFee)
    };
    let success = false;
    if (editId) {
      success = await editDoctor(editId, payload);
    } else {
      success = await addDoctor(payload);
    }
    if (success) setIsOpen(false);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the specialist roster?`)) {
      await deleteDoctor(id);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <section className="panel" style={{ minHeight: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <p className="eyebrow">Medical Roster</p>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Attending Specialists Directory</h2>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span className="badge">{filteredDoctors.length} Specialists</span>
            <button type="button" className="primary-button" style={{ minHeight: "38px", padding: "0 16px", fontSize: "0.86rem" }} onClick={openAdd}>
              <Plus size={16} /> Register Specialist
            </button>
          </div>
        </div>

        <div className="doctor-grid">
          {filteredDoctors.map((doc) => (
            <div className="doctor-card" key={doc.id}>
              <div className="doctor-header">
                <div className="doctor-avatar">{initials(doc.fullName)}</div>
                <div className="doctor-info">
                  <strong>{doc.fullName}</strong>
                  <small>{doc.specialization}</small>
                </div>
              </div>
              <div style={{ fontSize: "0.86rem", color: "var(--muted)", display: "grid", gap: "4px" }}>
                <div>Department: <strong style={{ color: "var(--ink)" }}>{doc.department}</strong></div>
                <div>Contact: <span className="mono">{doc.phone}</span></div>
                {doc.email && <div>Email: <span style={{ color: "var(--blue)" }}>{doc.email}</span></div>}
              </div>
              <div className="doctor-stats" style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                <div>Consult Fee: <strong className="mono">{money.format(doc.consultationFee)}</strong></div>
                <div>Status: <strong style={{ color: "var(--green)" }}>● Active Shift</strong></div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ flex: 1, minHeight: "34px", padding: "0 10px", fontSize: "0.78rem" }}
                  onClick={() => openEdit(doc)}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ minHeight: "34px", padding: "0 10px", fontSize: "0.78rem", color: "var(--coral)", borderColor: "rgba(244, 63, 94, 0.2)" }}
                  onClick={() => handleDelete(doc.id, doc.fullName)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Specialist Creation/Edit Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-drawer" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">{editId ? "Update Roster Profile" : "Intake Registry"}</p>
                <h2>{editId ? "Edit Attending Specialist" : "Register Attending Specialist"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsOpen(false)} title="Close Modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form-grid" style={{ gap: "16px" }}>
              <label className="full">
                <span>Full Professional Name (with credentials)</span>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Dr. Sattyabrata Maity" required />
              </label>
              <label>
                <span>Specialization / Area</span>
                <input type="text" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. Cardiologist" required />
              </label>
              <label>
                <span>Attending Department</span>
                <input type="text" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="e.g. Cardiology" required />
              </label>
              <label>
                <span>Direct Contact Phone</span>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9830098300" required />
              </label>
              <label>
                <span>Consultation Fee (INR)</span>
                <input type="number" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} placeholder="500" required />
              </label>
              <label className="full">
                <span>Hospital Email Address (Optional)</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@hospital.example" />
              </label>
              <div className="full" style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button type="submit" className="primary-button" style={{ flex: 1, minHeight: "44px" }}>
                  {editId ? "Save Profile Changes" : "Register Specialist Roster"}
                </button>
                <button type="button" className="secondary-button" style={{ minHeight: "44px" }} onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Patient Medical Record Drawer (Slide-Over)
   ========================================================================== */
function PatientDrawer({ patient, balance, data, doctorMap, treatmentMap, onClose, onBookAppointment }) {
  const patientAppointments = data.appointments.filter((a) => a.patientId === patient.id);
  const patientTreatments = data.treatmentRecords.filter((t) => t.patientId === patient.id);
  const patientBills = data.bills.filter((b) => b.patientId === patient.id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Complete Medical Dossier</p>
            <h2>{patient.fullName}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close Dossier">
            <X size={20} />
          </button>
        </div>

        {/* Demographics Summary Card */}
        <div style={{ background: "var(--surface-soft)", padding: "18px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="badge" style={{ fontSize: "0.82rem", background: "var(--primary-glow)", color: "var(--primary-text)" }}>
              Blood Group: {patient.bloodGroup || "Not Recorded"}
            </span>
            <span className="mono" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>EMR ID #{patient.id}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.88rem" }}>
            <div><strong>Gender:</strong> {patient.gender}</div>
            <div><strong>Age:</strong> {calcAge(patient.dateOfBirth)} years</div>
            <div><strong>Phone:</strong> <span className="mono">{patient.phone}</span></div>
            <div><strong>DOB:</strong> <span className="mono">{shortDate.format(new Date(patient.dateOfBirth))}</span></div>
            <div style={{ gridColumn: "1 / -1" }}><strong>Address:</strong> {patient.address || "N/A"}</div>
            <div style={{ gridColumn: "1 / -1" }}><strong>Emergency Contact:</strong> {patient.emergencyContact || "N/A"}</div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button type="button" className="primary-button" style={{ flex: 1, minHeight: "40px", fontSize: "0.86rem" }} onClick={onBookAppointment}>
              <CalendarPlus size={16} /> Book New Triage
            </button>
          </div>
        </div>

        {/* Financial Summary Pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: balance > 0 ? "rgba(244, 63, 94, 0.12)" : "rgba(16, 185, 129, 0.12)", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <div>
            <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--ink)" }}>Current Outstanding Balance</strong>
            <small style={{ color: "var(--muted)" }}>Total generated invoices vs cleared payments</small>
          </div>
          <strong className="mono" style={{ fontSize: "1.4rem", color: balance > 0 ? "var(--coral)" : "var(--green)" }}>
            {money.format(balance)}
          </strong>
        </div>

        {/* Clinical History */}
        <div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Stethoscope size={18} color="var(--primary)" /> Clinical Treatment Logs ({patientTreatments.length})
          </h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {patientTreatments.length ? (
              patientTreatments.map((rec) => {
                const doc = doctorMap.get(rec.doctorId);
                const t = treatmentMap.get(rec.treatmentCode);
                return (
                  <div key={rec.id} style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <strong>{t?.description || rec.treatmentCode}</strong>
                      <span className="mono" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{shortDate.format(new Date(rec.treatmentDate))}</span>
                    </div>
                    <small style={{ color: "var(--primary)", fontWeight: "600", display: "block", marginBottom: "8px" }}>Attending: {doc?.fullName}</small>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink)" }}>{rec.diagnosis}</p>
                    {rec.prescription && (
                      <div style={{ marginTop: "8px", padding: "8px", background: "var(--surface-soft)", borderRadius: "8px", fontSize: "0.82rem", fontStyle: "italic", color: "var(--ink-secondary)" }}>
                        Rx: {rec.prescription}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <Empty label="No EMR treatments recorded" />
            )}
          </div>
        </div>

        {/* Invoice Ledger */}
        <div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <ReceiptText size={18} color="var(--primary)" /> Billing Invoices ({patientBills.length})
          </h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {patientBills.length ? (
              patientBills.map((b) => (
                <div key={b.id} style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>Invoice #{b.id}</strong>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem" }}>{shortDate.format(new Date(b.billDate))}</small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong className="mono" style={{ display: "block" }}>{money.format(b.totalAmount)}</strong>
                    <Status status={b.paymentStatus} />
                  </div>
                </div>
              ))
            ) : (
              <Empty label="No invoices generated" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Shared UI Helpers
   ========================================================================== */
function PanelTitle({ kicker, title, badge }) {
  return (
    <div className="panel-title">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {badge && <span className="badge">{badge}</span>}
    </div>
  );
}

function Field({ label, className = "", ...props }) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function TextArea({ label, className = "", ...props }) {
  return (
    <label className={className}>
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <select {...props}>
        {options.map((option) => {
          const value = Array.isArray(option) ? option[0] : option;
          const text = Array.isArray(option) ? option[1] : option;
          return <option value={value} key={value}>{text}</option>;
        })}
      </select>
    </label>
  );
}

function Status({ status }) {
  return <span className={`status ${status}`}>{status}</span>;
}

function Empty({ label }) {
  return <div className="empty">{label}</div>;
}
