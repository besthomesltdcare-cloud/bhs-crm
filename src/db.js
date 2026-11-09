import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reps (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','on_hold','former')),
  rep_id INTEGER REFERENCES reps(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  value_p INTEGER NOT NULL CHECK (value_p >= 0),
  close_date TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('new_lead','contacted','qualified','proposal','negotiation','closed')),
  outcome TEXT CHECK (outcome IN ('won','lost')),
  probability INTEGER NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  notes TEXT NOT NULL DEFAULT '',
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  closed_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((stage = 'closed' AND outcome IS NOT NULL AND closed_on IS NOT NULL) OR (stage <> 'closed' AND outcome IS NULL AND closed_on IS NULL))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  actor_id INTEGER REFERENCES reps(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  rep_id INTEGER NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_rep ON customers(rep_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_rep ON deals(rep_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage, closed_on);
CREATE INDEX IF NOT EXISTS idx_tasks_rep ON tasks(rep_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_activity_customer ON activity(customer_id, id);
CREATE INDEX IF NOT EXISTS idx_activity_deal ON activity(deal_id, id);
CREATE INDEX IF NOT EXISTS idx_notifications_rep ON notifications(rep_id, read_at);
`;

export function openDatabase(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
