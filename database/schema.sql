-- VoucherRADIUS application schema.
-- FreeRADIUS native tables such as radcheck, radreply, radacct and nas
-- should be created from the official FreeRADIUS SQL schema for your engine,
-- then extended/linked by this application schema.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nas_servers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  shortname VARCHAR(64) UNIQUE NOT NULL,
  ip_address INET NOT NULL,
  radius_secret VARCHAR(255) NOT NULL,
  pfsense_label VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_ping_ms INTEGER,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voucher_batches (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  upload_kbps INTEGER,
  download_kbps INTEGER,
  nas_server_id BIGINT REFERENCES nas_servers(id),
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vouchers (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT REFERENCES voucher_batches(id) ON DELETE SET NULL,
  code VARCHAR(80) UNIQUE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  upload_kbps INTEGER,
  download_kbps INTEGER,
  allowed_nas_server_id BIGINT REFERENCES nas_servers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_batch_id ON vouchers(batch_id);

CREATE TABLE IF NOT EXISTS mac_devices (
  id BIGSERIAL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  mac_address VARCHAR(17) UNIQUE NOT NULL,
  allowed_nas_server_id BIGINT REFERENCES nas_servers(id),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mac_devices_mac_address ON mac_devices(mac_address);
CREATE INDEX IF NOT EXISTS idx_mac_devices_expires_at ON mac_devices(expires_at);

CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(80),
  ip_address INET,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Example SQL rows that the backend should mirror into FreeRADIUS:
--
-- radcheck:
-- INSERT INTO radcheck (username, attribute, op, value)
-- VALUES ('AD5FB9', 'Cleartext-Password', ':=', 'AD5FB9');
--
-- radreply:
-- INSERT INTO radreply (username, attribute, op, value)
-- VALUES
--   ('AD5FB9', 'Session-Timeout', ':=', '86400'),
--   ('AD5FB9', 'WISPr-Bandwidth-Max-Down', ':=', '1000000'),
--   ('AD5FB9', 'WISPr-Bandwidth-Max-Up', ':=', '1000000');
