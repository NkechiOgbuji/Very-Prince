# Changesets

This directory is managed by [@changesets/cli](https://github.com/changesets/changesets).

## How to add a changeset

Run the following command from the repo root and follow the prompts:

```bash
npx changeset
```

Select the packages that changed, choose the semver bump type (major/minor/patch), and write a summary. A new markdown file will be created in this directory.

## Release flow

1. Open a PR with your changes and a changeset file.
2. When merged to `main`, the **Release** GitHub Action opens a "Version Packages" PR that bumps `package.json` versions and updates `CHANGELOG.md` files.
3. Merging that PR publishes the new versions.
