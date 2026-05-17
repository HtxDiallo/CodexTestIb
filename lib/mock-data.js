export const initialPfSenseServers = [
  {
    id: "pfs-1",
    name: "PFSENSE 1",
    ip: "10.0.0.1",
    radiusSecret: "north-300",
    status: "active",
    ping: 106,
    connections: 200,
    nasCount: 2,
    lastSeen: "2026-05-09 00:11:24"
  },
  {
    id: "pfs-2",
    name: "PFSENSE 2",
    ip: "10.0.0.2",
    radiusSecret: "branch-100",
    status: "active",
    ping: null,
    connections: 300,
    nasCount: 1,
    lastSeen: "2026-05-09 00:08:02"
  },
  {
    id: "pfs-3",
    name: "PFSENSE 3",
    ip: "10.0.0.3",
    radiusSecret: "campus-000",
    status: "active",
    ping: 89,
    connections: 1000,
    nasCount: 1,
    lastSeen: "2026-05-09 00:12:10"
  }
];

export const initialNasServers = [
  { id: "nas-1", name: "NAS-PFSENSE-1A", shortname: "pfs1-main", ip: "10.0.0.1", type: "other", pfsenseId: "pfs-1", secret: "radius-300", status: "online" },
  { id: "nas-2", name: "NAS-PFSENSE-1B", shortname: "pfs1-backup", ip: "10.0.0.11", type: "other", pfsenseId: "pfs-1", secret: "radius-301", status: "online" },
  { id: "nas-3", name: "NAS-PFSENSE-2", shortname: "pfs2-main", ip: "10.0.0.2", type: "other", pfsenseId: "pfs-2", secret: "radius-100", status: "offline" },
  { id: "nas-4", name: "NAS-PFSENSE-3", shortname: "pfs3-main", ip: "10.0.0.3", type: "other", pfsenseId: "pfs-3", secret: "radius-000", status: "online" }
];

export const initialVoucherBatches = [
  { id: "batch-a1", number: "A1", name: "LOT_1440MIN", quantity: 200, duration: 1440, createdAt: "2026-05-09", pfsenseId: "all", revoked: false },
  { id: "batch-b4", number: "B4", name: "LOT_1000MIN", quantity: 1000, duration: 1000, createdAt: "2026-05-09", pfsenseId: "pfs-1", revoked: false },
  { id: "batch-c7", number: "C7", name: "LOT_500MIN", quantity: 500, duration: 500, createdAt: "2026-05-09", pfsenseId: "pfs-2", revoked: false },
  { id: "batch-d9", number: "D9", name: "LOT_2000MIN", quantity: 300, duration: 2000, createdAt: "2026-05-09", pfsenseId: "pfs-3", revoked: false }
];

export const initialVouchers = [
  {
    id: "v-1",
    code: "A1B2-C3D4-E5F6",
    batchId: "batch-a1",
    pfsenseId: "pfs-1",
    duration: 1440,
    remaining: 840,
    uploadKbps: 1000,
    downloadKbps: 1000,
    status: "active",
    uses: 1,
    createdAt: "2026-05-09",
    startsAt: "2026-05-09 09:10",
    expiresAt: "2026-05-10 14:30"
  },
  {
    id: "v-2",
    code: "A22",
    batchId: "batch-a1",
    pfsenseId: "pfs-1",
    duration: 4320,
    remaining: 320,
    uploadKbps: 500,
    downloadKbps: 500,
    status: "active",
    uses: 1,
    createdAt: "2026-05-09",
    startsAt: "2026-05-09 09:10",
    expiresAt: "2026-05-10 14:30"
  },
  {
    id: "v-3",
    code: "B57",
    batchId: "batch-b4",
    pfsenseId: "pfs-1",
    duration: 10080,
    remaining: 180,
    uploadKbps: 300,
    downloadKbps: 300,
    status: "active",
    uses: 2,
    createdAt: "2026-05-09",
    startsAt: "2026-05-09 10:22",
    expiresAt: "2026-05-10 18:22"
  },
  {
    id: "v-4",
    code: "Z10",
    batchId: "batch-c7",
    pfsenseId: "pfs-2",
    duration: 4320,
    remaining: 840,
    uploadKbps: 1000,
    downloadKbps: 1000,
    status: "active",
    uses: 0,
    createdAt: "2026-05-09",
    startsAt: "2026-05-09 08:45",
    expiresAt: "2026-05-10 22:45"
  },
  {
    id: "v-5",
    code: "C11",
    batchId: "batch-a1",
    pfsenseId: "pfs-1",
    duration: 1440,
    remaining: 30,
    uploadKbps: 500,
    downloadKbps: 500,
    status: "active",
    uses: 3,
    createdAt: "2026-05-09",
    startsAt: "2026-05-09 13:55",
    expiresAt: "2026-05-09 13:55"
  },
  {
    id: "v-6",
    code: "R99-VOID",
    batchId: "batch-d9",
    pfsenseId: "pfs-3",
    duration: 2000,
    remaining: 0,
    uploadKbps: 300,
    downloadKbps: 300,
    status: "revoked",
    uses: 1,
    createdAt: "2026-05-09",
    startsAt: "2026-05-09 12:20",
    expiresAt: "2026-05-09 20:20"
  }
];

export const initialAccounting = [
  { id: "acct-1", user: "A22", pfsenseId: "pfs-1", nas: "NAS-PFSENSE-1A", clientIp: "192.168.10.41", mac: "AA:01:44:2C:90:10", startedAt: "2026-05-09 09:10", endedAt: null, used: "5h 20m", status: "online" },
  { id: "acct-2", user: "B57", pfsenseId: "pfs-1", nas: "NAS-PFSENSE-1A", clientIp: "192.168.10.87", mac: "AA:01:44:2C:90:21", startedAt: "2026-05-09 10:22", endedAt: null, used: "3h 00m", status: "online" },
  { id: "acct-3", user: "Z10", pfsenseId: "pfs-2", nas: "NAS-PFSENSE-2", clientIp: "192.168.20.11", mac: "BC:42:19:12:7F:01", startedAt: "2026-05-09 08:45", endedAt: null, used: "14h 00m", status: "online" },
  { id: "acct-4", user: "C11", pfsenseId: "pfs-1", nas: "NAS-PFSENSE-1B", clientIp: "192.168.10.64", mac: "AA:01:44:2C:90:33", startedAt: "2026-05-09 13:55", endedAt: "2026-05-09 14:25", used: "30m", status: "closed" },
  { id: "acct-5", user: "D33", pfsenseId: "pfs-3", nas: "NAS-PFSENSE-3", clientIp: "192.168.30.12", mac: "DC:98:22:41:66:AC", startedAt: "2026-05-09 12:20", endedAt: null, used: "8h 15m", status: "online" }
];

export const initialMacDevices = [];
