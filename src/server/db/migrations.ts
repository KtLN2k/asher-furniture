export interface Migration {
  id: string;
  sql: string;
}

/**
 * SQL תקני של PostgreSQL בלבד (עובד זהה על PGlite, Postgres מקומי ו-Supabase).
 * מזהים הם טקסט (UUID שנוצר באפליקציה) כדי שה-repository יישאר בלתי תלוי במנוע.
 */
export const migrations: Migration[] = [
  {
    id: "001_initial",
    sql: `
CREATE TABLE customers (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  phone       text NOT NULL DEFAULT '',
  address     text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  customer_id  text REFERENCES customers(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'draft',
  notes        text NOT NULL DEFAULT '',
  thumbnail    text,
  wizard_step  integer NOT NULL DEFAULT 1,
  revision     integer NOT NULL DEFAULT 1,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_updated_idx ON projects (updated_at DESC);
CREATE INDEX projects_customer_idx ON projects (customer_id);
CREATE INDEX projects_status_idx ON projects (status);

CREATE TABLE furniture_items (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  category    text,
  spec        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, position)
);

CREATE TABLE materials (
  id          text PRIMARY KEY,
  kind        text NOT NULL,
  name        text NOT NULL,
  attrs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit_price  numeric,
  active      boolean NOT NULL DEFAULT true,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE parts (
  id              text PRIMARY KEY,
  furniture_id    text NOT NULL REFERENCES furniture_items(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  label           text NOT NULL DEFAULT '',
  material_id     text REFERENCES materials(id) ON DELETE SET NULL,
  cut_dimensions  jsonb,
  spec            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE facades (
  id            text PRIMARY KEY,
  furniture_id  text NOT NULL REFERENCES furniture_items(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  target        text NOT NULL DEFAULT 'door',
  material_id   text REFERENCES materials(id) ON DELETE SET NULL,
  spec          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
`,
  },
];
