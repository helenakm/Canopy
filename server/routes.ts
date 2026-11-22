import crypto from 'node:crypto';
import { Router, type NextFunction, type Response } from 'express';
import {
  projectSubscriptionView,
  setSessionCookie,
  updateSessionUser,
  type AuthenticatedRequest,
} from './auth.ts';
import {
  buildAuthorizedScope,
  recordSecurityDenial,
  type AuthorizedScope,
} from './authorizedRepo.ts';
import { dataStore } from './dataStore.ts';
import {
  formatVerifiedQueryAnswer,
  GeminiServiceError,
  generateExecutiveInsightBriefing,
  interpretQuestionToStructuredQuery,
} from './geminiService.ts';
import { generateDeterministicInsights } from './insightsEngine.ts';
import { validateAndExecuteStructuredQuery } from './queryEngine.ts';
import type {
  AuditLogEntry,
  BillingFrequency,
  CustomFieldDataType,
  FieldDefinition,
  StructuredQuery,
  SubscriptionCategory,
  SubscriptionRecord,
} from './types.ts';

interface AuthorizedRequest extends AuthenticatedRequest {
  authScope?: AuthorizedScope;
}

export const apiRouter = Router();

const REFERENCE_TODAY = '2026-11-21';

function computeMonthlyEquivalent(cost: number, frequency: BillingFrequency): number {
  if (frequency === 'annual') return Math.round((cost / 12) * 100) / 100;
  if (frequency === 'quarterly') return Math.round((cost / 3) * 100) / 100;
  return Math.round(cost * 100) / 100;
}

/**
 * Unified authorization middleware: enforces RBAC + record-level + field-level
 * projection before any database query, AI query, recommendation, report, or audit handler runs.
 */
async function attachAuthorizationScopeMiddleware(
  req: AuthorizedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    req.authScope = await buildAuthorizedScope(req.authUser);
    next();
  } catch (err) {
    next(err);
  }
}

// 1. Session & Simulated Demo Identity Switcher
apiRouter.get('/session', async (req: AuthorizedRequest, res) => {
  const users = await dataStore.getUsers();
  res.json({
    currentUser: req.authUser,
    demoUsers: users,
    sessionToken: req.authSignedToken,
    simulatedAuthNotice:
      'Simulated authentication for hackathon demonstration only. Production deployment requires verified enterprise SSO/OIDC and secure session management.',
  });
});

apiRouter.post('/session/switch', async (req: AuthorizedRequest, res) => {
  const { accountId } = req.body as { accountId?: string };
  if (!accountId || typeof accountId !== 'string') {
    res.status(400).json({ error: 'accountId is required.' });
    return;
  }

  const targetUser = await dataStore.getUserById(accountId);
  if (!targetUser) {
    res.status(404).json({ error: 'Requested demo account does not exist.' });
    return;
  }

  if (req.authSessionId) {
    updateSessionUser(req.authSessionId, targetUser.id);
  }
  if (req.authSignedToken) {
    setSessionCookie(res, req.authSignedToken);
  }

  await dataStore.appendAuditLog({
    id: `AUD-${crypto.randomInt(10000, 99999)}`,
    timestamp: new Date().toISOString(),
    userId: targetUser.id,
    userName: targetUser.name,
    role: targetUser.role,
    dealerId: targetUser.dealerId,
    customerId: targetUser.customerId,
    actionType: 'role_switch',
    summary:
      targetUser.role === 'customer'
        ? `Switched simulated session to ${targetUser.customerId ?? targetUser.id} (customer)`
        : `Switched simulated session to ${targetUser.name} (${targetUser.role})`,
    verificationStatus: 'recorded',
    authorizedSourceIds: [],
  });

  res.json({
    currentUser: targetUser,
    sessionToken: req.authSignedToken,
  });
});

// Apply unified RBAC + record-level + field-level scope middleware to all protected endpoints
apiRouter.use(attachAuthorizationScopeMiddleware);

