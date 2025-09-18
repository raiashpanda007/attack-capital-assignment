# attack-capital-assignment — Monorepo

This repository is a **Turborepo-based monorepo** containing:

* `apps/web` — **Next.js** frontend for user/agent call UI and transfer flow
* `apps/server` — **Node/Express (TypeScript)** API for token generation, participant checks, and room management
* `packages/ui` — shared UI primitives and styles
* `packages/*` — tooling (eslint, tsconfig, tailwind)

---

## 🚀 **Overview**

This project implements a **warm transfer flow using LiveKit**.
A warm transfer allows an agent (Agent A) to bring another agent (Agent B) into the call after a private discussion, without disconnecting the user.

---

## 🎯 **Key Objectives Achieved**

✅ **Real-time 1:1 audio call** between user and agent using LiveKit
✅ **Automatic role assignment** (Agent A / Agent B) based on participant count in main room
✅ **Support room creation** for private conversation between agents
✅ **Agent A mute logic** during private discussion so user is on hold
✅ **Complete transfer flow:** Agent A or B clicks transfer → user joins support room → Agent B takes over seamlessly
✅ **Monorepo setup** with Turborepo, clean separation of web and server apps
✅ **Environment-based configuration** (LiveKit keys, URLs)

---

## 🧩 **Architecture & Flow**

**High-level flow:**

1. **User joins main room** (`/user`)
2. **Agent A joins main room** (`/agent`) — first agent gets connected to user
3. **New agent (Agent B) joins** — routed to a temporary **support room**
4. **Agent A clicks Start Transfer:**

   * Agent A is muted in main room
   * Agent A + Agent B talk privately in support room
5. **Complete Transfer:**

   * User is moved to support room
   * Agent B takes over call
   * Agent A exits or unmutes based on flow

> **Goal:** User never disconnects during the transfer. Agents can have a private hand-off before the user is connected to Agent B.

---

## 🧠 **LLM Component**

Due to **time constraints and final mid-semester exams**, I was not able to build the LLM integration.
The project focuses on completing the **real-time warm transfer flow**, which was the main objective of the assignment.

---

## 🛠 **Tech Stack**

* **Frontend:** Next.js 14, TypeScript, TailwindCSS

* **Backend:** Express.js, TypeScript, LiveKit Server SDK

* **Realtime:** LiveKit Web SDK (for room joins, mute/unmute, participant events)

---

## ⚡ Quick Start

1. **Install dependencies:**

```bash
npm install
```


2. **Start the apps in development:**

```bash
# Server
cd apps/server
npm run tsbuild
npm run dev

# Frontend
cd apps/web
npm run dev
```

Or from repo root (if you have turbo installed):

```bash
npm run dev
```

---

## 📌 Future Improvements

* **LLM Integration:** Automated call summary before transfer
* **On-Hold Music/TTS:** User hears message while waiting during transfer
* **Better UI/UX:** Add participant status indicators & call timers
