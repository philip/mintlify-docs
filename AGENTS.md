# Neon Documentation - Project Instructions

## About this project

- Neon Docs migrated to [Mintlify](https://mintlify.com) from a custom Next.js setup
- Pages are MDX files with YAML frontmatter
- Configuration lives in `docs.json`
- Run `npx mint dev` to preview locally
- Run `npx mint validate` to check build validity
- Run `npx mint broken-links` to check links

## Terminology

- Use "project" for a Neon project (contains branches, computes, databases)
- Use "branch" for a database branch (not "environment" or "copy")
- Use "compute" not "instance" or "server"
- Use "Neon Console" when referring to the web UI
- Use "connection string" not "database URL"

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise — one idea per sentence
- Use sentence case for headings
- Bold for UI elements: Click **Settings**
- Code formatting for file names, commands, paths, and code references

## Migration notes

This site was migrated from `~/git/neon-website/content/docs/`. Some pages
contain `MIGRATION_FLAG` comments marking components that need manual review.
Search for `MIGRATION_FLAG` to find them.

Snippets in `snippets/` were converted from Neon shared-content files.
Migration scripts live in `scripts/` (ignored by Mintlify).
