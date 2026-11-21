# Phase 2 Implementation Plan

> For agentic workers use superpowers:executing-plans to implement task by task.

**Goal:** Authenticated private datasets with persistent history.
**Architecture:** Verified Supabase bearer identity and user-scoped REST/Storage access. Existing parsing services operate in request-scoped temporary directories.
**Tech Stack:** Next.js, FastAPI, httpx, Supabase Auth/Postgres/Storage.
**Spec:** docs/superpowers/specs/2026-11-21-phase-2-accounts-storage-design.md

## Global Constraints
Preserve all seven formats and processing limits. Fail closed in Supabase mode. Never accept owner identity from client input.

## Review Focus
Expired sessions, cross-owner reads, partial uploads, concurrent sheet changes, interrupted deletion.

## Tasks
- [x] Add migration with owner RLS, private storage policies, versioned writes and deletion state.
- [x] Add validated configuration, verified auth and request-scoped repository.
- [x] Add history/detail APIs and durable upload/selection/deletion.
- [x] Add account UI, bearer forwarding, history/reopen and explicit deletion.
- [x] Verify local regression, mocked auth/ownership failures, lint, types and build.
- [x] Document real Supabase setup and outstanding live verification.

Live Supabase verification deferred by user until project creation. See docs/phase-2-setup.md.
