import { randomInt } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query, transaction } from "@/lib/db";

const execFileAsync = promisify(execFile);

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

const VOUCHER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
const VOUCHER_CODE_PATTERN = /^[A-Z1-9]{6}$/;
const MAX_BATCH_QUANTITY = 30000;

function randomCode() {
  return Array.from({ length: 6 }, () => VOUCHER_ALPHABET[randomInt(VOUCHER_ALPHABET.length)]).join("");
}

async function uniqueVoucherCode(connection, reservedCodes = new Set()) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomCode();
    if (reservedCodes.has(code)) continue;
    const [rows] = await connection.execute("SELECT id FROM vouchers WHERE code = :code LIMIT 1", { code });
    if (rows.length === 0) {
      reservedCodes.add(code);
      return code;
    }
  }
  throw new Error("Impossible de generer un code voucher unique");
}

function buildPlaceholders(rows, columns, prefix) {
  const params = {};
  const values = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column) => {
      const key = `${prefix}_${rowIndex}_${column}`;
      params[key] = row[column];
      return `:${key}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  return { params, sql: values.join(", ") };
}

function chunkRows(rows, size = 1000) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function findExistingVoucherCodes(connection, codes) {
  const existingCodes = new Set();
  for (const chunk of chunkRows(codes)) {
    const params = Object.fromEntries(chunk.map((code, index) => [`code${index}`, code]));
    const placeholders = chunk.map((_, index) => `:code${index}`).join(", ");
    const [rows] = await connection.execute(`SELECT code FROM vouchers WHERE code IN (${placeholders})`, params);
    rows.forEach((row) => existingCodes.add(row.code));
  }
  return existingCodes;
}

async function generateUniqueVoucherCodes(connection, quantity) {
  const codes = new Set();
  while (codes.size < quantity) {
    codes.add(randomCode());
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existingCodes = await findExistingVoucherCodes(connection, [...codes]);
    if (existingCodes.size === 0) return [...codes];
    existingCodes.forEach((code) => codes.delete(code));
    while (codes.size < quantity) {
      codes.add(randomCode());
    }
  }

  throw new Error("Impossible de generer un lot de codes vouchers uniques");
}

async function insertVoucherBatchRows(connection, batchId, codes, durationMinutes, nasId) {
  for (const chunk of chunkRows(codes)) {
    const voucherRows = chunk.map((code) => ({
      batchId,
      code,
      duration: durationMinutes,
      upload: 0,
      download: 0,
      nasId,
      status: "active"
    }));
    const vouchers = buildPlaceholders(voucherRows, ["batchId", "code", "duration", "upload", "download", "nasId", "status"], "voucher");
    await connection.execute(
      `INSERT INTO vouchers (batch_id, code, duration_minutes, upload_kbps, download_kbps, nas_id, status)
       VALUES ${vouchers.sql}`,
      vouchers.params
    );

    const radcheckRows = chunk.map((code) => ({
      code,
      attribute: "Cleartext-Password",
      op: ":=",
      value: code
    }));
    const radcheck = buildPlaceholders(radcheckRows, ["code", "attribute", "op", "value"], "radcheck");
    await connection.execute(
      `INSERT INTO radcheck (username, attribute, op, value)
       VALUES ${radcheck.sql}`,
      radcheck.params
    );

    const radreplyRows = chunk.map((code) => ({
      code,
      attribute: "Session-Timeout",
      op: ":=",
      value: String(Number(durationMinutes) * 60)
    }));
    const radreply = buildPlaceholders(radreplyRows, ["code", "attribute", "op", "value"], "radreply");
    await connection.execute(
      `INSERT INTO radreply (username, attribute, op, value)
       VALUES ${radreply.sql}`,
      radreply.params
    );
  }
}

async function deleteRadiusRowsForCodes(connection, codes) {
  for (const chunk of chunkRows(codes)) {
    const params = Object.fromEntries(chunk.map((code, index) => [`code${index}`, code]));
    const placeholders = chunk.map((_, index) => `:code${index}`).join(", ");
    await connection.execute(`DELETE FROM radcheck WHERE username IN (${placeholders})`, params);
    await connection.execute(`DELETE FROM radreply WHERE username IN (${placeholders})`, params);
  }
}

function mapNas(row) {
  return {
    id: String(row.id),
    name: row.description || row.shortname || row.nasname,
    ip: row.nasname,
    publicIp: row.nasname,
    radiusSecret: row.secret || "",
    status: row.server === "disabled" ? "inactive" : "active",
    ping: null,
    connections: Number(row.connections || 0),
    nasCount: 1,
    lastSeen: row.last_seen_at || "-"
  };
}

function mapNasClient(row) {
  return {
    id: String(row.id),
    name: row.description || row.shortname || row.nasname,
    shortname: row.shortname,
    ip: row.nasname,
    type: row.type,
    pfsenseId: String(row.id),
    secret: row.secret || "",
    status: row.server === "disabled" ? "offline" : "online"
  };
}

function mapVoucher(row) {
  return {
    id: String(row.id),
    code: row.code,
    batchId: row.batch_id ? String(row.batch_id) : "manual",
    pfsenseId: row.nas_id ? String(row.nas_id) : "all",
    duration: Number(row.duration_minutes || 0),
    remaining: Number(row.duration_minutes || 0),
    uploadKbps: Number(row.upload_kbps || 0),
    downloadKbps: Number(row.download_kbps || 0),
    status: row.status,
    uses: Number(row.uses_count || 0),
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : nowDate(),
    startsAt: "-",
    expiresAt: row.expires_at ? String(row.expires_at).replace("T", " ").slice(0, 16) : "-"
  };
}

function mapBatch(row) {
  return {
    id: String(row.id),
    number: String(row.id),
    name: row.name,
    quantity: Number(row.quantity || 0),
    duration: Number(row.duration_minutes || 0),
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : nowDate(),
    pfsenseId: row.nas_id ? String(row.nas_id) : "all",
    revoked: Boolean(row.is_revoked)
  };
}

function mapAccounting(row) {
  return {
    id: String(row.radacctid),
    user: row.username,
    pfsenseId: row.nas_id ? String(row.nas_id) : "all",
    nas: row.nasipaddress || row.nasidentifier || "-",
    clientIp: row.framedipaddress || "-",
    mac: row.callingstationid || "-",
    startedAt: row.acctstarttime ? String(row.acctstarttime).replace("T", " ").slice(0, 16) : "-",
    endedAt: row.acctstoptime ? String(row.acctstoptime).replace("T", " ").slice(0, 16) : null,
    used: row.acctsessiontime ? `${Math.floor(Number(row.acctsessiontime) / 60)} min` : "-",
    status: row.acctstoptime ? "closed" : "online"
  };
}

export async function getSnapshot() {
  const nasRows = await query(`
    SELECT n.*,
      (SELECT COUNT(*) FROM radacct ra WHERE ra.nasipaddress = n.nasname AND ra.acctstoptime IS NULL) AS connections,
      (SELECT MAX(ra.acctstarttime) FROM radacct ra WHERE ra.nasipaddress = n.nasname) AS last_seen_at
    FROM nas n
    ORDER BY n.id ASC
  `);
  const voucherRows = await query("SELECT * FROM vouchers ORDER BY id DESC LIMIT 500");
  const batchRows = await query("SELECT * FROM voucher_batches ORDER BY id DESC LIMIT 200");
  const acctRows = await query(`
    SELECT ra.*,
      (SELECT n.id FROM nas n WHERE n.nasname = ra.nasipaddress LIMIT 1) AS nas_id
    FROM radacct ra
    ORDER BY ra.radacctid DESC
    LIMIT 200
  `);

  return {
    pfSenseServers: nasRows.map(mapNas),
    nasServers: nasRows.map(mapNasClient),
    vouchers: voucherRows.map(mapVoucher),
    batches: batchRows.map(mapBatch),
    accounting: acctRows.map(mapAccounting)
  };
}

export async function createPfSense({ name, ip, radiusSecret }) {
  await query(
    `INSERT INTO nas (nasname, shortname, type, secret, server, description)
     VALUES (:ip, :shortname, 'other', :secret, NULL, :name)`,
    {
      ip,
      shortname: name.toLowerCase().replaceAll(" ", "-"),
      secret: radiusSecret,
      name: name.toUpperCase()
    }
  );
  return getSnapshot();
}

export async function togglePfSense(id) {
  const rows = await query("SELECT server FROM nas WHERE id = :id", { id });
  const next = rows[0]?.server === "disabled" ? null : "disabled";
  await query("UPDATE nas SET server = :server WHERE id = :id", { id, server: next });
  return getSnapshot();
}

function parsePingMs(output) {
  const match = output.match(/time[=<]([0-9.,]+)\s*ms/i);
  if (!match) return null;
  return Math.max(1, Math.round(Number(match[1].replace(",", "."))));
}

async function pingHost(host) {
  const isIpv6 = host.includes(":");
  const args = isIpv6 ? ["-6", "-c", "1", "-W", "2", host] : ["-c", "1", "-W", "2", host];
  const { stdout } = await execFileAsync("ping", args, { timeout: 3500 });
  return parsePingMs(stdout);
}

export async function testPfSense(id) {
  const rows = await query("SELECT id, nasname FROM nas WHERE id = :id LIMIT 1", { id });
  const server = rows[0];
  if (!server) {
    throw Object.assign(new Error("Serveur pfSense introuvable"), { status: 404 });
  }

  let ping = null;
  let pingError = null;
  try {
    ping = await pingHost(server.nasname);
  } catch (error) {
    pingError = error.message;
  }

  const snapshot = await getSnapshot();
  snapshot.pfSenseServers = snapshot.pfSenseServers.map((item) =>
    item.id === String(id)
      ? { ...item, ping, pingError, lastSeen: ping ? "maintenant" : item.lastSeen }
      : item
  );
  return snapshot;
}

export async function deletePfSense(id) {
  await transaction(async (connection) => {
    const [servers] = await connection.execute("SELECT id, nasname FROM nas WHERE id = :id LIMIT 1", { id });
    const server = servers[0];
    if (!server) {
      throw Object.assign(new Error("Serveur pfSense introuvable"), { status: 404 });
    }

    const [voucherRows] = await connection.execute(
      `SELECT code FROM vouchers
       WHERE nas_id = :id
          OR batch_id IN (SELECT id FROM voucher_batches WHERE nas_id = :id)`,
      { id }
    );

    if (voucherRows.length > 0) {
      await deleteRadiusRowsForCodes(connection, voucherRows.map((row) => row.code));
    }

    await connection.execute("DELETE FROM vouchers WHERE nas_id = :id", { id });
    await connection.execute("DELETE FROM voucher_batches WHERE nas_id = :id", { id });
    await connection.execute("DELETE FROM radacct WHERE nasipaddress = :nasname", { nasname: server.nasname });
    await connection.execute("DELETE FROM nas WHERE id = :id", { id });
  });

  return getSnapshot();
}

export async function createVoucher({ code, duration, uploadKbps, downloadKbps, pfsenseId }) {
  const nasId = pfsenseId && pfsenseId !== "all" ? Number(pfsenseId) : null;
  const durationMinutes = Number(duration || 1440);
  const upload = Number(uploadKbps || 0);
  const download = Number(downloadKbps || 0);

  await transaction(async (connection) => {
    const voucherCode = (code && code.trim().toUpperCase()) || await uniqueVoucherCode(connection);
    if (!VOUCHER_CODE_PATTERN.test(voucherCode)) {
      throw Object.assign(new Error("Le code voucher doit contenir exactement 6 caracteres A-Z ou 1-9"), { status: 400 });
    }
    const [existing] = await connection.execute("SELECT id FROM vouchers WHERE code = :code LIMIT 1", { code: voucherCode });
    if (existing.length > 0) {
      throw Object.assign(new Error(`Le voucher ${voucherCode} existe deja`), { status: 409 });
    }
    await connection.execute(
      `INSERT INTO vouchers (code, duration_minutes, upload_kbps, download_kbps, nas_id, status)
       VALUES (:code, :duration, :upload, :download, :nasId, 'active')`,
      { code: voucherCode, duration: durationMinutes, upload, download, nasId }
    );
    await upsertRadiusRows(connection, voucherCode, durationMinutes, upload, download);
  });

  return getSnapshot();
}

export async function createBatch({ name, quantity, duration, pfsenseId }) {
  const safeQuantity = Math.max(1, Math.min(Number(quantity || 1), MAX_BATCH_QUANTITY));
  const durationMinutes = Number(duration || 1440);
  const nasId = pfsenseId && pfsenseId !== "all" ? Number(pfsenseId) : null;
  const batchName = ((name && name.trim()) || `LOT_${durationMinutes}MIN`).toUpperCase();

  const existingBatch = await query("SELECT id FROM voucher_batches WHERE UPPER(name) = :name LIMIT 1", { name: batchName });
  if (existingBatch.length > 0) {
    throw Object.assign(new Error(`Le lot ${batchName} existe deja`), { status: 409 });
  }

  await transaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO voucher_batches (name, quantity, duration_minutes, nas_id)
       VALUES (:name, :quantity, :duration, :nasId)`,
      { name: batchName, quantity: safeQuantity, duration: durationMinutes, nasId }
    );

    const generatedCodes = await generateUniqueVoucherCodes(connection, safeQuantity);
    await insertVoucherBatchRows(connection, result.insertId, generatedCodes, durationMinutes, nasId);
  });

  return getSnapshot();
}

