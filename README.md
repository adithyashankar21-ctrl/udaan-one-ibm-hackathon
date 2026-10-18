# UDAAN ONE

**AI for Opportunity. Technology for All.**

UDAAN ONE is a voice-first, multilingual AI assistant that helps underserved citizens in India discover government schemes and official documents, understand their eligibility, and prepare complete, correct applications — without a middleman.

## Features

- **Discover** — describe your situation by voice or text in English, Hindi, Tamil, Telugu, Kannada or Malayalam; Gemini matches you to schemes (PM-AJAY, PM Vishwakarma, MUDRA, PMKVY, …) and document services (PAN, voter ID, passport, income/caste/residence certificates, ration card, …), each linked to its official source.
- **Understand** — plain-language eligibility, support and required documents, with a preliminary estimate that always needs official confirmation.
- **Smart Apply & Autofill** — upload or scan documents; Gemini extracts details into one profile, flags conflicts and missing proofs, asks simple questions, and produces a draft PDF or fills the official form.
- **Every channel** — web, WhatsApp-style chat and a phone helpline (IVR) mode, with reference number + PIN to continue across channels.
- **Privacy by design** — consent before processing, Aadhaar masked to last 4 digits, AES-256-GCM encrypted storage, 7-day automatic deletion, server-side API keys.
- **Honest** — never shows "submitted" or "approved" without official confirmation.

## Tech stack

React 19 · Vite · Tailwind CSS v4 · Node.js / Express · Google Gemini (`@google/genai`) · pdf-lib · hosted on **IBM LinuxONE**.

## Run locally

Prerequisite: Node.js 22+

```bash
npm install
cp .env.example .env   # then set GEMINI_API_KEY
npm run dev            # http://localhost:3000
```

## Deploy on IBM LinuxONE (s390x)

Build the frontend on a development machine (some build tools have no s390x binaries), then copy to the server:

```bash
npm run build
rsync -az --exclude node_modules --exclude .data ./ <user>@<server>:~/udaan-one/
```

On the server:

```bash
cd ~/udaan-one && npm ci
NODE_ENV=production PORT=3000 npx tsx server.ts
```

Run it as a systemd service for restarts on failure and boot. Microphone and camera features require HTTPS (or localhost).

## Disclaimer

UDAAN ONE is a hackathon prototype. Scheme and document information comes from public guidance and may change — always confirm with the official portal or office. It does not submit applications on the government's behalf.
