# Semantic versioning policy

This Lithekit package follows Semantic Versioning 2.0.0. Public package entrypoints, runtime
exports, documented behavior, errors, and TypeScript inference are compatibility contracts.

Patch releases fix defects without intentionally breaking documented usage. Minor releases add
backward-compatible capabilities. Major releases may remove, rename, narrow, or otherwise change
documented contracts. Published versions are immutable and are never replaced.