export async function toggleVoucher(id) {
  const rows = await query("SELECT code, status, duration_minutes, upload_kbps, download_kbps FROM vouchers WHERE id = :id", { id });
  const voucher = rows[0];
  if (!voucher) return getSnapshot();

  const nextStatus = voucher.status === "revoked" ? "active" : "revoked";
  await transaction(async (connection) => {
    await connection.execute(
      "UPDATE vouchers SET status = :status, revoked_at = IF(:status = 'revoked', NOW(), NULL) WHERE id = :id",
      { id, status: nextStatus }
    );
    if (nextStatus === "revoked") {
      await connection.execute("DELETE FROM radcheck WHERE username = :code", { code: voucher.code });
      await connection.execute("DELETE FROM radreply WHERE username = :code", { code: voucher.code });
    } else {
      await upsertRadiusRows(connection, voucher.code, voucher.duration_minutes, voucher.upload_kbps, voucher.download_kbps);
    }
  });

  return getSnapshot();
}

export async function deleteBatch(id) {
  const voucherCodes = await query("SELECT code FROM vouchers WHERE batch_id = :id", { id });
  if (voucherCodes.length > 0) {
    await transaction(async (tx) => {
      await deleteRadiusRowsForCodes(tx, voucherCodes.map((row) => row.code));
    });
  }
  await query("DELETE FROM vouchers WHERE batch_id = :id", { id });
  await query("DELETE FROM voucher_batches WHERE id = :id", { id });
  return getSnapshot();
}

