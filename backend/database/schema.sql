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
  status      VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
              CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  attended    BOOLEAN     NOT NULL DEFAULT false,
  attended_at TIMESTAMPTZ,
  UNIQUE (event_id, user_id) -- one registration per user per event
);

-- Update block: applies to databases created before the DRAFT status and the
-- event metadata columns existed. Every statement is safe to re-run.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED'));

ALTER TABLE events ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE events ADD COLUMN IF NOT EXISTS category  VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Attendance columns for databases created before attendance tracking existed.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;
