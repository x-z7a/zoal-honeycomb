# Publish Docs to GitHub Pages

This repo uses GitHub Actions to publish docs automatically.

## Files Used

- Docs content: `docs/*.md`
- VitePress config: `docs/.vitepress/config.mts`
- Docs package: `docs/package.json`
- Deploy workflow: `.github/workflows/docs.yml`

## How Deployment Works

The workflow:

1. Installs docs dependencies in `docs/`
2. Builds docs with VitePress
3. Uploads the static site artifact
4. Deploys to GitHub Pages

Base URL behavior:

- If `PAGES_CUSTOM_DOMAIN` is set, docs build with `/` base
- Otherwise docs build with `/<repo-name>/` base for GitHub Pages project URLs

Triggers:

- Push to `main` for docs-related files
- Manual run (`workflow_dispatch`)

## Run Docs Locally

From repository root:

1. `cd docs`
2. Use Node.js 18+ (`node -v`)
3. `npm install`
4. `npm run docs:dev`

For production build preview:

1. `npm run docs:build`
2. `npm run docs:preview`

## Custom Domain Setup

Use a GitHub repository variable:

- Name: `PAGES_CUSTOM_DOMAIN`
- Value example: `docs.zoal.app`

When set, the workflow writes this into `CNAME` before deploy.

## One-Time GitHub Setup

1. Open repository `Settings` -> `Pages`
2. Set source to `GitHub Actions`
3. Save

## DNS Setup (for subdomain)

Create DNS CNAME record:

- host: `docs`
- target: `<your-github-username>.github.io`

After first successful deploy, wait for HTTPS certificate to become active.
