# Security policy

Rubies is a self-hosted, single-user application. Its primary security boundary is an encrypted browser-local budget vault.

## Supported version

Security fixes are made against the current release. Older releases are not guaranteed to receive backports.

## Local vault cryptography

Persistent budget state is encrypted before it is written to browser storage.

Rubies currently uses the browser Web Crypto API with:

- PBKDF2 with SHA-256 for password-based key derivation
- 310,000 PBKDF2 iterations
- a fresh random 16-byte salt for every persisted vault payload
- AES-256-GCM for authenticated encryption
- a fresh random 12-byte IV for every persisted vault payload

The password itself is not stored in browser storage. While the budget is unlocked, the password and decrypted state necessarily exist in the page's process memory so Rubies can save changes.

There is no password recovery mechanism. Losing the password means losing access to the encrypted local vault unless an unencrypted export exists elsewhere.

## What the Rubies password protects

The password protects the encrypted budget payload stored by Rubies in the browser. Someone who copies only that encrypted payload should not be able to read the budget without the password, subject to the strength of the password and the security of the browser/device.

The password is not server-side authentication. Rubies is served as a static application, so a person who can reach the web server can still retrieve the public application shell and reach the unlock screen.

If access to the Rubies URL itself must be restricted, deploy it behind HTTPS and a server-side authentication layer such as an authenticating reverse proxy.

## Browser and device boundary

Rubies does not claim to protect an unlocked budget from a compromised browser or operating system. Examples outside the vault's protection include:

- malicious or compromised browser extensions with page access
- injected script running in the Rubies origin
- malware or debugging tools able to inspect browser process memory
- an attacker with control of the device while Rubies is already unlocked
- browser or operating-system vulnerabilities

The bundled Nginx configuration supplies CSP and other browser-hardening headers, but those headers are defense in depth rather than a substitute for a trusted browser, HTTPS, or server-side access control.

## Local storage

The encrypted vault is stored in browser `localStorage` for the Rubies origin. Clearing site data removes it. Browser profiles and origins are separate storage boundaries, so moving Rubies to a different hostname, browser profile, browser, or device does not move the vault automatically.

## Imports and exports

Rubies JSON exports are **not encrypted**. Treat them as sensitive financial documents and protect backups accordingly.

nYNAB JSON imports can also contain sensitive financial information. Rubies parses imports locally in the browser; importing replaces the current budget only after confirmation.

## Network deployment

For normal self-hosted use:

- serve Rubies over HTTPS
- keep the host, reverse proxy, and container images patched
- add server-side authentication when the site itself should not be publicly reachable
- avoid exposing development servers directly to untrusted networks

The default Docker image serves the static application through Nginx. It does not provide a Rubies server account system or HTTP session authentication.

## Reporting a vulnerability

Please use a private GitHub security advisory for the repository instead of opening a public issue. Include the affected version, reproduction steps, expected impact, and any relevant deployment assumptions.
