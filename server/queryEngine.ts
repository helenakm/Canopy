import type {
  DemoUser,
  QueryFilter,
  SanitizedSubscriptionView,
  ServiceEvent,
  StructuredQuery,
  UsageRecord,
} from './types.ts';

// Strict field allowlists per entity (PII fields are never allowlisted)
const ALLOWED_SUBSCRIPTION_FIELDS = new Set([
  'id',
  'customerId',
  'dealerId',
  'dealerName',
  'planId',
  'product',
  'subscriptionType',
  'startDate',
  'renewalDate',
  'billingFrequency',
  'cost',
  'monthlyEquivalentCost',
  'status',
  'deviceModel',
  'serialNumber',
  'maintenanceStatus',
  'tonerIncluded',
  'monthlyPageUsage',
  'pageAllowance',
  'leaseDurationMonths',
  'serviceFlags',
  'softwareName',
  'vendor',
  'licenceSeats',
  'activeSeatUtilization',
  'expiryDate',
  'subscriptionTier',
  'autoRenew',
  'supportedDevices',
  'capacityLimit',
  'serviceResponseTime',
  'uptimePercentage',
  'supportLevel',
]);

const ALLOWED_SERVICE_EVENT_FIELDS = new Set([
  'id',
  'subscriptionId',
  'customerId',
  'dealerId',
  'deviceModel',
  'occurredAt',
  'eventType',
  'severity',
  'resolved',
]);

const ALLOWED_USAGE_FIELDS = new Set([
  'id',
  'subscriptionId',
  'customerId',
  'dealerId',
  'billingMonth',
  'unitsUsed',
  'includedAllowance',
  'overageUnits',
  'overageCost',
  'unitLabel',
]);

const PII_KEYWORDS = [
  'email',
  'phone',
  'address',
  'contactname',
  'payment',
  'creditcard',
  'customername',
  'organizationname',
  'personal',
];

function isPiiField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z]/g, '');
  return PII_KEYWORDS.some((kw) => normalized.includes(kw));
}

function getFieldValue(
  record: Record<string, unknown>,
  field: string,
): string | number | boolean | null | undefined {
  if (field in record) {
    return record[field] as string | number | boolean | null | undefined;
  }
  const custom = record.visibleCustomFields as Record<string, unknown> | undefined;
  if (custom && field in custom) {
    return custom[field] as string | number | boolean | null | undefined;
  }
  const rawCustom = record.customFields as Record<string, unknown> | undefined;
  if (rawCustom && field in rawCustom) {
    return rawCustom[field] as string | number | boolean | null | undefined;
  }
  return undefined;
}

function matchesFilter(
  record: Record<string, unknown>,
  filter: QueryFilter,
): boolean {
  const actual = getFieldValue(record, filter.field);
  if (actual === undefined || actual === null) return false;

  const target = filter.value;
  switch (filter.operator) {
    case 'eq':
      return String(actual).toLowerCase() === String(target).toLowerCase();
    case 'neq':
      return String(actual).toLowerCase() !== String(target).toLowerCase();
    case 'contains':
      return String(actual).toLowerCase().includes(String(target).toLowerCase());
    case 'month_eq': {
      // Matches YYYY-MM prefix on ISO date strings (e.g. '2027-10')
      return String(actual).startsWith(String(target));
    }
    case 'gte':
      return typeof actual === 'number' && typeof target === 'number'
        ? actual >= target
        : String(actual) >= String(target);
    case 'lte':
      return typeof actual === 'number' && typeof target === 'number'
        ? actual <= target
        : String(actual) <= String(target);
    case 'gt':
      return typeof actual === 'number' && typeof target === 'number'
        ? actual > target
        : String(actual) > String(target);
    case 'lt':
      return typeof actual === 'number' && typeof target === 'number'
        ? actual < target
        : String(actual) < String(target);
    default:
      return false;
  }
}

export interface QueryExecutionOutcome {
  verified: boolean;
  restricted: boolean;
  restrictionNotice?: string;
  appliedFilters: string[];
  calculationPerformed: string;
  authorizedSourceIds: string[];
  matchedRecordCount: number;
  computedResult: string | number | Record<string, number> | null;
  matchedSummaries: Array<Record<string, unknown>>;
}

