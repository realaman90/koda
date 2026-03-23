/**
 * Database Migration Script
 * 
 * Run with: npm run db:migrate
 * 
 * This script:
 * 1. Creates the database file if it doesn't exist
 * 2. Creates the canvases table
 * 3. Creates the updated_at index
 * 
 * STANDALONE: This script does not import from ./index to avoid server-only restrictions
 */

// Load environment variables from .env file
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';

// Inline database config to avoid importing from ./index (which has server-only)
interface DatabaseConfig {
  type: 'local' | 'turso';
  isLocal: boolean;
  path?: string;
  url: string;
  authToken?: string;
}

function getDatabaseConfig(): DatabaseConfig {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  
  // If Turso is configured, use it
  if (tursoUrl && tursoUrl.startsWith('libsql://')) {
    return {
      type: 'turso',
      isLocal: false,
      url: tursoUrl,
      authToken: tursoToken,
    };
  }
  
  // Default to local SQLite
  const sqlitePath = process.env.SQLITE_PATH || './data/koda.db';
  
  return {
    type: 'local',
    isLocal: true,
    path: sqlitePath,
    url: sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`,
  };
}

const SCHEMA_SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    image_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique ON users(clerk_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    type TEXT NOT NULL DEFAULT 'personal',
    owner_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_unique ON workspaces(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type)`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_unique ON workspace_members(workspace_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role ON workspace_members(workspace_id, role)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS workspace_invites (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'pending',
    token TEXT NOT NULL,
    invited_by_user_id TEXT NOT NULL,
    expires_at INTEGER,
    accepted_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_unique ON workspace_invites(token)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_email_status ON workspace_invites(workspace_id, email, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status ON workspace_invites(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_status ON workspace_invites(email, status)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id)`,
  `CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    owner_user_id TEXT,
    project_id TEXT,
    name TEXT NOT NULL,
    nodes TEXT,
    edges TEXT,
    thumbnail TEXT,
    thumbnail_url TEXT,
    thumbnail_status TEXT NOT NULL DEFAULT 'empty',
    thumbnail_updated_at INTEGER,
    thumbnail_version TEXT,
    thumbnail_error_code TEXT,
    thumbnail_custom INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS canvas_shares (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    canvas_id TEXT NOT NULL,
    grantee_type TEXT NOT NULL DEFAULT 'user',
    grantee_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_by_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS canvas_shares_canvas_grantee_unique ON canvas_shares(canvas_id, grantee_type, grantee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canvas_shares_workspace ON canvas_shares(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canvas_shares_canvas ON canvas_shares(canvas_id)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_updated ON canvases(updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS animation_projects (
    id TEXT PRIMARY KEY,
    canvas_id TEXT,
    engine TEXT,
    plan TEXT,
    active_version_id TEXT,
    sandbox_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS animation_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    video_url TEXT,
    snapshot_key TEXT,
    thumbnail_url TEXT,
    prompt TEXT,
    duration INTEGER,
    size_bytes INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_animation_versions_project ON animation_versions(project_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS credit_balances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    plan_key TEXT NOT NULL DEFAULT 'free_user',
    credits_per_month INTEGER NOT NULL DEFAULT 30,
    period_start INTEGER NOT NULL,
    lifetime_used INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credit_balances_user_id_unique ON credit_balances(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_credit_balances_user ON credit_balances(user_id)`,
  `CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL,
    reason TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type)`,
  `CREATE TABLE IF NOT EXISTS billing_accounts (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL DEFAULT 'workspace',
    owner_id TEXT NOT NULL,
    clerk_customer_id TEXT,
    stripe_customer_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS billing_accounts_owner_unique ON billing_accounts(owner_type, owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_billing_accounts_clerk_customer ON billing_accounts(clerk_customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe_customer ON billing_accounts(stripe_customer_id)`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    plan_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    billing_interval TEXT NOT NULL DEFAULT 'month',
    price_minor INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    monthly_credits INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS plans_plan_code_unique ON plans(plan_code)`,
  `CREATE TABLE IF NOT EXISTS entitlement_policies (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    effective_from INTEGER NOT NULL,
    effective_to INTEGER,
    policy_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS entitlement_policies_plan_version_unique ON entitlement_policies(plan_id, version)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    billing_account_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    authority TEXT NOT NULL DEFAULT 'clerk',
    authority_subscription_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_authority_ref_unique ON subscriptions(authority, authority_subscription_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_account_status ON subscriptions(billing_account_id, status)`,
  `CREATE TABLE IF NOT EXISTS subscription_cycle_grants (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    cycle_start INTEGER NOT NULL,
    cycle_end INTEGER NOT NULL,
    granted_credits INTEGER NOT NULL,
    grant_ledger_txn_id TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS subscription_cycle_grants_cycle_unique ON subscription_cycle_grants(subscription_id, cycle_start, cycle_end)`,
  `CREATE TABLE IF NOT EXISTS billing_invoices (
    id TEXT PRIMARY KEY,
    authority TEXT NOT NULL,
    authority_invoice_id TEXT NOT NULL,
    billing_account_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    invoice_date INTEGER NOT NULL,
    receipt_url TEXT,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_authority_invoice_unique ON billing_invoices(authority, authority_invoice_id)`,
  `CREATE INDEX IF NOT EXISTS idx_billing_invoices_account_date ON billing_invoices(billing_account_id, invoice_date)`,
  `CREATE TABLE IF NOT EXISTS external_billing_events (
    id TEXT PRIMARY KEY,
    authority TEXT NOT NULL,
    authority_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    billing_account_id TEXT,
    payload_hash TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    error_code TEXT,
    received_at INTEGER NOT NULL,
    processed_at INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS external_billing_events_authority_event_unique ON external_billing_events(authority, authority_event_id)`,
  `CREATE TABLE IF NOT EXISTS billing_admin_audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    workspace_id TEXT,
    request_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_billing_admin_audit_action ON billing_admin_audit_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_billing_admin_audit_created ON billing_admin_audit_logs(created_at)`,
  `CREATE TABLE IF NOT EXISTS pricing_versions (
    id TEXT PRIMARY KEY,
    version_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    effective_from INTEGER NOT NULL,
    effective_to INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pricing_versions_version_code_unique ON pricing_versions(version_code)`,
  `CREATE TABLE IF NOT EXISTS cost_rules (
    id TEXT PRIMARY KEY,
    pricing_version_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    model_ref TEXT NOT NULL,
    rule_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credit_buckets (
    id TEXT PRIMARY KEY,
    billing_account_id TEXT NOT NULL,
    bucket_type TEXT NOT NULL,
    label TEXT,
    expires_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credit_ledger_entries (
    id TEXT PRIMARY KEY,
    billing_account_id TEXT NOT NULL,
    bucket_id TEXT,
    txn_type TEXT NOT NULL,
    amount_credits INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    request_id TEXT,
    reason_code TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    occurred_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_idempotency_unique ON credit_ledger_entries(idempotency_key, reference_type, reference_id)`,
  `CREATE INDEX IF NOT EXISTS idx_credit_ledger_entries_account_occurred ON credit_ledger_entries(billing_account_id, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS credit_reservations (
    id TEXT PRIMARY KEY,
    billing_account_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    pricing_version_id TEXT NOT NULL,
    reserved_credits INTEGER NOT NULL,
    captured_credits INTEGER NOT NULL DEFAULT 0,
    released_credits INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credit_reservations_job_unique ON credit_reservations(job_id)`,
  `CREATE TABLE IF NOT EXISTS async_credit_settlements (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    external_task_id TEXT NOT NULL,
    billing_account_id TEXT NOT NULL,
    reservation_job_id TEXT NOT NULL,
    idempotency_key_prefix TEXT NOT NULL,
    estimated_credits INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    expires_at INTEGER NOT NULL,
    settled_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS async_credit_settlements_provider_task_unique ON async_credit_settlements(provider, external_task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_async_credit_settlements_status_expires ON async_credit_settlements(status, expires_at)`,
  `CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id TEXT PRIMARY KEY,
    job_name TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    window_end INTEGER NOT NULL,
    status TEXT NOT NULL,
    mismatch_count INTEGER NOT NULL DEFAULT 0,
    repair_count INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS reconciliation_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    details_json TEXT NOT NULL,
    repair_action TEXT,
    repair_status TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_items_run_item_unique ON reconciliation_items(run_id, item_key)`,
];

const CANVAS_COLUMN_MIGRATIONS = [
  `ALTER TABLE canvases ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE canvases ADD COLUMN owner_user_id TEXT`,
  `ALTER TABLE canvases ADD COLUMN project_id TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_url TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_status TEXT NOT NULL DEFAULT 'empty'`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_updated_at INTEGER`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_version TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_error_code TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_custom INTEGER`,
];

const POST_COLUMN_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_canvases_workspace ON canvases(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_workspace_updated ON canvases(workspace_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_owner ON canvases(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_project ON canvases(project_id)`,
];

const CANVAS_BACKFILL_SQL = [
  `UPDATE canvases
   SET thumbnail_url = COALESCE(thumbnail_url, thumbnail)
   WHERE thumbnail_url IS NULL AND thumbnail IS NOT NULL`,
  `UPDATE canvases
   SET thumbnail_status = CASE
     WHEN (thumbnail_url IS NOT NULL AND TRIM(thumbnail_url) != '') OR (thumbnail IS NOT NULL AND TRIM(thumbnail) != '') THEN 'ready'
     ELSE 'empty'
   END
   WHERE thumbnail_status IS NULL OR TRIM(thumbnail_status) = '' OR thumbnail_status = 'empty'`,
];

async function migrateLocal(dbPath: string) {
  console.log('📁 Using better-sqlite3 for local database\n');
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
    console.log(`📂 Creating directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Use better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(dbPath);
  
  try {
    console.log('📝 Creating tables...');
    
    for (const sql of SCHEMA_SQL_STATEMENTS) {
      db.exec(sql);
    }

    for (const sql of CANVAS_COLUMN_MIGRATIONS) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists (safe to ignore)
      }
    }

    for (const sql of POST_COLUMN_INDEX_SQL) {
      db.exec(sql);
    }

    for (const sql of CANVAS_BACKFILL_SQL) {
      db.exec(sql);
    }
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify tables exist
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canvases'").all();
    
    if (result.length > 0) {
      console.log('✅ Verified: canvases table exists');
    } else {
      console.error('❌ Error: canvases table was not created');
      process.exit(1);
    }
    
    // Count existing records
    const countResult = db.prepare('SELECT COUNT(*) as count FROM canvases').get() as { count: number };
    console.log(`📊 Current canvas count: ${countResult?.count ?? 0}\n`);
    
    console.log('🎉 Migration completed successfully!');
  } finally {
    db.close();
  }
}

async function migrateTurso(url: string, authToken?: string) {
  console.log('☁️  Using libsql client for Turso cloud\n');
  
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({ url, authToken });
  
  try {
    console.log('📝 Creating tables...');
    
    for (const sql of SCHEMA_SQL_STATEMENTS) {
      await client.execute(sql);
    }

    for (const sql of CANVAS_COLUMN_MIGRATIONS) {
      try {
        await client.execute(sql);
      } catch {
        // Column already exists (safe to ignore)
      }
    }

    for (const sql of POST_COLUMN_INDEX_SQL) {
      await client.execute(sql);
    }

    for (const sql of CANVAS_BACKFILL_SQL) {
      await client.execute(sql);
    }
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify tables exist
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canvases'"
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: canvases table exists');
    } else {
      console.error('❌ Error: canvases table was not created');
      process.exit(1);
    }
    
    // Count existing records
    const countResult = await client.execute('SELECT COUNT(*) as count FROM canvases');
    const count = countResult.rows[0]?.count ?? 0;
    console.log(`📊 Current canvas count: ${count}\n`);
    
    console.log('🎉 Migration completed successfully!');
  } finally {
    client.close();
  }
}

async function migrate() {
  console.log('🚀 Starting database migration...\n');
  
  const config = getDatabaseConfig();
  console.log(`📁 Database type: ${config.type}`);
  console.log(`📍 Location: ${config.path || config.url}\n`);
  
  try {
    if (config.isLocal && config.path) {
      await migrateLocal(config.path);
    } else {
      await migrateTurso(config.url, config.authToken);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
