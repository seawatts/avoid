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
cd packages/avoid
bun run start
```

## How It Works

1. **Two prompts** -- the tool asks what task feels heavy, then what your spouse would say you're procrastinating on.
2. **AI classification** -- uses GPT-4.1-mini to classify your avoidance pattern into one of six types: Ambiguity, Fear, Perfectionism, Boredom, Energy mismatch, or Social discomfort.
3. **Task rewrites** -- generates a concrete 10-minute version, a 2-minute version, and an ugly first draft version of the task.
4. **Agentic follow-up** -- the AI asks follow-up questions, surfaces patterns from your history, and suggests concrete next steps.
5. **Timer** -- optionally start a 10-minute countdown to build momentum.

## Memory and Persistence

All session data is stored locally in `~/.avoid/avoid.db` (SQLite via `bun:sqlite`). No data leaves your machine except for AI API calls.

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

## Project Structure

```
packages/avoid/
  src/
    cli.tsx              # Entry point
    app.tsx              # Main state machine
    components/          # OpenTUI React components
    ai/                  # AI SDK integration (analysis + agentic loop)
    memory/              # SQLite persistence, decay scoring, pattern analysis
    types.ts             # Shared types
    env.ts               # Environment validation
```

## Development

```bash
# Watch mode (rebuild on changes)
bun run dev

# Type check
bun run typecheck

# Run tests
bun run test

# Format
bun run format:fix
```

## Design Principles

- Calm, minimal UI with whitespace and typographic hierarchy
- No emojis, no sound, no gamification
- Concrete actions only, no motivational fluff
- All data local, no external services beyond OpenAI

## License

MIT
