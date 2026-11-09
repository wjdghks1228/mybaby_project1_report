CREATE TABLE families (id TEXT PRIMARY KEY, child_id TEXT NOT NULL, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE devices (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, key_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions (key_hash TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE invites (key_hash TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE entries (family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, id TEXT NOT NULL, entity TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0, mutation_id TEXT NOT NULL, PRIMARY KEY (family_id,id));
--> statement-breakpoint
CREATE TABLE changes (seq INTEGER PRIMARY KEY AUTOINCREMENT, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, entry_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, entity TEXT NOT NULL, deleted INTEGER NOT NULL, mutation_id TEXT NOT NULL, UNIQUE(family_id,mutation_id));
--> statement-breakpoint
CREATE INDEX changes_family_seq ON changes(family_id,seq);
--> statement-breakpoint
CREATE TABLE mutations (family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, id TEXT NOT NULL, fingerprint TEXT NOT NULL, entry_id TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(family_id,id));
--> statement-breakpoint
CREATE TABLE auth_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);

--> statement-breakpoint
CREATE UNIQUE INDEX one_open_sleep ON entries(family_id) WHERE entity='record' AND deleted=0 AND json_extract(payload,'$.type')='sleep' AND json_extract(payload,'$.end') IS NULL;
