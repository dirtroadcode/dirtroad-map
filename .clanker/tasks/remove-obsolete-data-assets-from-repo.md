---
type: chore
title: Remove obsolete data assets from repo
added: '2026-03-19'
finished: '2026-03-19'
---

Now that candidate data is live-loaded from a Google Sheet, identify and remove any static data files (JSON, CSV) still tracked in the repo, and consider pruning them from git history to reduce repo size.

- [ ] Identify tracked data files that are now redundant (e.g., candidates JSON/CSV)
- [ ] Remove obsolete data files from the repo
- [ ] Evaluate whether to rewrite git history to prune large data files
