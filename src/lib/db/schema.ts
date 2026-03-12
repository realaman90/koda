import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Users synced from Clerk webhooks.
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    imageUrl: text('image_url'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    clerkUserIdUnique: uniqueIndex('users_clerk_user_id_unique').on(table.clerkUserId),
    clerkUserIdIdx: index('idx_users_clerk_user_id').on(table.clerkUserId),
    emailIdx: index('idx_users_email').on(table.email),
  })
);

export type NewUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug'),
    type: text('type').notNull().default('personal'), // personal | team
    ownerUserId: text('owner_user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('workspaces_slug_unique').on(table.slug),
    ownerIdx: index('idx_workspaces_owner').on(table.ownerUserId),
    typeIdx: index('idx_workspaces_type').on(table.type),
  })
);

export type NewWorkspace = typeof workspaces.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('viewer'), // owner | admin | editor | viewer
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex('workspace_members_workspace_user_unique').on(
      table.workspaceId,
      table.userId
    ),
    workspaceRoleIdx: index('idx_workspace_members_workspace_role').on(table.workspaceId, table.role),
    userIdx: index('idx_workspace_members_user').on(table.userId),
  })
);

export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;

export const workspaceInvites = sqliteTable(
  'workspace_invites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    status: text('status').notNull().default('pending'), // pending | accepted | declined | revoked | expired
    token: text('token').notNull(),
    invitedByUserId: text('invited_by_user_id').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('workspace_invites_token_unique').on(table.token),
    workspaceEmailStatusIdx: index('idx_workspace_invites_workspace_email_status').on(
      table.workspaceId,
      table.email,
      table.status
    ),
    workspaceStatusIdx: index('idx_workspace_invites_workspace_status').on(table.workspaceId, table.status),
    emailStatusIdx: index('idx_workspace_invites_email_status').on(table.email, table.status),
  })
);

export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    ownerUserId: text('owner_user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceIdx: index('idx_projects_workspace').on(table.workspaceId),
    ownerIdx: index('idx_projects_owner').on(table.ownerUserId),
  })
);

export type NewProject = typeof projects.$inferInsert;
export type Project = typeof projects.$inferSelect;

/**
 * Canvases table - stores canvas metadata and JSON blobs for nodes/edges
 *
 * Using JSON blob storage for nodes/edges:
 * - Simpler schema, no migrations when node types change
 * - Single query loads entire canvas
 * - Direct compatibility with localStorage format
 */
export const canvases = sqliteTable(
  'canvases',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    ownerUserId: text('owner_user_id'),
    projectId: text('project_id'),
    name: text('name').notNull(),
    // JSON blobs for nodes and edges (stored as text)
    nodes: text('nodes'),
    edges: text('edges'),
    // Optional thumbnail (legacy)
    thumbnail: text('thumbnail'),
    // Canonical preview lifecycle metadata
    thumbnailUrl: text('thumbnail_url'),
    thumbnailStatus: text('thumbnail_status').notNull().default('empty'),
    thumbnailUpdatedAt: integer('thumbnail_updated_at', { mode: 'timestamp_ms' }),
    thumbnailVersion: text('thumbnail_version'),
    thumbnailErrorCode: text('thumbnail_error_code'),
    thumbnailCustom: integer('thumbnail_custom', { mode: 'boolean' }),
    // Timestamps stored as Unix milliseconds
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceIdx: index('idx_canvases_workspace').on(table.workspaceId),
    workspaceUpdatedIdx: index('idx_canvases_workspace_updated').on(table.workspaceId, table.updatedAt),
    ownerIdx: index('idx_canvases_owner').on(table.ownerUserId),
    projectIdx: index('idx_canvases_project').on(table.projectId),
  })
);

// Type for inserting a new canvas
export type NewCanvas = typeof canvases.$inferInsert;

// Type for selecting a canvas
export type Canvas = typeof canvases.$inferSelect;

export const canvasShares = sqliteTable(
  'canvas_shares',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    canvasId: text('canvas_id').notNull(),
    granteeType: text('grantee_type').notNull().default('user'), // user | link
    granteeId: text('grantee_id').notNull(),
    permission: text('permission').notNull().default('view'), // view | edit
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    canvasGranteeUnique: uniqueIndex('canvas_shares_canvas_grantee_unique').on(
      table.canvasId,
      table.granteeType,
      table.granteeId
    ),
    workspaceIdx: index('idx_canvas_shares_workspace').on(table.workspaceId),
    canvasIdx: index('idx_canvas_shares_canvas').on(table.canvasId),
  })
);

