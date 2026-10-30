-- Run with: npm run db:setup  (safe to run more than once)

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'MEMBER'
                CHECK (role IN ('MEMBER', 'ADMIN', 'SUPER_ADMIN')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