// 2. Role-Scoped Metadata (Subscription Types, Dealers, Sanitized Customers, Plans)
apiRouter.get('/metadata', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  res.json({
    dealers: scope.dealers,
    customers: scope.customers,
    subscriptionTypes: scope.subscriptionTypes,
    plans: scope.plans,
  });
});

// 3. Overview Dashboard Aggregation (Strictly Role-Scoped via req.authScope)
apiRouter.get('/dashboard', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const { user, subscriptions: authSubs, serviceEvents: authEvents, usageRecords: authUsage, plans } = scope;

  const insights = generateDeterministicInsights(authSubs, authUsage, authEvents, plans);

  const activeCount = authSubs.length;
  const monthlyRecurringTotal =
    Math.round(authSubs.reduce((acc, s) => acc + s.monthlyEquivalentCost, 0) * 100) / 100;

  const upcomingRenewals = authSubs
    .filter((s) => {
      const diffMs =
        new Date(s.renewalDate + 'T00:00:00Z').getTime() -
        new Date(REFERENCE_TODAY + 'T00:00:00Z').getTime();
      const days = Math.round(diffMs / 86400000);
      return days >= 0 && days <= 90;
    })
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));

  const openFlags = authEvents.filter(
    (e) => e.eventType === 'service_flag' && !e.resolved,
  );

  const categoryBreakdown = [
    {
      category: 'hardware_maintenance',
      label: 'Hardware & Maintenance',
      count: authSubs.filter((s) => s.subscriptionType === 'hardware_maintenance').length,
      monthlySpend: Math.round(
        authSubs
          .filter((s) => s.subscriptionType === 'hardware_maintenance')
          .reduce((a, b) => a + b.monthlyEquivalentCost, 0),
      ),
    },
    {
      category: 'software_licence',
      label: 'Software Licences',
      count: authSubs.filter((s) => s.subscriptionType === 'software_licence').length,
      monthlySpend: Math.round(
        authSubs
          .filter((s) => s.subscriptionType === 'software_licence')
          .reduce((a, b) => a + b.monthlyEquivalentCost, 0),
      ),
    },
    {
      category: 'managed_it',
      label: 'Managed IT Services',
      count: authSubs.filter((s) => s.subscriptionType === 'managed_it').length,
      monthlySpend: Math.round(
        authSubs
          .filter((s) => s.subscriptionType === 'managed_it')
          .reduce((a, b) => a + b.monthlyEquivalentCost, 0),
      ),
    },
  ];

  const monthBuckets = new Map<string, { used: number; allowance: number }>();
  for (const u of authUsage) {
    if (u.unitLabel !== 'pages') continue;
    const prev = monthBuckets.get(u.billingMonth) || { used: 0, allowance: 0 };
    prev.used += u.unitsUsed;
    prev.allowance += u.includedAllowance;
    monthBuckets.set(u.billingMonth, prev);
  }
  const usageTrend = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month,
      used: vals.used,
      allowance: vals.allowance,
    }));

  const estimatedAnnualSavingsTotal = Math.round(
    insights
      .filter((i) => i.category === 'cost_optimization')
      .reduce((acc, i) => acc + (i.estimatedAnnualSavings || 0), 0),
  );

  const dealerPerformance =
    user.role === 'canon_admin'
      ? scope.dealers.map((d) => {
          const dSubs = authSubs.filter((s) => s.dealerId === d.id);
          const dFlags = authEvents.filter(
            (e) => e.dealerId === d.id && e.eventType === 'service_flag' && !e.resolved,
          ).length;
          return {
            dealerId: d.id,
            dealerName: d.name,
            region: d.region,
            partnerTier: d.partnerTier,
            subscriptionCount: dSubs.length,
            monthlyValue: Math.round(
              dSubs.reduce((acc, s) => acc + s.monthlyEquivalentCost, 0),
            ),
            openFlags: dFlags,
          };
        })
      : [];

  res.json({
    kpis: {
      activeSubscriptions: activeCount,
      monthlyRecurringTotal,
      upcomingRenewalsCount: upcomingRenewals.length,
      openServiceFlagsCount: openFlags.length,
      estimatedAnnualSavingsTotal,
    },
    categoryBreakdown,
    usageTrend,
    dealerPerformance,
    upcomingRenewals: upcomingRenewals.slice(0, 6),
    recentAlerts: openFlags.slice(0, 6),
    topInsights: insights.slice(0, 4),
    piiRestrictedForRole: user.role === 'canon_admin',
  });
});