export type NewCanvasShare = typeof canvasShares.$inferInsert;
export type CanvasShare = typeof canvasShares.$inferSelect;

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceCreatedIdx: index('idx_audit_logs_workspace_created').on(table.workspaceId, table.createdAt),
    actorIdx: index('idx_audit_logs_actor').on(table.actorUserId),
    targetIdx: index('idx_audit_logs_target').on(table.targetType, table.targetId),
    actionIdx: index('idx_audit_logs_action').on(table.action),
  })
);

export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============================================
// ANIMATION TABLES
// ============================================

/**
 * Animation projects — one row per animation node.
 * Tracks the active sandbox, engine, plan, and current version.
 */
export const animationProjects = sqliteTable('animation_projects', {
  id: text('id').primaryKey(), // nodeId
  canvasId: text('canvas_id'),
  engine: text('engine'), // 'remotion' | 'theatre'
  plan: text('plan'), // JSON blob of AnimationPlan
  activeVersionId: text('active_version_id'),
  sandboxId: text('sandbox_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type NewAnimationProject = typeof animationProjects.$inferInsert;
export type AnimationProject = typeof animationProjects.$inferSelect;

/**
 * Animation versions — one row per rendered version.
 * Tracks video URL, snapshot key, prompt, and metadata.
 */
export const animationVersions = sqliteTable('animation_versions', {
  id: text('id').primaryKey(), // versionId (e.g. v1738000000000)
  projectId: text('project_id').notNull(), // FK → animation_projects.id
  videoUrl: text('video_url'),
  snapshotKey: text('snapshot_key'), // R2/local key for restoring code
  thumbnailUrl: text('thumbnail_url'),
  prompt: text('prompt'),
  duration: integer('duration'), // seconds
  sizeBytes: integer('size_bytes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type NewAnimationVersion = typeof animationVersions.$inferInsert;
export type AnimationVersion = typeof animationVersions.$inferSelect;

// ============================================
// CREDIT TABLES
// ============================================

/**
 * Credit balances — one row per user.
 * Tracks current balance, plan, and billing period.
 */
export const creditBalances = sqliteTable(
  'credit_balances',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    balance: integer('balance').notNull().default(0),
    planKey: text('plan_key').notNull().default('free_user'),
    creditsPerMonth: integer('credits_per_month').notNull().default(30),
    periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
    lifetimeUsed: integer('lifetime_used').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdUnique: uniqueIndex('credit_balances_user_id_unique').on(table.userId),
    userIdx: index('idx_credit_balances_user').on(table.userId),
  })
);

export type NewCreditBalance = typeof creditBalances.$inferInsert;
export type CreditBalance = typeof creditBalances.$inferSelect;

/**
 * Credit transactions — audit log of all credit changes.
 * Positive amount = credit added, negative = deducted.
 */
export const creditTransactions = sqliteTable(
  'credit_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    amount: integer('amount').notNull(), // positive = add, negative = deduct
    balanceAfter: integer('balance_after').notNull(),
    type: text('type').notNull(), // 'deduction' | 'refund' | 'topup' | 'reset'
    reason: text('reason').notNull(), // e.g. 'image:flux-schnell', 'video:veo-3'
    metadata: text('metadata'), // JSON blob
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_credit_transactions_user_created').on(table.userId, table.createdAt),
    typeIdx: index('idx_credit_transactions_type').on(table.type),
  })
);

export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

// ============================================
// BILLING TABLES
// ============================================

export const billingAccounts = sqliteTable(
  'billing_accounts',
  {
    id: text('id').primaryKey(),
    ownerType: text('owner_type').notNull().default('workspace'),
    ownerId: text('owner_id').notNull(),
    clerkCustomerId: text('clerk_customer_id'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    ownerUnique: uniqueIndex('billing_accounts_owner_unique').on(table.ownerType, table.ownerId),
    clerkCustomerIdx: index('idx_billing_accounts_clerk_customer').on(table.clerkCustomerId),
    stripeCustomerIdx: index('idx_billing_accounts_stripe_customer').on(table.stripeCustomerId),
  })
);

export type NewBillingAccount = typeof billingAccounts.$inferInsert;
export type BillingAccount = typeof billingAccounts.$inferSelect;

export const plans = sqliteTable(
  'plans',
  {
    id: text('id').primaryKey(),
    planCode: text('plan_code').notNull(),
    displayName: text('display_name').notNull(),
    billingInterval: text('billing_interval').notNull().default('month'),
    priceMinor: integer('price_minor').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    monthlyCredits: integer('monthly_credits').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    planCodeUnique: uniqueIndex('plans_plan_code_unique').on(table.planCode),
  })
);

export type NewPlan = typeof plans.$inferInsert;
export type Plan = typeof plans.$inferSelect;

export const entitlementPolicies = sqliteTable(
  'entitlement_policies',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').notNull(),
    version: integer('version').notNull(),
    effectiveFrom: integer('effective_from', { mode: 'timestamp_ms' }).notNull(),
    effectiveTo: integer('effective_to', { mode: 'timestamp_ms' }),
    policyJson: text('policy_json').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    planVersionUnique: uniqueIndex('entitlement_policies_plan_version_unique').on(table.planId, table.version),
  })
);

