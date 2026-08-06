# Security policy

## Current security boundary

Rubies v0.2 encrypts the local budget payload with AES-256-GCM. The key is derived from the user's password with PBKDF2-SHA-256, a random salt, and 310,000 iterations. A fresh IV and salt are generated for each persisted payload.

The password is not stored. There is no recovery mechanism.

Rubies is currently a static single-user PWA. Its local login protects access to encrypted browser data; it is not HTTP authentication and does not prevent someone from downloading the public application shell. Deploy behind HTTPS and an authenticating reverse proxy when the site itself must be private.

## Sensitive exports

JSON exports are not encrypted. Treat them like financial documents.

## Reporting a vulnerability

Please open a private GitHub security advisory for the repository rather than a public issue. Include reproduction steps, affected versions, and expected impact.
