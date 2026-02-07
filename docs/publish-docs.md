# Publish Docs to GitHub Pages

This repo uses GitHub Actions to publish docs automatically.

## Files Used

- Docs content: `docs/*.md`
- MkDocs config: `mkdocs.yml`
- Deploy workflow: `.github/workflows/docs.yml`

## How Deployment Works

The workflow:

1. Builds docs with MkDocs
2. Uploads the static site artifact
3. Deploys to GitHub Pages

Triggers:

- Push to `main` for docs-related files
- Manual run (`workflow_dispatch`)

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