export type NewEntitlementPolicy = typeof entitlementPolicies.$inferInsert;
export type EntitlementPolicy = typeof entitlementPolicies.$inferSelect;

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    billingAccountId: text('billing_account_id').notNull(),
    planId: text('plan_id').notNull(),
    authority: text('authority').notNull().default('clerk'),
    authoritySubscriptionId: text('authority_subscription_id').notNull(),
    status: text('status').notNull().default('active'),
    currentPeriodStart: integer('current_period_start', { mode: 'timestamp_ms' }).notNull(),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }).notNull(),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    authorityRefUnique: uniqueIndex('subscriptions_authority_ref_unique').on(
      table.authority,
      table.authoritySubscriptionId
    ),
    accountStatusIdx: index('idx_subscriptions_account_status').on(table.billingAccountId, table.status),
  })
);

export type NewSubscription = typeof subscriptions.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;

export const subscriptionCycleGrants = sqliteTable(
  'subscription_cycle_grants',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').notNull(),
    cycleStart: integer('cycle_start', { mode: 'timestamp_ms' }).notNull(),
    cycleEnd: integer('cycle_end', { mode: 'timestamp_ms' }).notNull(),
    grantedCredits: integer('granted_credits').notNull(),
    grantLedgerTxnId: text('grant_ledger_txn_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    cycleUnique: uniqueIndex('subscription_cycle_grants_cycle_unique').on(
      table.subscriptionId,
      table.cycleStart,
      table.cycleEnd
    ),
  })
);

export type NewSubscriptionCycleGrant = typeof subscriptionCycleGrants.$inferInsert;
export type SubscriptionCycleGrant = typeof subscriptionCycleGrants.$inferSelect;

export const billingInvoices = sqliteTable(
  'billing_invoices',
  {
    id: text('id').primaryKey(),
    authority: text('authority').notNull(),
    authorityInvoiceId: text('authority_invoice_id').notNull(),
    billingAccountId: text('billing_account_id').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    invoiceDate: integer('invoice_date', { mode: 'timestamp_ms' }).notNull(),
    receiptUrl: text('receipt_url'),
    payloadJson: text('payload_json').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    authorityInvoiceUnique: uniqueIndex('billing_invoices_authority_invoice_unique').on(
      table.authority,
      table.authorityInvoiceId
    ),
    accountDateIdx: index('idx_billing_invoices_account_date').on(table.billingAccountId, table.invoiceDate),
  })
);

export type NewBillingInvoice = typeof billingInvoices.$inferInsert;
export type BillingInvoice = typeof billingInvoices.$inferSelect;

export const externalBillingEvents = sqliteTable(
  'external_billing_events',
  {
    id: text('id').primaryKey(),
    authority: text('authority').notNull(),
    authorityEventId: text('authority_event_id').notNull(),
    eventType: text('event_type').notNull(),
    billingAccountId: text('billing_account_id'),
    payloadHash: text('payload_hash').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status').notNull().default('received'),
    errorCode: text('error_code'),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
    processedAt: integer('processed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    authorityEventUnique: uniqueIndex('external_billing_events_authority_event_unique').on(
      table.authority,
      table.authorityEventId
    ),
  })
);

export type NewExternalBillingEvent = typeof externalBillingEvents.$inferInsert;
export type ExternalBillingEvent = typeof externalBillingEvents.$inferSelect;

export const billingAdminAuditLogs = sqliteTable(
  'billing_admin_audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action').notNull(),
    workspaceId: text('workspace_id'),
    requestId: text('request_id'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    actionIdx: index('idx_billing_admin_audit_action').on(table.action),
    createdIdx: index('idx_billing_admin_audit_created').on(table.createdAt),
  })
);

export type NewBillingAdminAuditLog = typeof billingAdminAuditLogs.$inferInsert;
export type BillingAdminAuditLog = typeof billingAdminAuditLogs.$inferSelect;

// ============================================
// BILLING LEDGER TABLES
// ============================================

export const pricingVersions = sqliteTable(
  'pricing_versions',
  {
    id: text('id').primaryKey(),
    versionCode: text('version_code').notNull(),
    status: text('status').notNull().default('draft'),
    effectiveFrom: integer('effective_from', { mode: 'timestamp_ms' }).notNull(),
    effectiveTo: integer('effective_to', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    versionCodeUnique: uniqueIndex('pricing_versions_version_code_unique').on(table.versionCode),
  })
);