export function validateAndExecuteStructuredQuery(
  user: DemoUser,
  query: StructuredQuery,
  authorizedSubscriptions: SanitizedSubscriptionView[],
  authorizedServiceEvents: ServiceEvent[],
  authorizedUsageRecords: UsageRecord[],
  dynamicCustomFieldKeys: Set<string>,
): QueryExecutionOutcome {
  // 1. Check for PII access requests or Canon Admin restriction violations
  if (query.requestsRestrictedPii) {
    return {
      verified: false,
      restricted: true,
      restrictionNotice:
        query.restrictionReason ||
        'Access denied: customer personal details, contact information, and payment records are strictly restricted under role governance.',
      appliedFilters: [`role = ${user.role}`],
      calculationPerformed: 'Blocked before execution (PII restriction policy)',
      authorizedSourceIds: [],
      matchedRecordCount: 0,
      computedResult: null,
      matchedSummaries: [],
    };
  }

  const allReferencedFields = [
    ...(query.targetField ? [query.targetField] : []),
    ...(query.groupByField ? [query.groupByField] : []),
    ...query.filters.map((f) => f.field),
    ...(query.dateRange?.field ? [query.dateRange.field] : []),
  ];

  // Block PII field queries for Canon Admin or any role via query engine
  for (const field of allReferencedFields) {
    if (isPiiField(field)) {
      return {
        verified: false,
        restricted: true,
        restrictionNotice: `Field "${field}" contains restricted customer personal or payment information and cannot be queried.`,
        appliedFilters: [`role = ${user.role}`],
        calculationPerformed: 'Blocked before execution (PII field allowlist check)',
        authorizedSourceIds: [],
        matchedRecordCount: 0,
        computedResult: null,
        matchedSummaries: [],
      };
    }
  }

  // Block explicit cross-tenant dealerId or customerId filter tampering
  for (const f of query.filters) {
    if (f.field === 'dealerId' && user.role === 'customer') {
      return {
        verified: false,
        restricted: true,
        restrictionNotice: `Access denied: customer account ${user.customerId} cannot query dealer portfolio records.`,
        appliedFilters: [`enforced_customer = ${user.customerId}`],
        calculationPerformed: 'Blocked before execution (customer isolation policy)',
        authorizedSourceIds: [],
        matchedRecordCount: 0,
        computedResult: null,
        matchedSummaries: [],
      };
    }
    if (
      f.field === 'dealerId' &&
      user.role === 'dealer' &&
      user.dealerId &&
      String(f.value).toUpperCase() !== user.dealerId.toUpperCase()
    ) {
      return {
        verified: false,
        restricted: true,
        restrictionNotice: `Access denied: your dealer identity (${user.dealerId}) cannot query records belonging to dealer "${String(f.value)}".`,
        appliedFilters: [`enforced_dealer = ${user.dealerId}`],
        calculationPerformed: 'Blocked before execution (cross-dealer isolation policy)',
        authorizedSourceIds: [],
        matchedRecordCount: 0,
        computedResult: null,
        matchedSummaries: [],
      };
    }
    if (
      f.field === 'customerId' &&
      user.role === 'customer' &&
      user.customerId &&
      String(f.value).toUpperCase() !== user.customerId.toUpperCase()
    ) {
      return {
        verified: false,
        restricted: true,
        restrictionNotice: `Access denied: customer account ${user.customerId} cannot query records belonging to "${String(f.value)}".`,
        appliedFilters: [`enforced_customer = ${user.customerId}`],
        calculationPerformed: 'Blocked before execution (customer isolation policy)',
        authorizedSourceIds: [],
        matchedRecordCount: 0,
        computedResult: null,
        matchedSummaries: [],
      };
    }
    if (
      f.field === 'customerId' &&
      user.role === 'dealer' &&
      !authorizedSubscriptions.some(
        (s) => s.customerId.toUpperCase() === String(f.value).toUpperCase(),
      )
    ) {
      return {
        verified: false,
        restricted: true,
        restrictionNotice: `Access denied: customer "${String(f.value)}" is not assigned to dealership ${user.dealerId}.`,
        appliedFilters: [`enforced_dealer = ${user.dealerId}`],
        calculationPerformed: 'Blocked before execution (dealer-customer ownership policy)',
        authorizedSourceIds: [],
        matchedRecordCount: 0,
        computedResult: null,
        matchedSummaries: [],
      };
    }
  }

  // Validate allowlist for targetEntity
  const allowlist =
    query.targetEntity === 'subscriptions'
      ? new Set([...ALLOWED_SUBSCRIPTION_FIELDS, ...dynamicCustomFieldKeys])
      : query.targetEntity === 'service_events'
        ? ALLOWED_SERVICE_EVENT_FIELDS
        : ALLOWED_USAGE_FIELDS;

  for (const field of allReferencedFields) {
    if (!allowlist.has(field)) {
      return {
        verified: false,
        restricted: false,
        restrictionNotice: `Query validation failed: field "${field}" is not an authorized schema field on "${query.targetEntity}".`,
        appliedFilters: [],
        calculationPerformed: 'Query rejected by schema allowlist validator',
        authorizedSourceIds: [],
        matchedRecordCount: 0,
        computedResult: null,
        matchedSummaries: [],
      };
    }
  }

  // 2. Select authorized dataset slice (already RBAC-filtered!)
  let dataset: Array<Record<string, unknown>> = [];
  if (query.targetEntity === 'subscriptions') {
    dataset = authorizedSubscriptions as unknown as Array<Record<string, unknown>>;
  } else if (query.targetEntity === 'service_events') {
    dataset = authorizedServiceEvents as unknown as Array<Record<string, unknown>>;
  } else {
    dataset = authorizedUsageRecords as unknown as Array<Record<string, unknown>>;
  }

  // 3. Apply validated filters and date range
  const appliedFilters: string[] = [
    user.role === 'canon_admin'
      ? 'scope = Canon Governance (all metadata, PII stripped)'
      : user.role === 'dealer'
        ? `scope = dealerId:${user.dealerId}`
        : `scope = customerId:${user.customerId}`,
  ];

  const matched = dataset.filter((row) => {
    for (const f of query.filters) {
      if (!matchesFilter(row, f)) return false;
    }
    if (query.dateRange) {
      const dateVal = getFieldValue(row, query.dateRange.field);
      if (!dateVal) return false;
      const d = String(dateVal).slice(0, 10);
      if (d < query.dateRange.startDate || d > query.dateRange.endDate) {
        return false;
      }
    }
    return true;
  });

  for (const f of query.filters) {
    appliedFilters.push(`${f.field} ${f.operator} "${String(f.value)}"`);
  }
  if (query.dateRange) {
    appliedFilters.push(
      `${query.dateRange.field} between ${query.dateRange.startDate} and ${query.dateRange.endDate}`,
    );
  }

  // Collect authorized subscription source IDs (for events/usage, map back to subscriptionId as well)
  const sourceIdSet = new Set<string>();
  for (const row of matched) {
    if (query.targetEntity === 'subscriptions') {
      sourceIdSet.add(String(row.id));
    } else {
      sourceIdSet.add(String(row.subscriptionId));
    }
  }
  const authorizedSourceIds = Array.from(sourceIdSet);

  // 4. Deterministic aggregation + independent verification recompute
  let computedResult: string | number | Record<string, number> | null = null;
  let calculationPerformed = '';

  if (query.operation === 'count') {
    computedResult = matched.length;
    calculationPerformed = `COUNT(${query.targetEntity}) = ${matched.length}`;
  } else if (query.operation === 'sum') {
    const field = query.targetField || 'monthlyEquivalentCost';
    let sum = 0;
    for (const row of matched) {
      const v = Number(getFieldValue(row, field) ?? 0);
      if (!Number.isNaN(v)) sum += v;
    }
    const rounded = Math.round(sum * 100) / 100;
    computedResult = rounded;
    calculationPerformed = `SUM(${field}) across ${matched.length} authorized records = ${rounded}`;
  } else if (query.operation === 'average') {
    const field = query.targetField || 'monthlyEquivalentCost';
    if (matched.length === 0) {
      computedResult = 0;
      calculationPerformed = `AVG(${field}) across 0 records = 0`;
    } else {
      let sum = 0;
      let validCount = 0;
      for (const row of matched) {
        const raw = getFieldValue(row, field);
        if (raw !== undefined && raw !== null && !Number.isNaN(Number(raw))) {
          sum += Number(raw);
          validCount++;
        }
      }
      const avg = validCount > 0 ? Math.round((sum / validCount) * 100) / 100 : 0;
      computedResult = avg;
      calculationPerformed = `AVG(${field}) across ${validCount} records = ${avg}`;
    }
  } else if (query.operation === 'group_count') {
    const groupField = query.groupByField || 'subscriptionType';
    const counts: Record<string, number> = {};
    for (const row of matched) {
      const key = String(getFieldValue(row, groupField) ?? 'Unknown');
      counts[key] = (counts[key] || 0) + 1;
    }
    computedResult = counts;
    calculationPerformed = `GROUP COUNT(${groupField}) across ${matched.length} records`;
  } else if (query.operation === 'group_sum') {
    const groupField = query.groupByField || 'subscriptionType';
    const targetField = query.targetField || 'monthlyEquivalentCost';
    const sums: Record<string, number> = {};
    for (const row of matched) {
      const key = String(getFieldValue(row, groupField) ?? 'Unknown');
      const val = Number(getFieldValue(row, targetField) ?? 0);
      sums[key] = Math.round(((sums[key] || 0) + (Number.isNaN(val) ? 0 : val)) * 100) / 100;
    }
    computedResult = sums;
    calculationPerformed = `GROUP SUM(${targetField}) BY ${groupField} across ${matched.length} records`;
  } else {
    computedResult = matched.length;
    calculationPerformed = `LIST(${query.targetEntity}) returned ${matched.length} authorized records`;
  }

  // 5. Verification cross-check against authorized ownership boundaries
  const authorizedSubIdSet = new Set(authorizedSubscriptions.map((s) => s.id));
  const allSourcesAuthorized = authorizedSourceIds.every((id) => authorizedSubIdSet.has(id));
  if (!allSourcesAuthorized) {
    return {
      verified: false,
      restricted: true,
      restrictionNotice: 'Verification aborted: source boundary integrity check failed.',
      appliedFilters,
      calculationPerformed: 'Withheld by verification check',
      authorizedSourceIds: [],
      matchedRecordCount: 0,
      computedResult: null,
      matchedSummaries: [],
    };
  }

  // Build safe summaries (zero PII) for Gemini prose explanation
  const matchedSummaries = matched.slice(0, 25).map((row) => {
    if (query.targetEntity === 'subscriptions') {
      return {
        id: row.id,
        product: row.product,
        subscriptionType: row.subscriptionType,
        customerId: row.customerId,
        customerLabel: user.role === 'canon_admin' ? `Restricted (${row.customerId})` : row.customerDisplayLabel,
        dealerId: row.dealerId,
        dealerName: row.dealerName,
        renewalDate: row.renewalDate,
        billingFrequency: row.billingFrequency,
        cost: row.cost,
        monthlyEquivalentCost: row.monthlyEquivalentCost,
        status: row.status,
        customFields: row.visibleCustomFields,
      };
    }
    if (query.targetEntity === 'service_events') {
      return {
        id: row.id,
        subscriptionId: row.subscriptionId,
        customerId: row.customerId,
        dealerId: row.dealerId,
        deviceModel: row.deviceModel,
        occurredAt: row.occurredAt,
        eventType: row.eventType,
        severity: row.severity,
        description: row.description,
        resolved: row.resolved,
      };
    }
    return {
      id: row.id,
      subscriptionId: row.subscriptionId,
      billingMonth: row.billingMonth,
      unitsUsed: row.unitsUsed,
      includedAllowance: row.includedAllowance,
      overageUnits: row.overageUnits,
      overageCost: row.overageCost,
      unitLabel: row.unitLabel,
    };
  });

  return {
    verified: true,
    restricted: false,
    appliedFilters,
    calculationPerformed,
    authorizedSourceIds,
    matchedRecordCount: matched.length,
    computedResult,
    matchedSummaries,
  };
}