// 4. Subscription Listing & Detail (Rejects Cross-Tenant Parameter Tampering)
apiRouter.get('/subscriptions', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const { user } = scope;
  const { type, status, dealerId, customerId, renewalWindow, search } = req.query as Record<
    string,
    string | undefined
  >;

  // Reject explicit cross-dealer or cross-customer parameter probing
  if (
    dealerId &&
    dealerId !== 'all' &&
    user.role !== 'canon_admin' &&
    (user.role === 'customer' || dealerId !== user.dealerId)
  ) {
    await recordSecurityDenial(
      user,
      `Cross-dealer parameter request rejected (requested dealerId=${dealerId})`,
      'GET /api/subscriptions',
    );
    res.status(403).json({
      error: `Access denied: ${user.role} identity cannot request records for dealer ${dealerId}.`,
    });
    return;
  }

  if (
    customerId &&
    customerId !== 'all' &&
    user.role === 'customer' &&
    customerId !== user.customerId
  ) {
    await recordSecurityDenial(
      user,
      `Cross-customer parameter request rejected (requested customerId=${customerId})`,
      'GET /api/subscriptions',
    );
    res.status(403).json({
      error: `Access denied: customer account ${user.customerId} cannot request records for customer ${customerId}.`,
    });
    return;
  }

  if (
    customerId &&
    customerId !== 'all' &&
    user.role === 'dealer' &&
    !scope.customers.some((c) => c.id === customerId)
  ) {
    await recordSecurityDenial(
      user,
      `Unauthorized customer parameter request rejected (requested customerId=${customerId})`,
      'GET /api/subscriptions',
    );
    res.status(403).json({
      error: `Access denied: customer ${customerId} does not belong to dealer ${user.dealerId}.`,
    });
    return;
  }

  let projected = scope.subscriptions;

  if (type && type !== 'all') {
    projected = projected.filter((s) => s.subscriptionType === type);
  }
  if (status && status !== 'all') {
    projected = projected.filter((s) => s.status === status);
  }
  if (dealerId && dealerId !== 'all' && user.role === 'canon_admin') {
    projected = projected.filter((s) => s.dealerId === dealerId);
  }
  if (customerId && customerId !== 'all') {
    projected = projected.filter((s) => s.customerId === customerId);
  }
  if (renewalWindow && renewalWindow !== 'all') {
    projected = projected.filter((s) => {
      const diffDays = Math.round(
        (new Date(s.renewalDate + 'T00:00:00Z').getTime() -
          new Date(REFERENCE_TODAY + 'T00:00:00Z').getTime()) /
          86400000,
      );
      if (renewalWindow === '30d') return diffDays >= 0 && diffDays <= 30;
      if (renewalWindow === '90d') return diffDays >= 0 && diffDays <= 90;
      if (renewalWindow === '2027') return s.renewalDate.startsWith('2027-');
      return true;
    });
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    projected = projected.filter((s) => {
      const hay = [
        s.id,
        s.product,
        s.customerDisplayLabel,
        s.customerId,
        s.dealerName,
        s.planName,
        ...Object.values(s.visibleCustomFields).map((v) => String(v ?? '')),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  res.json({ subscriptions: projected });
});

apiRouter.get('/subscriptions/:id', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const found = scope.subscriptions.find((s) => s.id === req.params.id);
  if (!found) {
    await recordSecurityDenial(
      scope.user,
      `Unauthorized subscription detail lookup (${req.params.id})`,
      `GET /api/subscriptions/${req.params.id}`,
    );
    res.status(403).json({
      error: 'Subscription not found or access denied for your current role.',
    });
    return;
  }

  const typeDef = scope.subscriptionTypes.find((t) => t.id === found.subscriptionType);
  const usageHistory = scope.usageRecords.filter((u) => u.subscriptionId === found.id);
  const serviceEvents = scope.serviceEvents.filter((e) => e.subscriptionId === found.id);
  const customer = scope.customers.find((c) => c.id === found.customerId);

  res.json({
    subscription: found,
    typeDefinition: typeDef,
    customer,
    usageHistory,
    serviceEvents,
  });
});

// 5. Subscription Creation (Dealer-Authorized Only; Ignores & Rejects Spoofed dealerId/role)
apiRouter.post('/subscriptions', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const { user } = scope;

  if (user.role !== 'dealer' || !user.dealerId) {
    await recordSecurityDenial(
      user,
      'Subscription creation attempted by non-dealer role',
      'POST /api/subscriptions',
    );
    res.status(403).json({
      error:
        'Only authorized Dealers can create new customer subscriptions. Canon Administrators govern metadata schemas, and Customers have read-only access.',
    });
    return;
  }

  const body = req.body as {
    dealerId?: string;
    role?: string;
    customerId?: string;
    planId?: string;
    product?: string;
    subscriptionType?: SubscriptionCategory;
    startDate?: string;
    renewalDate?: string;
    billingFrequency?: BillingFrequency;
    cost?: number;
    customFields?: Record<string, string | number | boolean | null>;
  };

  // Reject explicit dealerId spoofing attempts
  if (body.dealerId && body.dealerId !== user.dealerId) {
    await recordSecurityDenial(
      user,
      `Spoofed dealerId=${body.dealerId} rejected on subscription create`,
      'POST /api/subscriptions',
    );
    res.status(403).json({
      error: `Unauthorized dealerId "${body.dealerId}": dealers may only create subscriptions under ${user.dealerId}.`,
    });
    return;
  }

  if (
    !body.customerId ||
    !body.product ||
    !body.subscriptionType ||
    !body.startDate ||
    !body.renewalDate ||
    !body.billingFrequency ||
    body.cost === undefined
  ) {
    res.status(400).json({ error: 'Missing required common subscription fields.' });
    return;
  }

  // Enforce dealer ownership via req.authScope.customers (already filtered to user.dealerId!)
  const targetCustomer = scope.customers.find((c) => c.id === body.customerId);
  if (!targetCustomer) {
    await recordSecurityDenial(
      user,
      `Cross-dealer customerId=${body.customerId} rejected on subscription create`,
      'POST /api/subscriptions',
    );
    res.status(403).json({
      error:
        'Unauthorized customer selection: you may only create subscriptions for customers assigned to your dealership.',
    });
    return;
  }

  const typeDef = scope.subscriptionTypes.find((t) => t.id === body.subscriptionType);
  if (!typeDef) {
    res.status(400).json({ error: 'Invalid subscriptionType.' });
    return;
  }

  const incomingCustom = body.customFields || {};
  const cleanedCustom: Record<string, string | number | boolean | null> = {};

  for (const fieldDef of typeDef.fields) {
    if (fieldDef.conditionalHideWhen) {
      const refVal = incomingCustom[fieldDef.conditionalHideWhen.fieldKey];
      if (refVal === fieldDef.conditionalHideWhen.equalsValue) {
        continue;
      }
    }

    const val = incomingCustom[fieldDef.key];
    if (fieldDef.required && (val === undefined || val === null || val === '')) {
      res.status(400).json({
        error: `Required field "${fieldDef.label}" is missing.`,
      });
      return;
    }

    if (val !== undefined && val !== '') {
      cleanedCustom[fieldDef.key] = val;
    }
  }

  const numericCost = Number(body.cost);
  if (Number.isNaN(numericCost) || numericCost < 0) {
    res.status(400).json({ error: 'Cost must be a valid non-negative number.' });
    return;
  }

  const newSub: SubscriptionRecord = {
    id: `SUB-${crypto.randomInt(2000, 9999)}`,
    customerId: targetCustomer.id,
    dealerId: user.dealerId, // strictly from authenticated server session
    planId: body.planId || 'CUSTOM-PLAN',
    product: body.product.trim(),
    subscriptionType: body.subscriptionType,
    startDate: body.startDate,
    renewalDate: body.renewalDate,
    billingFrequency: body.billingFrequency,
    cost: numericCost,
    monthlyEquivalentCost: computeMonthlyEquivalent(numericCost, body.billingFrequency),
    status: 'active',
    legacySourceSystem: 'Canopy Unified Overlay',
    customFields: cleanedCustom,
    createdAt: new Date().toISOString(),
  };

  await dataStore.createSubscription(newSub);

  await dataStore.appendAuditLog({
    id: `AUD-${crypto.randomInt(10000, 99999)}`,
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    role: user.role,
    dealerId: user.dealerId,
    customerId: targetCustomer.id,
    actionType: 'subscription_create',
    summary: `Created ${newSub.subscriptionType} subscription ${newSub.id} (${newSub.product})`,
    verificationStatus: 'recorded',
    authorizedSourceIds: [newSub.id],
  });

  const allCustomers = await dataStore.getCustomers();

  res.status(201).json({
    subscription: projectSubscriptionView(
      user,
      newSub,
      scope.dealers,
      allCustomers,
      scope.plans,
      scope.subscriptionTypes,
    ),
  });
});

// 6. Custom Field Schema Builder (Canon Admin Only)
apiRouter.post('/schema/fields', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const { user } = scope;
  if (user.role !== 'canon_admin') {
    await recordSecurityDenial(
      user,
      'Schema modification attempted by non-admin role',
      'POST /api/schema/fields',
    );
    res.status(403).json({
      error: 'Only Canon Administrators can modify subscription type field schemas.',
    });
    return;
  }

  const body = req.body as {
    subscriptionType?: SubscriptionCategory;
    label?: string;
    dataType?: CustomFieldDataType;
    required?: boolean;
    options?: string[];
    unit?: string;
  };

  if (!body.subscriptionType || !body.label || !body.dataType) {
    res.status(400).json({ error: 'subscriptionType, label, and dataType are required.' });
    return;
  }

  const sanitizedKey = body.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');

  if (!sanitizedKey) {
    res.status(400).json({ error: 'Field label must contain alphanumeric characters.' });
    return;
  }

  const newField: FieldDefinition = {
    key: sanitizedKey,
    label: body.label.trim(),
    dataType: body.dataType,
    required: Boolean(body.required),
    options: body.dataType === 'select' ? body.options || ['Option A', 'Option B'] : undefined,
    unit: body.unit?.trim() || undefined,
    isSystem: false,
  };

  try {
    const updatedType = await dataStore.addCustomField(body.subscriptionType, newField);
    await dataStore.appendAuditLog({
      id: `AUD-${crypto.randomInt(10000, 99999)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      role: user.role,
      dealerId: null,
      customerId: null,
      actionType: 'schema_update',
      summary: `Added custom field "${newField.label}" (${newField.dataType}) to ${updatedType.name}`,
      verificationStatus: 'recorded',
      authorizedSourceIds: [],
    });
    res.status(201).json({ subscriptionType: updatedType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to add custom field.';
    res.status(400).json({ error: message });
  }
});

// 7. Proactive Intelligence (Strictly Scope-Filtered via req.authScope)
apiRouter.get('/insights', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const insights = generateDeterministicInsights(
    scope.subscriptions,
    scope.usageRecords,
    scope.serviceEvents,
    scope.plans,
  );

  const totalMonthlySavings =
    Math.round(
      insights
        .filter((i) => i.category === 'cost_optimization')
        .reduce((acc, i) => acc + (i.estimatedMonthlySavings || 0), 0) * 100,
    ) / 100;
  const totalAnnualSavings = Math.round(totalMonthlySavings * 12 * 100) / 100;

  res.json({
    insights,
    summary: {
      totalInsights: insights.length,
      requiresAttentionCount: insights.filter((i) => i.category === 'requires_attention').length,
      costOptimizationCount: insights.filter((i) => i.category === 'cost_optimization').length,
      growthOpportunityCount: insights.filter((i) => i.category === 'growth_opportunity').length,
      upcomingRenewalCount: insights.filter((i) => i.category === 'upcoming_renewal').length,
      totalMonthlySavings,
      totalAnnualSavings,
    },
  });
});

apiRouter.post('/insights/briefing', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  try {
    const insights = generateDeterministicInsights(
      scope.subscriptions,
      scope.usageRecords,
      scope.serviceEvents,
      scope.plans,
    );

    const briefing = await generateExecutiveInsightBriefing(scope.user, insights);

    await dataStore.appendAuditLog({
      id: `AUD-${crypto.randomInt(10000, 99999)}`,
      timestamp: new Date().toISOString(),
      userId: scope.user.id,
      userName: scope.user.name,
      role: scope.user.role,
      dealerId: scope.user.dealerId,
      customerId: scope.user.customerId,
      actionType: 'insight_summary',
      summary: `Generated Gemini executive briefing across ${insights.length} authorized proactive insights`,
      verificationStatus: 'verified',
      authorizedSourceIds: Array.from(new Set(insights.map((i) => i.subscriptionId))),
    });

    res.json({ briefing });
  } catch (err) {
    const status = err instanceof GeminiServiceError ? err.statusCode : 502;
    const msg = err instanceof Error ? err.message : 'Unable to generate AI briefing.';
    res.status(status).json({ error: msg });
  }
});

// 8. Deterministic Executive Reports Engine (Calculates directly from authorized scope without Gemini)
apiRouter.post('/reports/query', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const { user } = scope;
  const { query } = req.body as { query?: StructuredQuery };

  if (!query || !query.targetEntity || !query.operation) {
    res.status(400).json({ error: 'A valid structured query specification is required.' });
    return;
  }

  const dynamicFieldKeys = new Set(
    scope.subscriptionTypes.flatMap((t) => t.fields.map((f) => f.key)),
  );

  const outcome = validateAndExecuteStructuredQuery(
    user,
    query,
    scope.subscriptions,
    scope.serviceEvents,
    scope.usageRecords,
    dynamicFieldKeys,
  );

  const verifiedAt = new Date().toISOString();
  const auditLogId = `AUD-${crypto.randomInt(10000, 99999)}`;
  const status = outcome.verified ? 'verified' : outcome.restricted ? 'restricted' : 'withheld';

  await dataStore.appendAuditLog({
    id: auditLogId,
    timestamp: verifiedAt,
    userId: user.id,
    userName: user.name,
    role: user.role,
    dealerId: user.dealerId,
    customerId: user.customerId,
    actionType: 'ai_query',
    summary: `Executed report: ${query.intentSummary || outcome.calculationPerformed}`,
    verificationStatus: status,
    authorizedSourceIds: outcome.authorizedSourceIds,
    appliedFilters: outcome.appliedFilters,
    calculationPerformed: outcome.calculationPerformed,
  });

  res.json({
    outcome,
    evidence: {
      verificationStatus: status,
      authorizedSourceIds: outcome.authorizedSourceIds,
      appliedFilters: outcome.appliedFilters,
      calculationPerformed: outcome.calculationPerformed,
      verifiedAt,
      auditLogId,
      matchedRecordCount: outcome.matchedRecordCount,
      computedResult: outcome.computedResult,
      restrictionNotice: outcome.restrictionNotice,
    },
    matchedRecords: outcome.matchedSummaries,
  });
});

// 9. Verified AI Intelligence Assistant (Never receives unrestricted DB or honors prompt role overrides)
apiRouter.post('/ai/query', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  const { user } = scope;
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'A natural-language question is required.' });
    return;
  }

  const trimmedQuestion = question.trim();

  try {
    const dynamicFieldKeys = new Set(
      scope.subscriptionTypes.flatMap((t) => t.fields.map((f) => f.key)),
    );

    // Step 1: Gemini receives ONLY authorized schema & role-filtered customer context
    const structuredQuery = await interpretQuestionToStructuredQuery(
      trimmedQuestion,
      user,
      scope.subscriptionTypes,
      scope.customers,
    );

    // Step 2: Server-side validation & deterministic execution on req.authScope ONLY
    const outcome = validateAndExecuteStructuredQuery(
      user,
      structuredQuery,
      scope.subscriptions,
      scope.serviceEvents,
      scope.usageRecords,
      dynamicFieldKeys,
    );

    const verifiedAt = new Date().toISOString();
    const auditLogId = `AUD-${crypto.randomInt(10000, 99999)}`;

    if (!outcome.verified) {
      const status = outcome.restricted ? 'restricted' : 'withheld';
      const notice =
        outcome.restrictionNotice ||
        'This query could not be verified against authorized records and was withheld.';

      const auditEntry: AuditLogEntry = {
        id: auditLogId,
        timestamp: verifiedAt,
        userId: user.id,
        userName: user.name,
        role: user.role,
        dealerId: user.dealerId,
        customerId: user.customerId,
        actionType: 'ai_query',
        summary: `Blocked or withheld query: "${trimmedQuestion.slice(0, 80)}"`,
        queryText: trimmedQuestion,
        verificationStatus: status,
        authorizedSourceIds: [],
        appliedFilters: outcome.appliedFilters,
        calculationPerformed: outcome.calculationPerformed,
      };
      await dataStore.appendAuditLog(auditEntry);

      res.json({
        answer: notice,
        evidence: {
          verificationStatus: status,
          authorizedSourceIds: [],
          appliedFilters: outcome.appliedFilters,
          calculationPerformed: outcome.calculationPerformed,
          verifiedAt,
          auditLogId,
          matchedRecordCount: 0,
          computedResult: null,
          restrictionNotice: notice,
        },
        matchedRecords: [],
      });
      return;
    }

    const answer = formatVerifiedQueryAnswer(
      trimmedQuestion,
      user,
      structuredQuery,
      outcome,
    );

    const auditEntry: AuditLogEntry = {
      id: auditLogId,
      timestamp: verifiedAt,
      userId: user.id,
      userName: user.name,
      role: user.role,
      dealerId: user.dealerId,
      customerId: user.customerId,
      actionType: 'ai_query',
      summary: `${structuredQuery.intentSummary} → ${outcome.calculationPerformed}`,
      queryText: trimmedQuestion,
      verificationStatus: 'verified',
      authorizedSourceIds: outcome.authorizedSourceIds,
      appliedFilters: outcome.appliedFilters,
      calculationPerformed: outcome.calculationPerformed,
    };
    await dataStore.appendAuditLog(auditEntry);

    res.json({
      answer,
      evidence: {
        verificationStatus: 'verified',
        authorizedSourceIds: outcome.authorizedSourceIds,
        appliedFilters: outcome.appliedFilters,
        calculationPerformed: outcome.calculationPerformed,
        verifiedAt,
        auditLogId,
        matchedRecordCount: outcome.matchedRecordCount,
        computedResult: outcome.computedResult,
      },
      matchedRecords: outcome.matchedSummaries,
    });
  } catch (err) {
    const status = err instanceof GeminiServiceError ? err.statusCode : 502;
    const message = err instanceof Error ? err.message : 'AI query processing failed.';
    res.status(status).json({ error: message });
  }
});

// 9. Audit & Verification Ledger (Strictly Role-Scoped via req.authScope)
apiRouter.get('/audit', async (req: AuthorizedRequest, res) => {
  const scope = req.authScope!;
  res.json({ auditLogs: scope.auditLogs });
});
