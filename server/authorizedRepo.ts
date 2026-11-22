import crypto from 'node:crypto';
import {
  getAuthorizedAuditLogs,
  getAuthorizedCustomers,
  getAuthorizedServiceEvents,
  getAuthorizedSubscriptions,
  getAuthorizedUsageRecords,
  projectSubscriptionView,
} from './auth.ts';
import { dataStore } from './dataStore.ts';
import type {
  AuditLogEntry,
  Dealer,
  DemoUser,
  SanitizedCustomer,
  SanitizedSubscriptionView,
  ServiceEvent,
  SubscriptionPlan,
  SubscriptionTypeDefinition,
  UsageRecord,
} from './types.ts';

export interface AuthorizedScope {
  user: DemoUser;
  dealers: Dealer[];
  customers: SanitizedCustomer[];
  subscriptions: SanitizedSubscriptionView[];
  usageRecords: UsageRecord[];
  serviceEvents: ServiceEvent[];
  auditLogs: AuditLogEntry[];
  subscriptionTypes: SubscriptionTypeDefinition[];
  plans: SubscriptionPlan[];
}

/**
 * Single centralized authorization gateway.
 * Every route, query engine, insights engine, report, and AI service
 * must obtain its data exclusively from this scope.
 */
export async function buildAuthorizedScope(user: DemoUser): Promise<AuthorizedScope> {
  if (!user.id || !user.role) {
    throw new Error('Authenticated user identity is missing required userId or role.');
  }
  if (user.role === 'dealer' && !user.dealerId) {
    throw new Error('Dealer user is missing required dealerId.');
  }
  if (user.role === 'customer' && !user.customerId) {
    throw new Error('Customer user is missing required customerId.');
  }

  const [
    allDealers,
    allCustomers,
    allSubscriptions,
    allUsage,
    allEvents,
    allAuditLogs,
    subscriptionTypes,
    plans,
  ] = await Promise.all([
    dataStore.getDealers(),
    dataStore.getCustomers(),
    dataStore.getSubscriptions(),
    dataStore.getUsageRecords(),
    dataStore.getServiceEvents(),
    dataStore.getAuditLogs(),
    dataStore.getSubscriptionTypes(),
    dataStore.getPlans(),
  ]);

  // 1. Record-level & field-level customer PII projection
  const customers = getAuthorizedCustomers(user, allCustomers);

  // 2. Record-level dealer visibility
  const rawAuthorizedSubs = getAuthorizedSubscriptions(user, allSubscriptions);
  const dealers =
    user.role === 'canon_admin'
      ? allDealers
      : user.role === 'dealer'
        ? allDealers.filter((d) => d.id === user.dealerId)
        : allDealers.filter((d) => rawAuthorizedSubs.some((s) => s.dealerId === d.id));

  // 3. Record-level subscription filtering + PII/conditional field projection
  const subscriptions = rawAuthorizedSubs.map((s) =>
    projectSubscriptionView(user, s, allDealers, allCustomers, plans, subscriptionTypes),
  );

  // 4. Record-level usage, service events, and audit logs
  const usageRecords = getAuthorizedUsageRecords(user, allUsage);
  const serviceEvents = getAuthorizedServiceEvents(user, allEvents);
  const auditLogs = getAuthorizedAuditLogs(user, allAuditLogs);

  return {
    user,
    dealers,
    customers,
    subscriptions,
    usageRecords,
    serviceEvents,
    auditLogs,
    subscriptionTypes,
    plans,
  };
}

export async function recordSecurityDenial(
  user: DemoUser,
  reason: string,
  attemptedResource?: string,
): Promise<void> {
  await dataStore.appendAuditLog({
    id: `AUD-${crypto.randomInt(10000, 99999)}`,
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    role: user.role,
    dealerId: user.dealerId,
    customerId: user.customerId,
    actionType: 'ai_query',
    summary: `Blocked unauthorized access attempt: ${reason}${attemptedResource ? ` (${attemptedResource})` : ''}`,
    verificationStatus: 'restricted',
    authorizedSourceIds: [],
    appliedFilters: [`enforced_role = ${user.role}`],
    calculationPerformed: 'Access denied by RBAC middleware',
  });
}
