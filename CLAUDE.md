# CLAUDE.md

## Project Overview

This is **avoid** -- a local CLI tool that helps identify and overcome task avoidance using AI-powered behavioral analysis. Built with OpenTUI (terminal UI), Vercel AI SDK, and bun:sqlite for local persistence.

## Architecture

- **Monorepo**: Bun workspaces + Turborepo
- **CLI package**: `packages/avoid/` -- the entire application
- **Tooling**: `tooling/typescript`, `tooling/commitlint`, `tooling/npm`, `tooling/testing`
- **Runtime**: Bun (required for OpenTUI and bun:sqlite)

## Key Patterns

- OpenTUI React components for terminal UI (`@opentui/react`)
- AI SDK `generateObject` with Zod schemas for structured AI output
- bun:sqlite for local persistence in `~/.avoid/avoid.db`
- Exponential decay scoring for AI memory retrieval
- Semi-agentic conversation loop where AI decides next action via structured output

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run cli          # Run the avoid CLI
bun run dev          # Watch mode
bun run typecheck    # Type check
bun run test         # Run tests
bun run format:fix   # Format code with Biome
```

## Code Conventions

- TypeScript strict mode
- ESM only (`"type": "module"`)
- Biome for formatting (single quotes, semicolons, trailing commas)
- Kebab-case filenames
- No emojis in user-facing output
