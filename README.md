# avoid

A calm CLI tool that helps you identify and overcome task avoidance using AI-powered behavioral analysis.

Two questions. One classification. Three rewrites. A timer. That's it.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.2.0
- An OpenAI API key

### Install

```bash
git clone https://github.com/seawatts/avoid.git
cd avoid
cp .env.example .env
# Add your OpenAI API key to .env
bun install
bun run build
```

### Run

```bash
bun run cli
```

Or directly:

```bash
cd apps/cli
bun run start
```

## How It Works

1. **Two prompts** -- the tool asks what task feels heavy, then what your spouse would say you're procrastinating on.
2. **AI classification** -- uses GPT-4.1-mini to classify your avoidance pattern into one of six types: Ambiguity, Fear, Perfectionism, Boredom, Energy mismatch, or Social discomfort.
3. **Task rewrites** -- generates a concrete 10-minute version, a 2-minute version, and an ugly first draft version of the task.
4. **Agentic follow-up** -- the AI asks follow-up questions, surfaces patterns from your history, and suggests concrete next steps.
5. **Timer** -- optionally start a 10-minute countdown to build momentum.

## Memory and Persistence

All session data is stored locally in `~/.avoid/avoid.db` (SQLite via Drizzle ORM + `bun:sqlite`). No data leaves your machine except for AI API calls.

The memory system:
- Stores observations from each session
- Applies exponential decay scoring (half-life ~14 days) so recent patterns are weighted more heavily
- Consolidates old memories into pattern summaries every 10 sessions
- Injects relevant history into AI prompts so the tool learns your patterns over time

Session resume: if you close the CLI mid-session, it will offer to resume where you left off next time.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |

## Architecture

```
apps/
  cli/                     # OpenTUI terminal interface
    src/
      cli.tsx              # Entry point
      app.tsx              # Main state machine
      components/          # OpenTUI React components

packages/
  ai/                      # AI SDK integration
    src/
      analyze.ts           # Avoidance classification
      agentic.ts           # Semi-agentic conversation loop
      context.ts           # Memory context builder for prompts
      schemas.ts           # Zod schemas for structured output
      prompts.ts           # System prompt templates

  db/                      # Drizzle ORM + bun:sqlite
    src/
      schema.ts            # Drizzle table definitions
      client.ts            # Database connection
      queries.ts           # CRUD operations
      memory/              # Decay scoring, pattern analysis

  id/                      # ID generation (cuid2, nanoid)
  analytics/               # Local analytics tracking

tooling/
  typescript/              # Shared tsconfig
  commitlint/              # Commit conventions
  npm/                     # Publishing utilities
  testing/                 # Test configuration
```

## Development

```bash
# Watch mode (rebuild on changes)
bun run dev

# Type check all packages
bun run typecheck

# Run tests
bun run test

# Format code
bun run format:fix
```

## Design Principles

- Calm, minimal UI with whitespace and typographic hierarchy
- No emojis, no sound, no gamification
- Concrete actions only, no motivational fluff
- All data local, no external services beyond OpenAI

## License

MIT
