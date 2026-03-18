---
type: chore
title: Set up GitHub Actions deploy to GitHub Pages
added: '2026-03-17'
---

Create a GitHub Actions workflow (.github/workflows/deploy.yml) that triggers on push to main. Steps: checkout, install Node deps, run npm run build, deploy the dist/ directory to GitHub Pages using the gh-pages action. Configure the Vite base path for GitHub Pages if needed.
