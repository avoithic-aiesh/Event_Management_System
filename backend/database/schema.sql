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

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(150) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  venue       VARCHAR(200) NOT NULL,
  starts_at   TIMESTAMPTZ  NOT NULL,
  ends_at     TIMESTAMPTZ  NOT NULL,
  capacity    INTEGER      NOT NULL CHECK (capacity > 0),
  status      VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED'
              CHECK (status IN ('PUBLISHED', 'CANCELLED')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS registrations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id) -- one registration per user per event
);
