# Aegis — Session Export/Import

Aegis stores sessions as append-only JSONL files in `~/.aegis/agent/sessions/`. The `/session` command exports and imports them, with optional AES-256-GCM encryption.

## Commands

```bash
/session export [--encrypt] [<path>]   # export the current session
/session import <path> [--decrypt]     # import a session file
/session                                # list session files
```

## Encryption

Use `--encrypt` / `--decrypt` with a passphrase via the `AEGIS_SESSION_PASSPHRASE` env var:

```bash
AEGIS_SESSION_PASSPHRASE=mysecret /session export --encrypt ~/backup.jsonl
AEGIS_SESSION_PASSPHRASE=mysecret /session import ~/backup.jsonl --decrypt
```

Encryption uses AES-256-GCM (node:crypto, zero deps) with PBKDF2-style key derivation.

## Notes

- Export writes the current session's JSONL to the given path (default `~/session-export.jsonl`).
- Import writes the file into `~/.aegis/agent/sessions/` as a new JSONL file.
