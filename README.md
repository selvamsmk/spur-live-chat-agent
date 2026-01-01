# Mini AI Live Chat Support Agent (Spur Assignment)

This repository is a submission for Spur’s **Mini AI Live Chat Support Agent** assignment.

Spur is a customer engagement platform that helps merchants automate support and improve customer experience using AI-driven workflows. This project simulates a small but production-minded slice of that problem space: a live chat widget backed by a real LLM, grounded with store FAQs, and designed with clean backend and frontend boundaries.

The goal is not feature volume, but **clarity, robustness, and real-world engineering tradeoffs**.

---

## Live Demo

A deployed version of the application is available here:

- **Web UI:** https://web-production-86f7f.up.railway.app/

Notes:
- No authentication required — conversations are session-based.
- The app uses a seeded FAQ knowledge base.
- AI responses depend on an LLM API key and may be rate-limited.
- Data in this environment is for demo purposes only.

---

## What This Project Demonstrates

- **End-to-end chat flow**
  - User opens a web UI and starts a conversation.
  - Messages are sent to a backend API.
  - The backend enriches context with store FAQs and conversation history.
  - A real LLM generates a reply.
  - Responses are streamed back and persisted.

- **Grounded AI behavior**
  - The model is constrained to answer only from known FAQ data.
  - Hallucination is explicitly discouraged via prompt guardrails.
  - Unknown questions are handled gracefully.

- **Production-aware design**
  - Prisma + SQLite for persistence.
  - Optional Redis for buffering/caching.
  - Typed environment configuration.
  - Safe error handling and input validation.

---

## Tech Stack

**Backend**
- Node.js + TypeScript
- Hono (HTTP server)
- Prisma ORM
- SQLite (Turso-compatible)
- Optional Redis (cache / write buffering)
- OpenAI-compatible LLM API

**Frontend**
- React
- TanStack Router
- TailwindCSS
- shadcn/ui

**Tooling**
- Turborepo (monorepo orchestration)
- Biome (linting & formatting)
- pnpm

---

## Core User Flow

1. User opens the chat UI.
2. User sends a message (e.g. “What’s your return policy?”).
3. Frontend posts the message to the backend.
4. Backend:
   - Validates input.
   - Persists the user message.
   - Loads relevant FAQ knowledge.
   - Calls the LLM with system prompt + history + FAQs.
   - Persists the AI response.
5. Frontend streams and renders the reply.

---

## User Experience Features

- Scrollable chat history with clear user vs AI separation
- Auto-scroll to latest message
- “Agent is typing…” indicator during streaming
- Disabled send button while a response is in flight
- Client-side truncation of overly long messages
- Graceful error messages when the AI is unavailable

---

## Project Structure

```text
spur-live-chat-agent/
├── apps/
│   ├── web/        # React frontend
│   └── server/     # Hono backend API
├── packages/
│   ├── db/         # Prisma schema & client
│   ├── env/        # Typed environment configuration
│   ├── contracts/  # Shared DTOs / API contracts
│   └── config/     # Shared TS config
```

## LLM Design & Prompting Strategy

### Model Integration

- **Provider:** The backend integrates with an OpenAI-compatible LLM API.
- **Isolation:** All model calls are wrapped behind a single service function
  (`generateReply(history, userMessage)`), making provider swaps trivial.
- **Secrets:** API keys are injected via environment variables and never committed.

### Prompt Structure

Each request to the LLM is composed of:

1. **System prompt**
   - Establishes the AI’s role as a support agent.
   - Enforces tone, brevity, and professionalism.
   - Applies strict guardrails to prevent hallucination.

2. **FAQ knowledge base (dynamic)**
   - Relevant store FAQs are injected as grounding context.
   - The model is explicitly instructed to rely only on this data.

3. **Conversation history**
   - Recent user and assistant messages are included for continuity.

4. **Current user message**

This structure ensures answers remain **contextual, consistent, and safe**.

### Guardrails & Safety

- The AI **must not** invent:
  - Order details
  - Tracking numbers
  - Pricing or product specs
- If a question is outside the FAQ scope, the AI:
  - Clearly states it does not have that information
  - Politely directs the user to contact support
- When uncertain, the model is instructed to err on the side of “I don’t know”.

---

