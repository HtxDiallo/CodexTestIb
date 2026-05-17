CREATE TABLE IF NOT EXISTS voucher_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  quantity INT NOT NULL,
  duration_minutes INT NOT NULL,
  upload_kbps INT NULL,
  download_kbps INT NULL,
  nas_id INT NULL,
  is_revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_voucher_batches_nas_id (nas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vouchers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  duration_minutes INT NOT NULL,
  upload_kbps INT NULL,
  download_kbps INT NULL,
  nas_id INT NULL,
  status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  max_uses INT NOT NULL DEFAULT 1,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vouchers_batch_id FOREIGN KEY (batch_id) REFERENCES voucher_batches(id) ON DELETE CASCADE,
  INDEX idx_vouchers_code (code),
  INDEX idx_vouchers_status (status),
  INDEX idx_vouchers_batch_id (batch_id),
  INDEX idx_vouchers_nas_id (nas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mac_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  mac_address VARCHAR(17) NOT NULL UNIQUE,
  nas_id INT NULL,
  expires_at TIMESTAMP NOT NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mac_devices_mac_address (mac_address),
  INDEX idx_mac_devices_nas_id (nas_id),
  INDEX idx_mac_devices_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(80) NULL,
  ip_address VARCHAR(45) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
