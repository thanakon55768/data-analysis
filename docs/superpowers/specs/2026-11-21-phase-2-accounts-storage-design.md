# Phase 2 — Accounts and persistent datasets

## Intent
Add Supabase accounts, private dataset storage, upload history, reopening datasets, and deletion to the existing Thai Next.js and FastAPI application.

This extends the approved system design. The user selected accounts and storage before Gemini on 21 November 2026.

## Approach
Use Supabase Auth, PostgreSQL with row-level security, and a private Storage bucket, as specified in the approved architecture. Preserve the existing parsing and statistics services. Local-only mode remains available through explicit configuration for development.

An application-owned authentication database would require additional password and session infrastructure. A browser-only storage integration would bypass the existing Python validation and processing entry points. The selected Supabase approach reuses the existing backend and supplies account and storage boundaries.

## User experience
Provide email/password registration, login, logout, email confirmation feedback, password reset, and expired-session handling. Show each signed-in user's upload history with filename, upload time, and processing status. Selecting an entry restores the dataset or sheet selection. Users can delete an entry with confirmation.

## Authentication boundary
The frontend obtains a Supabase session and forwards its bearer token through the existing server proxy. FastAPI validates the token through Supabase Auth and derives the user ID from that verified identity. The API never accepts an owner supplied by the browser. Requests in configured Supabase mode require authentication.

Public Supabase URL and publishable key may appear in browser configuration. Service-role keys are unnecessary for user-facing requests. Secrets must never enter source control or application logs.

## Storage and ownership
Use a datasets table with UUID, owner ID, original filename, timestamps, status, selected sheet, and private object paths. Enforce ownership through RLS for all CRUD operations and through private Storage policies using an owner/dataset path prefix. Index owner and creation time for history.

Store original files and parsed results privately. Use isolated temporary directories while parsing and remove them after a request. Retain the existing upload, archive, cell, row, logical-size, and timeout limits.

A durable status transition handles upload and deletion failures. An entry being deleted becomes unavailable to analysis before removing objects. Retrying deletion removes remaining objects and then metadata. Persist parsed data before marking an entry ready. Sheet changes must preserve the last complete version on failure and use a version check to prevent concurrent updates overwriting each other.

## Configuration and migration
Supply versioned SQL migrations, environment examples, and setup instructions. Supabase mode must fail closed when configuration is incomplete. Keep local mode visibly identified. Account mode retains datasets until deletion, with retention behavior documented separately from local 24-hour expiry.

## Verification
Check registration/login/session failure behavior, upload and reopening for the supported formats, history after refresh, and deletion including interrupted cleanup. Use two real accounts to verify cross-account denial for metadata, previews, statistics, sheet selection, deletion, and direct Storage access. Run backend tests, lint, type checking, and production build.

## Implementation decisions proposed by the assistant
Use email/password accounts first. Apply a private bucket named datasets. Keep processing limits from Phase 1. Show recent uploads with pagination. Keep public deployment in its later project phase.

## External dependency
Real integration verification requires a Supabase project URL and publishable/anon key, migration access, and two test accounts. No Supabase configuration or connected management tool was found during inspection. Real account and RLS verification remains pending until that environment exists.