export type NewPricingVersion = typeof pricingVersions.$inferInsert;
export type PricingVersion = typeof pricingVersions.$inferSelect;

export const costRules = sqliteTable('cost_rules', {
  id: text('id').primaryKey(),
  pricingVersionId: text('pricing_version_id').notNull(),
  provider: text('provider').notNull(),
  operationType: text('operation_type').notNull(),
  modelRef: text('model_ref').notNull(),
  ruleJson: text('rule_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type NewCostRule = typeof costRules.$inferInsert;
export type CostRule = typeof costRules.$inferSelect;

export const creditBuckets = sqliteTable('credit_buckets', {
  id: text('id').primaryKey(),
  billingAccountId: text('billing_account_id').notNull(),
  bucketType: text('bucket_type').notNull(),
  label: text('label'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type NewCreditBucket = typeof creditBuckets.$inferInsert;
export type CreditBucket = typeof creditBuckets.$inferSelect;

export const creditLedgerEntries = sqliteTable(
  'credit_ledger_entries',
  {
    id: text('id').primaryKey(),
    billingAccountId: text('billing_account_id').notNull(),
    bucketId: text('bucket_id'),
    txnType: text('txn_type').notNull(),
    amountCredits: integer('amount_credits').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    requestId: text('request_id'),
    reasonCode: text('reason_code'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex('credit_ledger_entries_idempotency_unique').on(
      table.idempotencyKey,
      table.referenceType,
      table.referenceId
    ),
    accountOccurredIdx: index('idx_credit_ledger_entries_account_occurred').on(
      table.billingAccountId,
      table.occurredAt
    ),
  })
);

export type NewCreditLedgerEntry = typeof creditLedgerEntries.$inferInsert;
export type CreditLedgerEntry = typeof creditLedgerEntries.$inferSelect;

export const creditReservations = sqliteTable(
  'credit_reservations',
  {
    id: text('id').primaryKey(),
    billingAccountId: text('billing_account_id').notNull(),
    jobId: text('job_id').notNull(),
    pricingVersionId: text('pricing_version_id').notNull(),
    reservedCredits: integer('reserved_credits').notNull(),
    capturedCredits: integer('captured_credits').notNull().default(0),
    releasedCredits: integer('released_credits').notNull().default(0),
    status: text('status').notNull().default('active'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    jobUnique: uniqueIndex('credit_reservations_job_unique').on(table.jobId),
  })
);

export type NewCreditReservation = typeof creditReservations.$inferInsert;
export type CreditReservation = typeof creditReservations.$inferSelect;

export const asyncCreditSettlements = sqliteTable(
  'async_credit_settlements',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    externalTaskId: text('external_task_id').notNull(),
    billingAccountId: text('billing_account_id').notNull(),
    reservationJobId: text('reservation_job_id').notNull(),
    idempotencyKeyPrefix: text('idempotency_key_prefix').notNull(),
    estimatedCredits: integer('estimated_credits').notNull(),
    status: text('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    settledAt: integer('settled_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    providerTaskUnique: uniqueIndex('async_credit_settlements_provider_task_unique').on(
      table.provider,
      table.externalTaskId
    ),
    statusExpiresIdx: index('idx_async_credit_settlements_status_expires').on(table.status, table.expiresAt),
  })
);

export type NewAsyncCreditSettlement = typeof asyncCreditSettlements.$inferInsert;
export type AsyncCreditSettlement = typeof asyncCreditSettlements.$inferSelect;

// ============================================
// RECONCILIATION TABLES
// ============================================

export const reconciliationRuns = sqliteTable('reconciliation_runs', {
  id: text('id').primaryKey(),
  jobName: text('job_name').notNull(),
  windowStart: integer('window_start', { mode: 'timestamp_ms' }).notNull(),
  windowEnd: integer('window_end', { mode: 'timestamp_ms' }).notNull(),
  status: text('status').notNull(),
  mismatchCount: integer('mismatch_count').notNull().default(0),
  repairCount: integer('repair_count').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
});

export type NewReconciliationRun = typeof reconciliationRuns.$inferInsert;
export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;

export const reconciliationItems = sqliteTable(
  'reconciliation_items',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    itemKey: text('item_key').notNull(),
    severity: text('severity').notNull(),
    category: text('category').notNull(),
    detailsJson: text('details_json').notNull(),
    repairAction: text('repair_action'),
    repairStatus: text('repair_status'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    runItemUnique: uniqueIndex('reconciliation_items_run_item_unique').on(table.runId, table.itemKey),
  })
);

export type NewReconciliationItem = typeof reconciliationItems.$inferInsert;
export type ReconciliationItem = typeof reconciliationItems.$inferSelect;
