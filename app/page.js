"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Clock,
  Database,
  Download,
  Edit3,
  Eye,
  FileDown,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Network,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Trash2,
  UploadCloud,
  Users,
  Wifi
} from "lucide-react";
import {
  initialAccounting,
  initialNasServers,
  initialPfSenseServers,
  initialVoucherBatches,
  initialVouchers
} from "@/lib/mock-data";

const moneyFormatter = new Intl.NumberFormat("fr-FR");

function maskSecret(secret) {
  return `****${secret.slice(-3)}`;
}

function minutesLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${String(mins).padStart(2, "0")}`;
}

function bandwidthLabel(kbps) {
  const value = Number(kbps || 0);
  return value > 0 ? `${value} kbit/s` : "Illimité";
}

const VOUCHER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
const MAX_BATCH_QUANTITY = 30000;

function makeVoucherCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => VOUCHER_ALPHABET[value % VOUCHER_ALPHABET.length]).join("");
}

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard");
  const [pfSenseServers, setPfSenseServers] = useState(initialPfSenseServers);
  const [nasServers, setNasServers] = useState(initialNasServers);
  const [batches, setBatches] = useState(initialVoucherBatches);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [accounting, setAccounting] = useState(initialAccounting);
  const [selectedPfSense, setSelectedPfSense] = useState("pfs-1");
  const [voucherQuery, setVoucherQuery] = useState("A1B2-C3D4-E5F6");
  const [toast, setToast] = useState("Interface prête à brancher sur FreeRADIUS SQL");
  const [pfSenseForm, setPfSenseForm] = useState({ name: "", ip: "", radiusSecret: "" });
  const [voucherForm, setVoucherForm] = useState({ code: "", duration: 1440, uploadKbps: 0, downloadKbps: 0, pfsenseId: "all" });
  const [batchForm, setBatchForm] = useState({ name: "", quantity: 50, duration: 1440, pfsenseId: "all" });

  function applySnapshot(snapshot) {
    if (snapshot.pfSenseServers) setPfSenseServers(snapshot.pfSenseServers);
    if (snapshot.nasServers) setNasServers(snapshot.nasServers);
    if (snapshot.batches) setBatches(snapshot.batches);
    if (snapshot.vouchers) setVouchers(snapshot.vouchers);
    if (snapshot.accounting) setAccounting(snapshot.accounting);
    if (snapshot.pfSenseServers?.length && !snapshot.pfSenseServers.some((server) => server.id === selectedPfSense)) {
      setSelectedPfSense(snapshot.pfSenseServers[0].id);
    }
  }

  async function callApi(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || "Erreur API");
      error.status = response.status;
      throw error;
    }
    applySnapshot(payload);
    return payload;
  }

  useEffect(() => {
    callApi("/api/snapshot")
      .then(() => notify("Donnees reelles chargees depuis FreeRADIUS SQL."))
      .catch((error) => notify(`Mode local: ${error.message}`));
  }, []);

  const activePfSense = pfSenseServers.find((server) => server.id === selectedPfSense) ?? pfSenseServers[0];
  const onlineNas = nasServers.filter((nas) => nas.status === "online").length;
  const activeConnections = accounting.filter((item) => item.status === "online").length;
  const activeVouchers = vouchers.filter((voucher) => voucher.status === "active").length;
  const revokedVouchers = vouchers.filter((voucher) => voucher.status === "revoked").length;
  const totalConnections = pfSenseServers.reduce((total, server) => total + server.connections, 0);
  const pingValues = pfSenseServers.filter((server) => server.ping !== null).map((server) => server.ping);
  const avgPing = pingValues.length
    ? Math.round(pingValues.reduce((total, ping) => total + ping, 0) / pingValues.length)
    : 0;

  const filteredVouchers = useMemo(() => {
    const query = voucherQuery.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const pfSenseMatch = voucher.pfsenseId === selectedPfSense || selectedPfSense === "all";
      if (!query) return pfSenseMatch;
      return pfSenseMatch && voucher.code.toLowerCase().includes(query);
    });
  }, [selectedPfSense, voucherQuery, vouchers]);

  const testedVoucher = vouchers.find((voucher) => voucher.code.toLowerCase() === voucherQuery.trim().toLowerCase());

  function notify(message) {
    setToast(message);
  }

  async function addPfSense(event) {
    event.preventDefault();
    if (!pfSenseForm.name || !pfSenseForm.ip || !pfSenseForm.radiusSecret) {
      notify("Nom, IP et secret RADIUS sont obligatoires.");
      return;
    }
    try {
      await callApi("/api/pfsense", {
        method: "POST",
        body: JSON.stringify(pfSenseForm)
      });
      setPfSenseForm({ name: "", ip: "", radiusSecret: "" });
      notify("Serveur pfSense ajoute dans la table nas FreeRADIUS.");
      return;
    } catch (error) {
      notify(`API indisponible, ajout local: ${error.message}`);
    }
    const id = `pfs-${Date.now()}`;
    setPfSenseServers((current) => [
      ...current,
      {
        id,
        name: pfSenseForm.name.toUpperCase(),
        ip: pfSenseForm.ip,
        radiusSecret: pfSenseForm.radiusSecret,
        status: "active",
        ping: 64,
        connections: 0,
        nasCount: 1,
        lastSeen: "maintenant"
      }
    ]);
    setNasServers((current) => [
      ...current,
      {
        id: `nas-${Date.now()}`,
        name: `NAS-${pfSenseForm.name.toUpperCase()}`,
        shortname: pfSenseForm.name.toLowerCase().replaceAll(" ", "-"),
        ip: pfSenseForm.ip,
        type: "other",
        pfsenseId: id,
        secret: pfSenseForm.radiusSecret,
        status: "online"
      }
    ]);
    setPfSenseForm({ name: "", ip: "", radiusSecret: "" });
    notify("Serveur pfSense ajouté avec son entrée NAS.");
  }

  async function togglePfSense(id) {
    try {
      await callApi("/api/pfsense", {
        method: "PATCH",
        body: JSON.stringify({ id })
      });
      notify("Statut pfSense mis a jour dans FreeRADIUS.");
      return;
    } catch (error) {
      notify(`API indisponible, bascule locale: ${error.message}`);
    }
    setPfSenseServers((current) =>
      current.map((server) =>
        server.id === id
          ? { ...server, status: server.status === "active" ? "inactive" : "active" }
          : server
      )
    );
    notify("Statut pfSense mis à jour.");
  }

  async function testPfSense(id) {
    const server = pfSenseServers.find((item) => item.id === id);
    try {
      const snapshot = await callApi("/api/pfsense/test", {
        method: "POST",
        body: JSON.stringify({ id })
      });
      const tested = snapshot.pfSenseServers?.find((item) => item.id === id);
      if (tested?.ping) {
        notify(`Ping public ${server?.publicIp ?? server?.ip}: ${tested.ping} ms.`);
      } else {
        notify(`Ping public impossible vers ${server?.publicIp ?? server?.ip}.`);
      }
      return;
    } catch (error) {
      notify(`API indisponible, ping local: ${error.message}`);
    }
    setPfSenseServers((current) =>
      current.map((item) => (item.id === id ? { ...item, ping: null } : item))
    );
  }

  async function deletePfSense(id) {
    const server = pfSenseServers.find((item) => item.id === id);
    if (!server) return;
    if (!window.confirm(`Supprimer completement ${server.name} de FreeRADIUS ? Les vouchers, lots et logs accounting lies a ce serveur seront supprimes.`)) {
      return;
    }
    try {
      await callApi("/api/pfsense/delete", {
        method: "POST",
        body: JSON.stringify({ id })
      });
      notify(`${server.name} supprime de FreeRADIUS.`);
      return;
    } catch (error) {
      notify(`API indisponible, suppression locale: ${error.message}`);
    }
    setPfSenseServers((current) => current.filter((item) => item.id !== id));
    setNasServers((current) => current.filter((item) => item.pfsenseId !== id && item.id !== id));
    setVouchers((current) => current.filter((item) => item.pfsenseId !== id));
    setBatches((current) => current.filter((item) => item.pfsenseId !== id));
    setAccounting((current) => current.filter((item) => item.pfsenseId !== id));
    notify(`${server.name} supprime localement.`);
  }

  async function addVoucher(event) {
    event.preventDefault();
    try {
      const code = voucherForm.code.trim();
      await callApi("/api/vouchers", {
        method: "POST",
        body: JSON.stringify(voucherForm)
      });
      if (code) setVoucherQuery(code);
      setVoucherForm({ code: "", duration: 1440, uploadKbps: 0, downloadKbps: 0, pfsenseId: "all" });
      notify("Voucher cree dans vouchers, radcheck et radreply.");
      return;
    } catch (error) {
      if (error.status) {
        notify(error.message);
        return;
      }
      notify(`API indisponible, creation locale: ${error.message}`);
    }
    const id = `v-${Date.now()}`;
    let code = (voucherForm.code.trim() || makeVoucherCode()).toUpperCase();
    while (!voucherForm.code.trim() && vouchers.some((voucher) => voucher.code.toUpperCase() === code)) {
      code = makeVoucherCode();
    }
    if (!/^[A-Z1-9]{6}$/.test(code)) {
      notify("Le code voucher doit contenir exactement 6 caracteres A-Z ou 1-9.");
      return;
    }
    if (vouchers.some((voucher) => voucher.code.toUpperCase() === code)) {
      notify(`Le voucher ${code} existe deja.`);
      return;
    }
    setVouchers((current) => [
      {
        id,
        code,
        batchId: "manual",
        pfsenseId: voucherForm.pfsenseId,
        duration: Number(voucherForm.duration),
        remaining: Number(voucherForm.duration),
        uploadKbps: Number(voucherForm.uploadKbps),
        downloadKbps: Number(voucherForm.downloadKbps),
        status: "active",
        uses: 0,
        createdAt: "2026-05-09",
        startsAt: "-",
        expiresAt: "-"
      },
      ...current
    ]);
    setVoucherQuery(code);
    setVoucherForm({ code: "", duration: 1440, uploadKbps: 0, downloadKbps: 0, pfsenseId: "all" });
    notify("Voucher créé et prêt pour radcheck/radreply.");
  }

  async function addBatch(event) {
    event.preventDefault();
    try {
      await callApi("/api/batches", {
        method: "POST",
        body: JSON.stringify(batchForm)
      });
      setBatchForm({ name: "", quantity: 50, duration: 1440, pfsenseId: "all" });
      notify("Lot cree et synchronise avec radcheck/radreply.");
      return;
    } catch (error) {
      if (error.status) {
        notify(error.message);
        return;
      }
      notify(`API indisponible, lot local: ${error.message}`);
    }
    const quantity = Math.max(1, Math.min(Number(batchForm.quantity), MAX_BATCH_QUANTITY));
    const batchId = `batch-${Date.now()}`;
    const batchName = (batchForm.name.trim() || `LOT_${batchForm.duration}MIN`).toUpperCase();
    if (batches.some((batch) => batch.name.toUpperCase() === batchName)) {
      notify(`Le lot ${batchName} existe deja.`);
      return;
    }
    const newBatch = {
      id: batchId,
      number: batchName.slice(0, 2).toUpperCase(),
      name: batchName,
      quantity,
      duration: Number(batchForm.duration),
      createdAt: "2026-05-09",
      pfsenseId: batchForm.pfsenseId,
      revoked: false
    };
    const previewCount = Math.min(quantity, 25);
    const generatedCodes = new Set(vouchers.map((voucher) => voucher.code.toUpperCase()));
    const generated = Array.from({ length: previewCount }, (_, index) => {
      let code = makeVoucherCode();
      while (generatedCodes.has(code)) {
        code = makeVoucherCode();
      }
      generatedCodes.add(code);
      return {
        id: `v-${Date.now()}-${index}`,
        code,
        batchId,
        pfsenseId: batchForm.pfsenseId,
        duration: Number(batchForm.duration),
        remaining: Number(batchForm.duration),
        uploadKbps: 0,
        downloadKbps: 0,
        status: "active",
        uses: 0,
        createdAt: "2026-05-09",
        startsAt: "-",
        expiresAt: "-"
      };
    });
    setBatches((current) => [newBatch, ...current]);
    setVouchers((current) => [...generated, ...current]);
    setBatchForm({ name: "", quantity: 50, duration: 1440, pfsenseId: "all" });
    notify(`${quantity} vouchers préparés, ${previewCount} affichés dans le prototype.`);
  }

  async function toggleVoucher(id) {
    try {
      await callApi("/api/vouchers", {
        method: "PATCH",
        body: JSON.stringify({ id })
      });
      notify("Voucher synchronise avec radcheck/radreply.");
      return;
    } catch (error) {
      notify(`API indisponible, bascule locale: ${error.message}`);
    }
    setVouchers((current) =>
      current.map((voucher) =>
        voucher.id === id ? { ...voucher, status: voucher.status === "revoked" ? "active" : "revoked" } : voucher
      )
    );
    notify("Statut voucher mis à jour.");
  }

  async function deleteBatch(id) {
    try {
      await callApi("/api/batches/delete", {
        method: "POST",
        body: JSON.stringify({ id })
      });
      notify("Lot supprime dans l'application et FreeRADIUS.");
      return;
    } catch (error) {
      notify(`API indisponible, suppression locale: ${error.message}`);
    }
    setBatches((current) => current.filter((batch) => batch.id !== id));
    setVouchers((current) => current.filter((voucher) => voucher.batchId !== id));
    notify("Lot supprimé avec ses vouchers.");
  }

  function disconnectSession(id) {
    setAccounting((current) =>
      current.map((item) => (item.id === id ? { ...item, status: "closed", endedAt: "maintenant" } : item))
    );
    notify("Déconnexion manuelle simulée via accounting.");
  }

  async function downloadCsv(path, fallbackName) {
    const response = await fetch(path);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Export CSV impossible." }));
      throw new Error(payload.error || "Export CSV impossible.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fallbackName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    try {
      await downloadCsv("/api/vouchers/export", "vouchers-freeradius.csv");
      notify("Export CSV complet généré depuis la base.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function exportBatchCsv(batchId) {
    const batch = batches.find((item) => item.id === batchId);
    const name = encodeURIComponent(batch?.name ?? `lot-${batchId}`);
    try {
      await downloadCsv(`/api/vouchers/export?batchId=${encodeURIComponent(batchId)}&name=${name}`, `${batch?.name ?? "lot-vouchers"}.csv`);
      notify(`Export complet du lot ${batch?.name ?? batchId} généré.`);
    } catch (error) {
      notify(error.message);
    }
  }

  return (
    <main className="shell">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <section className="workspace">
        <Topbar
          activePfSense={activePfSense}
          servers={pfSenseServers}
          selectedPfSense={selectedPfSense}
          setSelectedPfSense={setSelectedPfSense}
          notify={notify}
        />
        <div className="content">
          <div className="toast" role="status">
            <CheckCircle2 size={16} />
            {toast}
          </div>
          {activeView === "dashboard" && (
            <Dashboard
              pfSenseServers={pfSenseServers}
              nasServers={nasServers}
              batches={batches}
              vouchers={vouchers}
              accounting={accounting}
              selectedPfSense={selectedPfSense}
              activeConnections={activeConnections}
              activeVouchers={activeVouchers}
              revokedVouchers={revokedVouchers}
              onlineNas={onlineNas}
              totalConnections={totalConnections}
              avgPing={avgPing}
              voucherQuery={voucherQuery}
              setVoucherQuery={setVoucherQuery}
              testedVoucher={testedVoucher}
              filteredVouchers={filteredVouchers}
              toggleVoucher={toggleVoucher}
              deleteBatch={deleteBatch}
              exportCsv={exportCsv}
              exportBatchCsv={exportBatchCsv}
              setSelectedPfSense={setSelectedPfSense}
              togglePfSense={togglePfSense}
              deletePfSense={deletePfSense}
              notify={notify}
              setActiveView={setActiveView}
            />
          )}
          {activeView === "pfsense" && (
            <PfSenseView
              servers={pfSenseServers}
              accounting={accounting}
              form={pfSenseForm}
              setForm={setPfSenseForm}
              addPfSense={addPfSense}
              togglePfSense={togglePfSense}
              testPfSense={testPfSense}
              deletePfSense={deletePfSense}
            />
          )}
          {activeView === "nas" && <NasView nasServers={nasServers} servers={pfSenseServers} />}
          {activeView === "vouchers" && (
            <VoucherView
              servers={pfSenseServers}
              vouchers={vouchers}
              batches={batches}
              voucherForm={voucherForm}
              setVoucherForm={setVoucherForm}
              batchForm={batchForm}
              setBatchForm={setBatchForm}
              addVoucher={addVoucher}
              addBatch={addBatch}
              toggleVoucher={toggleVoucher}
              deleteBatch={deleteBatch}
              exportCsv={exportCsv}
              exportBatchCsv={exportBatchCsv}
            />
          )}
          {activeView === "connections" && (
            <ConnectionsView accounting={accounting} servers={pfSenseServers} selectedPfSense={selectedPfSense} disconnectSession={disconnectSession} />
          )}
          {activeView === "reports" && <ReportsView totalConnections={totalConnections} activeVouchers={activeVouchers} avgPing={avgPing} />}
          {activeView === "api" && <ApiView />}
          {activeView === "settings" && <SettingsView />}
        </div>
      </section>
    </main>
  );
}

function Sidebar({ activeView, setActiveView }) {
  const entries = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["pfsense", Radio, "Serveurs pfSense"],
    ["nas", Server, "NAS (RADIUS Clients)"],
    ["vouchers", KeyRound, "Vouchers"],
    ["connections", Wifi, "Connexions / Logs"],
    ["reports", BarChart3, "Rapports"],
    ["api", Network, "API & Intégration"],
    ["settings", Settings, "Paramètres"]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="shield">
          <Shield size={34} />
        </div>
        <div>
          <strong>VoucherRADIUS</strong>
          <span>FreeRADIUS • pfSense</span>
        </div>
      </div>
      <div className="admin">
        <div className="avatar">AD</div>
        <div>
          <strong>admin</strong>
          <span><i /> Administrateur</span>
        </div>
      </div>
      <nav className="nav">
        {entries.map(([key, Icon, label]) => (
          <button key={key} className={activeView === key ? "navItem active" : "navItem"} onClick={() => setActiveView(key)}>
            <Icon size={18} />
            <span>{label}</span>
            {key === "vouchers" && <ChevronDown size={16} className="navChevron" />}
          </button>
        ))}
      </nav>
      <button className="logout">
        <LogOut size={18} />
        Déconnexion
      </button>
      <small>VoucherRADIUS v1.0.0<br />© 2026</small>
    </aside>
  );
}

function Topbar({ activePfSense, servers, selectedPfSense, setSelectedPfSense, notify }) {
  return (
    <header className="topbar">
      <div className="titleRow">
        <button className="iconButton" aria-label="Menu"><Menu size={22} /></button>
        <div>
          <h1>Dashboard</h1>
          <p>Vue d'ensemble du système</p>
        </div>
      </div>
      <div className="topActions">
        <label className="selectLabel">
          Serveur pfSense actif
          <select value={selectedPfSense} onChange={(event) => setSelectedPfSense(event.target.value)}>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name} ({server.ip})</option>
            ))}
          </select>
        </label>
        <button className="iconButton" aria-label="Thème"><Gauge size={20} /></button>
        <button className="primaryButton" onClick={() => notify(`${activePfSense.name} synchronisé avec FreeRADIUS`)}>
          <RefreshCw size={16} />
          Actualiser
        </button>
        <div className="userPill">admin <ChevronDown size={14} /></div>
      </div>
    </header>
  );
}

function Dashboard(props) {
  const {
    pfSenseServers,
    nasServers,
    batches,
    vouchers,
    accounting,
    activeConnections,
    activeVouchers,
    revokedVouchers,
    onlineNas,
    totalConnections,
    avgPing,
    voucherQuery,
    setVoucherQuery,
    testedVoucher,
    filteredVouchers,
    toggleVoucher,
    deleteBatch,
    exportCsv,
    exportBatchCsv,
    setSelectedPfSense,
    togglePfSense,
    deletePfSense,
    notify,
    setActiveView
  } = props;

  const activeServers = pfSenseServers.filter((server) => server.status === "active").length;

  function openServerConnections(server) {
    setSelectedPfSense(server.id);
    setActiveView("connections");
    notify(`Connexions de ${server.name} ouvertes.`);
  }

  function editServer(server) {
    setSelectedPfSense(server.id);
    setActiveView("pfsense");
    notify(`Edition de ${server.name}: utilise la vue Serveurs pfSense.`);
  }

  function removeServer(server) {
    setSelectedPfSense(server.id);
    deletePfSense(server.id);
  }

  function openBatch(batch) {
    setVoucherQuery("");
    setActiveView("vouchers");
    notify(`Lot ${batch.name} ouvert dans la gestion des vouchers.`);
  }

  return (
    <>
      <section className="statsGrid">
        <StatCard color="blue" icon={Server} label="SERVEURS PFSENSE" value={pfSenseServers.length} detail={`Actifs: ${activeServers}`} />
        <StatCard color="green" icon={Network} label="NAS CONNECTÉS" value={nasServers.length} detail={`En ligne: ${onlineNas}`} />
        <StatCard color="purple" icon={Users} label="CONNEXIONS ACTIVES" value={activeConnections} detail="Total sessions en cours" />
        <StatCard color="orange" icon={KeyRound} label="VOUCHERS ACTIFS" value={activeVouchers} detail="Non expirés" />
        <StatCard color="red" icon={CircleSlash} label="VOUCHERS RÉVOQUÉS" value={revokedVouchers} detail="Total révoqués" />
      </section>

      <section className="dashboardGrid">
        <Panel title="LISTE DES SERVEURS PFSENSE" tone="blue" action={<button className="primaryButton" onClick={() => setActiveView("pfsense")}><Plus size={16} />Ajouter</button>}>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>État</th>
                  <th>Ping</th>
                  <th>Connexions</th>
                  <th>Secret partagé</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pfSenseServers.map((server) => (
                  <tr key={server.id}>
                    <td><StatusDot active={server.status === "active"} /> <strong>{server.name}</strong></td>
                    <td><Badge tone={server.status === "active" ? "blue" : "muted"}>{server.status === "active" ? "Actif" : "Inactif"}</Badge></td>
                    <td>{server.ping ? `${server.ping} ms` : "N/A"}</td>
                    <td>{moneyFormatter.format(server.connections)}</td>
                    <td>{maskSecret(server.radiusSecret)}</td>
                    <td className="rowActions">
                      <button className="iconOnly" title="Voir les connexions" aria-label={`Voir les connexions de ${server.name}`} onClick={() => openServerConnections(server)}>
                        <Eye size={16} />
                      </button>
                      <button className="iconOnly" title="Modifier" aria-label={`Modifier ${server.name}`} onClick={() => editServer(server)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="iconOnly danger" title="Supprimer completement" aria-label={`Supprimer completement ${server.name}`} onClick={() => removeServer(server)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panelFoot">Total connexions (tous serveurs): <strong>{moneyFormatter.format(totalConnections)}</strong> • Ping moyen: <strong>{avgPing} ms</strong></p>
        </Panel>

        <Panel title="TESTER UN VOUCHER" tone="green">
          <div className="voucherTester">
            <label>
              Entrer le code voucher
              <input value={voucherQuery} onChange={(event) => setVoucherQuery(event.target.value)} placeholder="Ex: A1B2-C3D4-E5F6" />
            </label>
            <div className="buttonRow">
              <button className="successButton"><Search size={16} />Tester</button>
              <button className="ghostButton" onClick={() => testedVoucher && toggleVoucher(testedVoucher.id)}><LockKeyhole size={16} />Révoquer</button>
              <button className="ghostButton right">Informations du voucher</button>
            </div>
            <div className={testedVoucher && testedVoucher.status === "active" ? "voucherResult valid" : "voucherResult invalid"}>
              {testedVoucher && testedVoucher.status === "active" ? (
                <>
                  <h3><CheckCircle2 size={18} /> VOUCHER VALIDE</h3>
                  <div className="detailsGrid">
                    <span>Utilisateur : <strong>{testedVoucher.code}</strong></span>
                    <span>Créé le : <strong>{testedVoucher.createdAt}</strong></span>
                    <span>Temps restant : <strong>{minutesLabel(testedVoucher.remaining)}</strong></span>
                    <span>Expire le : <strong>{testedVoucher.expiresAt}</strong></span>
                    <span>Débit autorisé : <strong>{bandwidthLabel(testedVoucher.downloadKbps)}</strong></span>
                    <span>Serveur : <strong>{pfSenseServers.find((server) => server.id === testedVoucher.pfsenseId)?.name ?? "Tous"}</strong></span>
                  </div>
                </>
              ) : (
                <h3><CircleSlash size={18} /> VOUCHER INVALIDE OU RÉVOQUÉ</h3>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="CATALOGUE DES LOTS DE VOUCHERS"
          tone="blue"
          action={<div className="buttonRow compact"><button className="softButton" onClick={() => setActiveView("vouchers")}><Plus size={15} />Nouveau lot</button><button className="ghostButton" onClick={exportCsv}><Download size={15} />Exporter</button><button className="ghostButton" onClick={() => window.print()}><Printer size={15} />Imprimer</button></div>}
        >
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Nom du lot</th>
                  <th>Nombre</th>
                  <th>Durée (min)</th>
                  <th>Date création</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.number}</td>
                    <td><strong>{batch.name}</strong></td>
                    <td>{moneyFormatter.format(batch.quantity)}</td>
                    <td>{moneyFormatter.format(batch.duration)}</td>
                    <td>{batch.createdAt}</td>
                    <td className="rowActions">
                      <button className="iconOnly" title="Voir le lot" aria-label={`Voir le lot ${batch.name}`} onClick={() => openBatch(batch)}>
                        <Eye size={16} />
                      </button>
                      <button className="iconOnly" title="Exporter le lot" aria-label={`Exporter le lot ${batch.name}`} onClick={() => exportBatchCsv(batch.id)}>
                        <FileDown size={16} />
                      </button>
                      <button className="iconOnly danger" title="Supprimer le lot" aria-label={`Supprimer le lot ${batch.name}`} onClick={() => deleteBatch(batch.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panelFoot">Total lots: <strong>{batches.length}</strong> • Total vouchers: <strong>{moneyFormatter.format(batches.reduce((total, batch) => total + batch.quantity, 0))}</strong></p>
        </Panel>

        <Panel title="VOUCHERS ACTIFS" tone="green" action={<button className="ghostButton" onClick={() => setActiveView("vouchers")}>Voir tout</button>}>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Durée</th>
                  <th>Temps restant</th>
                  <th>Débit</th>
                  <th>Début</th>
                  <th>Expire le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.filter((voucher) => voucher.status === "active").slice(0, 6).map((voucher) => (
                  <tr key={voucher.id}>
                    <td>{voucher.code}</td>
                    <td>{voucher.duration}</td>
                    <td>{minutesLabel(voucher.remaining)}</td>
                    <td>{bandwidthLabel(voucher.downloadKbps)}</td>
                    <td>{voucher.startsAt}</td>
                    <td>{voucher.expiresAt}</td>
                    <td><button className="iconOnly danger" onClick={() => toggleVoucher(voucher.id)} aria-label="Révoquer"><CircleSlash size={17} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panelFoot">Total actifs: <strong>{activeVouchers}</strong></p>
        </Panel>
      </section>

      <section className="bottomGrid">
        <InfoBlock title="INTÉGRATION & API" icon={BookOpen}>
          <p>API REST prête pour intégration avec pfSense / FreeRADIUS SQL.</p>
          <div className="buttonRow"><button className="primaryButton">Voir la documentation API</button><button className="softButton"><KeyRound size={15} />Clé API</button></div>
        </InfoBlock>
        <InfoBlock title="STATUT DU SERVICE" icon={Activity}>
          <div className="badgeRow"><Badge tone="green">RADIUS : Actif</Badge><Badge tone="green">Base de données : OK</Badge><Badge tone="green">API : Actif</Badge></div>
          <p>Dernière vérification : 2026-05-09 00:14:30</p>
        </InfoBlock>
        <InfoBlock title="INFORMATIONS SYSTÈME" icon={Database}>
          <p>Version : 1.0.0</p>
          <p>Uptime : 2 jours, 4 heures</p>
          <p>Environnement : Production</p>
        </InfoBlock>
        <InfoBlock title="RACCOURCIS" icon={Plus}>
          <div className="quickLinks"><button onClick={() => setActiveView("vouchers")}>Nouveau lot</button><button onClick={() => setActiveView("nas")}>Lister NAS</button><button onClick={() => setActiveView("connections")}>Voir connexions</button></div>
        </InfoBlock>
      </section>
    </>
  );
}

function StatCard({ color, icon: Icon, label, value, detail }) {
  return (
    <article className="statCard">
      <div className={`statIcon ${color}`}><Icon size={30} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail} <i /></p>
      </div>
    </article>
  );
}

function Panel({ title, tone, action, children }) {
  return (
    <section className={`panel ${tone}`}>
      <div className="panelHead">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoBlock({ title, icon: Icon, children }) {
  return (
    <section className="infoBlock">
      <h3><Icon size={17} />{title}</h3>
      {children}
    </section>
  );
}

function Badge({ tone = "muted", children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function StatusDot({ active }) {
  return <span className={active ? "statusDot active" : "statusDot"} />;
}

function PfSenseView({ servers, accounting, form, setForm, addPfSense, togglePfSense, testPfSense, deletePfSense }) {
  return (
    <section className="splitView">
      <Panel title="GESTION DES SERVEURS PFSENSE" tone="blue">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>IP</th>
                <th>Secret</th>
                <th>Ping</th>
                <th>Connexions</th>
                <th>Dernier signal</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.id}>
                  <td><StatusDot active={server.status === "active"} /> <strong>{server.name}</strong></td>
                  <td>{server.ip}</td>
                  <td>{maskSecret(server.radiusSecret)}</td>
                  <td>{server.ping ? `${server.ping} ms` : "N/A"}</td>
                  <td>{server.connections}</td>
                  <td>{server.lastSeen}</td>
                  <td className="rowActions">
                    <button className="iconOnly" onClick={() => testPfSense(server.id)} aria-label="Tester"><RefreshCw size={16} /></button>
                    <button className="iconOnly" onClick={() => togglePfSense(server.id)} aria-label="Activer désactiver" title="Activer ou désactiver"><Activity size={16} /></button>
                    <button className="iconOnly" onClick={() => setForm({ name: server.name, ip: server.ip, radiusSecret: server.radiusSecret })} aria-label={`Modifier ${server.name}`} title="Préremplir le formulaire">
                      <Edit3 size={16} />
                    </button>
                    <button className="iconOnly danger" onClick={() => deletePfSense(server.id)} aria-label={`Supprimer ${server.name}`} title="Supprimer completement">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="AJOUTER UN SERVEUR PFSENSE" tone="green">
        <form className="formGrid" onSubmit={addPfSense}>
          <label>Nom<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="PFSENSE 4" /></label>
          <label>Adresse IP publique<input value={form.ip} onChange={(event) => setForm({ ...form, ip: event.target.value })} placeholder="102.209.222.198" /></label>
          <label>Secret RADIUS<input value={form.radiusSecret} onChange={(event) => setForm({ ...form, radiusSecret: event.target.value })} placeholder="secret partagé" /></label>
          <button className="primaryButton"><Plus size={16} />Ajouter le serveur</button>
        </form>
      </Panel>
      <Panel title="CONNEXIONS PAR PFSENSE" tone="green">
        <div className="serverBars">
          {servers.map((server) => (
            <div key={server.id}>
              <span>{server.name}</span>
              <div><i style={{ width: `${Math.min(100, server.connections / 10)}%` }} /></div>
              <strong>{accounting.filter((item) => item.pfsenseId === server.id && item.status === "online").length} actifs</strong>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function NasView({ nasServers, servers }) {
  return (
    <Panel title="NAS / RADIUS CLIENTS" tone="blue">
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Shortname</th>
              <th>IP</th>
              <th>pfSense</th>
              <th>Secret</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {nasServers.map((nas) => (
              <tr key={nas.id}>
                <td><strong>{nas.name}</strong></td>
                <td>{nas.shortname}</td>
                <td>{nas.ip}</td>
                <td>{servers.find((server) => server.id === nas.pfsenseId)?.name}</td>
                <td>{maskSecret(nas.secret)}</td>
                <td><Badge tone={nas.status === "online" ? "green" : "red"}>{nas.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function VoucherView({ servers, vouchers, batches, voucherForm, setVoucherForm, batchForm, setBatchForm, addVoucher, addBatch, toggleVoucher, deleteBatch, exportCsv, exportBatchCsv }) {
  return (
    <section className="splitView">
      <Panel title="CRÉER UN VOUCHER" tone="green">
        <form className="formGrid" onSubmit={addVoucher}>
          <label>Code<input value={voucherForm.code} onChange={(event) => setVoucherForm({ ...voucherForm, code: event.target.value })} placeholder="Auto: AGE8S9" /></label>
          <label>Durée (min)<input type="number" value={voucherForm.duration} onChange={(event) => setVoucherForm({ ...voucherForm, duration: event.target.value })} /></label>
          <label>Download kbit/s<input type="number" min="0" value={voucherForm.downloadKbps} onChange={(event) => setVoucherForm({ ...voucherForm, downloadKbps: event.target.value })} /></label>
          <label>Upload kbit/s<input type="number" min="0" value={voucherForm.uploadKbps} onChange={(event) => setVoucherForm({ ...voucherForm, uploadKbps: event.target.value })} /></label>
          <label>pfSense autorisé<select value={voucherForm.pfsenseId} onChange={(event) => setVoucherForm({ ...voucherForm, pfsenseId: event.target.value })}><option value="all">Tous</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></label>
          <button className="successButton"><Plus size={16} />Créer</button>
        </form>
      </Panel>
      <Panel title="CRÉER UN LOT DE VOUCHERS" tone="blue">
        <form className="formGrid" onSubmit={addBatch}>
          <label>Nom du lot<input value={batchForm.name} onChange={(event) => setBatchForm({ ...batchForm, name: event.target.value })} placeholder="LOT_1440MIN" /></label>
          <label>Nombre<input type="number" min="1" max={MAX_BATCH_QUANTITY} value={batchForm.quantity} onChange={(event) => setBatchForm({ ...batchForm, quantity: event.target.value })} /></label>
          <label>Durée (min)<input type="number" value={batchForm.duration} onChange={(event) => setBatchForm({ ...batchForm, duration: event.target.value })} /></label>
          <label>pfSense<select value={batchForm.pfsenseId} onChange={(event) => setBatchForm({ ...batchForm, pfsenseId: event.target.value })}><option value="all">Tous</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></label>
          <button className="primaryButton"><UploadCloud size={16} />Générer le lot</button>
        </form>
      </Panel>
      <Panel title="CATALOGUE ET EXPORT" tone="blue" action={<div className="buttonRow compact"><button className="ghostButton" onClick={exportCsv}><Download size={15} />CSV</button><button className="ghostButton" onClick={() => window.print()}><Printer size={15} />PDF</button></div>}>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Lot</th><th>Nombre</th><th>Durée</th><th>pfSense</th><th>Actions</th></tr></thead>
            <tbody>{batches.map((batch) => <tr key={batch.id}><td><strong>{batch.name}</strong></td><td>{batch.quantity}</td><td>{batch.duration}</td><td>{servers.find((server) => server.id === batch.pfsenseId)?.name ?? "Tous"}</td><td className="rowActions"><button className="iconOnly" title="Exporter le lot" aria-label={`Exporter le lot ${batch.name}`} onClick={() => exportBatchCsv(batch.id)}><FileDown size={16} /></button><button className="iconOnly danger" title="Supprimer le lot" aria-label={`Supprimer le lot ${batch.name}`} onClick={() => deleteBatch(batch.id)}><Trash2 size={16} /></button></td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="RECHERCHER / RÉVOQUER / RESTAURER" tone="green">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Code</th><th>Durée</th><th>Restant</th><th>Statut</th><th>pfSense</th><th>Actions</th></tr></thead>
            <tbody>{vouchers.slice(0, 12).map((voucher) => <tr key={voucher.id}><td><strong>{voucher.code}</strong></td><td>{voucher.duration}</td><td>{voucher.remaining}</td><td><Badge tone={voucher.status === "active" ? "green" : "red"}>{voucher.status}</Badge></td><td>{servers.find((server) => server.id === voucher.pfsenseId)?.name ?? "Tous"}</td><td><button className={voucher.status === "active" ? "ghostButton dangerText" : "successButton"} onClick={() => toggleVoucher(voucher.id)}>{voucher.status === "active" ? "Révoquer" : "Restaurer"}</button></td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

function ConnectionsView({ accounting, servers, selectedPfSense, disconnectSession }) {
  const selectedServer = servers.find((server) => server.id === selectedPfSense);
  const visibleAccounting = selectedServer
    ? accounting.filter((item) => item.pfsenseId === selectedPfSense)
    : accounting;

  return (
    <Panel title={`ACCOUNTING / CONNEXIONS${selectedServer ? ` - ${selectedServer.name}` : ""}`} tone="green">
      <div className="tableWrap">
        <table>
          <thead><tr><th>Voucher</th><th>NAS</th><th>pfSense</th><th>IP client</th><th>MAC</th><th>Début</th><th>Fin</th><th>Durée utilisée</th><th>Actions</th></tr></thead>
          <tbody>{visibleAccounting.map((item) => <tr key={item.id}><td><strong>{item.user}</strong></td><td>{item.nas}</td><td>{servers.find((server) => server.id === item.pfsenseId)?.name}</td><td>{item.clientIp}</td><td>{item.mac}</td><td>{item.startedAt}</td><td>{item.endedAt ?? "en ligne"}</td><td>{item.used}</td><td>{item.status === "online" ? <button className="ghostButton dangerText" onClick={() => disconnectSession(item.id)}>Déconnecter</button> : <Badge>fermée</Badge>}</td></tr>)}</tbody>
        </table>
      </div>
      {visibleAccounting.length === 0 && <p className="panelFoot">Aucune connexion pour ce serveur.</p>}
    </Panel>
  );
}

function ReportsView({ totalConnections, activeVouchers, avgPing }) {
  return (
    <section className="reports">
      <StatCard color="blue" icon={Activity} label="CONNEXIONS TOTALES" value={moneyFormatter.format(totalConnections)} detail="Cumul multi pfSense" />
      <StatCard color="orange" icon={KeyRound} label="VOUCHERS DISPONIBLES" value={activeVouchers} detail="Prêts à authentifier" />
      <StatCard color="green" icon={Clock} label="PING MOYEN" value={`${avgPing} ms`} detail="Serveurs actifs" />
    </section>
  );
}

function ApiView() {
  return (
    <section className="apiDocs">
      <Panel title="ARCHITECTURE RECOMMANDÉE" tone="blue">
        <pre>{`pfSense 1  ─┐
pfSense 2  ─┼──> FreeRADIUS + PostgreSQL/MySQL ───> VoucherRADIUS Web
pfSense 3  ─┘`}</pre>
      </Panel>
      <Panel title="ENDPOINTS À BRANCHER" tone="green">
        <div className="endpointList">
          <span>GET /api/dashboard</span>
          <span>POST /api/pfsense/test</span>
          <span>POST /api/vouchers</span>
          <span>POST /api/voucher-batches</span>
          <span>PATCH /api/vouchers/:id/revoke</span>
          <span>GET /api/accounting/live</span>
        </div>
      </Panel>
    </section>
  );
}

function SettingsView() {
  return (
    <Panel title="PARAMÈTRES DE SÉCURITÉ" tone="blue">
      <div className="settingsGrid">
        <label><input type="checkbox" defaultChecked /> Login administrateur obligatoire</label>
        <label><input type="checkbox" defaultChecked /> Journalisation admin_logs</label>
        <label><input type="checkbox" defaultChecked /> HTTPS via Nginx / Let's Encrypt</label>
        <label><input type="checkbox" /> Déconnexion CoA si supportée par le NAS</label>
      </div>
    </Panel>
  );
}

