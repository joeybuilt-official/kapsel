/**
 * SQLite database layer for the Kapsel registry.
 * Uses better-sqlite3 for simplicity in the reference implementation.
 * Production deployments can swap to Postgres by replacing this module.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = process.env['KAPSEL_DB_PATH'] ?? path.join(process.cwd(), 'data', 'registry.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS publishers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    scope      TEXT    NOT NULL UNIQUE,
    github_id  TEXT    NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS extensions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    type         TEXT    NOT NULL,
    display_name TEXT    NOT NULL,
    description  TEXT    NOT NULL,
    author       TEXT    NOT NULL,
    license      TEXT    NOT NULL,
    latest       TEXT    NOT NULL,
    keywords     TEXT    NOT NULL DEFAULT '[]',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ext_name     TEXT    NOT NULL REFERENCES extensions(name),
    version      TEXT    NOT NULL,
    manifest     TEXT    NOT NULL,
    tarball_path TEXT    NOT NULL,
    shasum       TEXT    NOT NULL,
    published_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(ext_name, version)
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    ext_name TEXT    NOT NULL,
    version  TEXT    NOT NULL,
    week     TEXT    NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ext_name, version, week)
  );

  CREATE INDEX IF NOT EXISTS idx_versions_ext ON versions(ext_name);
  CREATE INDEX IF NOT EXISTS idx_downloads_ext ON downloads(ext_name);
`);

// ---- Queries ----

export interface ExtensionRow {
  name: string;
  type: string;
  display_name: string;
  description: string;
  author: string;
  license: string;
  latest: string;
  keywords: string;
  created_at: number;
  updated_at: number;
}

export interface VersionRow {
  ext_name: string;
  version: string;
  manifest: string;
  tarball_path: string;
  shasum: string;
  published_at: number;
}

export const queries = {
  getExtension: db.prepare<[string], ExtensionRow>(
    'SELECT * FROM extensions WHERE name = ?'
  ),

  getVersion: db.prepare<[string, string], VersionRow>(
    'SELECT * FROM versions WHERE ext_name = ? AND version = ?'
  ),

  getAllVersions: db.prepare<[string], { version: string }>(
    'SELECT version FROM versions WHERE ext_name = ? ORDER BY published_at ASC'
  ),

  searchExtensions: db.prepare<[string, string, number, number], ExtensionRow>(`
    SELECT e.* FROM extensions e
    WHERE (? = '' OR e.name LIKE '%' || ? || '%' OR e.description LIKE '%' || ? || '%' OR e.keywords LIKE '%' || ? || '%')
    AND  (? = '' OR e.type = ?)
    ORDER BY e.updated_at DESC
    LIMIT ? OFFSET ?
  `),

  countSearch: db.prepare<[string, string], { count: number }>(`
    SELECT COUNT(*) as count FROM extensions e
    WHERE (? = '' OR e.name LIKE '%' || ? || '%' OR e.description LIKE '%' || ? || '%' OR e.keywords LIKE '%' || ? || '%')
    AND  (? = '' OR e.type = ?)
  `),

  weeklyDownloads: db.prepare<[string], { count: number }>(`
    SELECT COALESCE(SUM(count), 0) as count FROM downloads
    WHERE ext_name = ? AND week = strftime('%Y-%W', 'now')
  `),

  totalDownloads: db.prepare<[string], { count: number }>(
    'SELECT COALESCE(SUM(count), 0) as count FROM downloads WHERE ext_name = ?'
  ),

  upsertExtension: db.prepare(`
    INSERT INTO extensions (name, type, display_name, description, author, license, latest, keywords, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch() * 1000)
    ON CONFLICT(name) DO UPDATE SET
      latest = excluded.latest,
      description = excluded.description,
      display_name = excluded.display_name,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `),

  insertVersion: db.prepare(`
    INSERT INTO versions (ext_name, version, manifest, tarball_path, shasum)
    VALUES (?, ?, ?, ?, ?)
  `),

  recordDownload: db.prepare(`
    INSERT INTO downloads (ext_name, version, week, count) VALUES (?, ?, strftime('%Y-%W', 'now'), 1)
    ON CONFLICT(ext_name, version, week) DO UPDATE SET count = count + 1
  `),

  getPublisherByScope: db.prepare<[string], { id: number; scope: string; github_id: string }>(
    'SELECT * FROM publishers WHERE scope = ?'
  ),

  upsertPublisher: db.prepare(`
    INSERT INTO publishers (scope, github_id) VALUES (?, ?)
    ON CONFLICT(github_id) DO UPDATE SET scope = excluded.scope
  `),
};