## FAQ Knowledge Base Design

### Storage

- FAQs are stored in the database in a `store_faqs` table.
- Each FAQ entry contains:
  - Question
  - Answer
  - Optional metadata (category, priority)

### Seeding

- Example store FAQs are provisioned using the Prisma seed command:
  - `prisma/seed.ts`
- This ensures:
  - Predictable local setup
  - Consistent demo data
  - Versioned knowledge alongside code

### Runtime Loading

- On server startup:
  - FAQs are loaded into memory.
  - A lightweight lookup layer prepares them for prompt injection.
- This avoids repeated DB reads on every message.

### Prompt Injection

- When handling a user message:
  - Relevant FAQs are selected.
  - They are injected into the system prompt as **explicit grounding material**.
- The model is instructed that:
  - These FAQs are the only trusted source of truth.

### Why This Approach

- Keeps architecture simple and readable.
- Demonstrates real-world grounding without vector DB complexity.
- Leaves a clear upgrade path to embeddings or semantic search if needed.

---

## Redis Usage (Optional Optimization)

Redis is **optional** and not required for the app to function.

### Why Redis

- Reduce database writes during active conversations.
- Improve latency for high-frequency message exchanges.
- Enable short-lived session buffering.

### What Is Stored

- Active conversation message buffers (TTL-based).
- Temporary metadata (rate limits, in-flight status).
- Partial assistant responses during streaming.

### Persistence Strategy

- Redis acts as a **write-back buffer**.
- Conversations are flushed to SQLite via Prisma:
  - Periodically
  - Or when a session ends

### Source of Truth

- SQLite remains the canonical store.
- Redis is strictly an optimization layer.

---

## Setup & Environment Configuration

### Installation

```bash
pnpm install
```

## Required Environment Variables

Set these in `apps/server/.env` or your hosting provider (e.g. Railway):

- `DATABASE_URL`  
  Example: `file:./data/local.db`

- `OPENAI_API_KEY`  
  Required to enable AI responses

### Optional Environment Variables

- `REDIS_URL` — Enable Redis caching (optional)
- `PORT` — Server port (defaults to `3000`)
- `VITE_SERVER_URL` — Override API base URL for the frontend

---

## Database Setup

Prepare the database and seed example FAQs:

```bash
pnpm run db:push
pnpm run db:seed
```

## Run Locally

Start all services in development mode:

```bash
pnpm run dev
```
- **Web UI:** http://localhost:3001  
- **API:** http://localhost:3000  

---

## Robustness & Edge Case Handling

### Input Validation

- Empty messages are rejected on both client and server.
- Very long messages are:
  - Warned about in the UI
  - Safely truncated or handled server-side

### Backend Stability

- All request handlers are wrapped in `try/catch`.
- Malformed input never crashes the server.
- Errors return safe, deterministic responses.

### LLM Failure Handling

- Timeouts, rate limits, and invalid API keys are caught.
- Users receive a friendly fallback message.
- No raw LLM errors leak to the UI.

### Security & Safety

- No secrets are committed to the repository.
- All credentials are provided via environment variables.
- No customer PII or real order data is ever accessed.

### Graceful Degradation

- If Redis is unavailable → fallback to database-only persistence.
- If the LLM is unavailable → user sees a clear retry message.
- If conversation history grows too large → older messages are trimmed safely.

---

## Design Philosophy

This project intentionally prioritizes:

- **Clarity over cleverness**
- **Safety over speculation**
- **Realistic architecture over toy demos**

It reflects how a production AI support system would be built:  
small, grounded, debuggable, and easy to extend.

## Available Scripts

- `pnpm run dev` — start all apps
- `pnpm run dev:web` — frontend only
- `pnpm run dev:server` — backend only
- `pnpm run build` — production build
- `pnpm run db:push` — apply Prisma schema
- `pnpm run db:seed` — seed FAQ data
- `pnpm run db:studio` — Prisma Studio
- `pnpm run check` — lint & format
- `pnpm run check-types` — typecheck

---

## What I Would Do Next With More Time

- Add lightweight authentication for cross-device continuity
- Introduce intent-based routing (billing, shipping, refunds)
- Add tool calling for structured data access (orders, products)
- Build a small admin UI for managing FAQs
- Add analytics around fallback rates and response quality

