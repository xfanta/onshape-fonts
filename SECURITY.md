# Security policy

Thanks for taking the time to look at the security of Google Fonts for Onshape.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Public issues are indexed and visible to anyone the moment they're filed, which gives attackers a head start while the fix is still in progress.

Instead, please email **michal.fanta@xfanta.cz** with:

- A description of the issue and the kind of impact you think it has (data exposure, account takeover, RCE in FeatureScript context, etc.).
- Steps to reproduce — a minimal repro, a curl command, or a short screen recording.
- Your GitHub handle if you'd like credit in the fix's release notes.

I'll acknowledge receipt within **3 business days** and aim to have a plan or a fix within **14 days** for genuine vulnerabilities. For complex issues this may take longer; I'll keep you updated.

## What's in scope

The add-in is a small, single-maintainer hobby project, but the surface area that matters:

- **OAuth flow** (`/api/oauth/*`) — token leakage, CSRF, redirect issues.
- **Token storage** — anything that lets an unrelated user retrieve another user's Onshape tokens from Vercel KV.
- **Feature insert endpoint** (`/api/feature/add`) — escalation that lets one authenticated user act on another user's documents.
- **Iframe panel** (`/panel`) — clickjacking, postMessage trust, prompt-injection-like issues with embedded text.
- **Static site** (`/`, `/preview`, etc.) — XSS or content injection.
- **FeatureScript bundle** — anything that lets the FS feature do something the user didn't authorize in Onshape.

## What's out of scope

- Vulnerabilities in upstream dependencies (Next.js, opentype.js, Onshape's own API, Vercel infra) — please report those to the respective projects.
- Self-XSS that requires the user to paste arbitrary code into their own browser console.
- Rate limiting / DoS of the public Vercel deployment — the cost-cap setting is the mitigation; report it if it can be triggered cheaply by a remote attacker.
- Reports generated purely by automated scanners with no analysis of impact.

## Supported versions

Only the current `main` branch deployed at `onshape-fonts.vercel.app` (and the Onshape App Store install pointing at it) is supported. There are no maintained backports.