export async function getVoucherCodesForExport(batchId) {
  const rows = batchId
    ? await query("SELECT code FROM vouchers WHERE batch_id = :batchId ORDER BY id ASC", { batchId })
    : await query("SELECT code FROM vouchers ORDER BY id ASC");
  return rows.map((row) => row.code);
}

async function upsertRadiusRows(connection, code, durationMinutes, uploadKbps, downloadKbps) {
  await connection.execute("DELETE FROM radcheck WHERE username = :code", { code });
  await connection.execute("DELETE FROM radreply WHERE username = :code", { code });
  await connection.execute(
    "INSERT INTO radcheck (username, attribute, op, value) VALUES (:code, 'Cleartext-Password', ':=', :code)",
    { code }
  );
  await connection.execute(
    "INSERT INTO radreply (username, attribute, op, value) VALUES (:code, 'Session-Timeout', ':=', :seconds)",
    { code, seconds: String(Number(durationMinutes) * 60) }
  );
  if (downloadKbps) {
    await connection.execute(
      "INSERT INTO radreply (username, attribute, op, value) VALUES (:code, 'WISPr-Bandwidth-Max-Down', ':=', :value)",
      { code, value: String(Number(downloadKbps) * 1000) }
    );
  }
  if (uploadKbps) {
    await connection.execute(
      "INSERT INTO radreply (username, attribute, op, value) VALUES (:code, 'WISPr-Bandwidth-Max-Up', ':=', :value)",
      { code, value: String(Number(uploadKbps) * 1000) }
    );
  }
}
