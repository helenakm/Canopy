export type UserRole = 'canon_admin' | 'dealer' | 'customer';

export type SubscriptionCategory =
  | 'hardware_maintenance'
  | 'software_licence'
  | 'managed_it';

export type BillingFrequency = 'monthly' | 'quarterly' | 'annual';

export type SubscriptionStatus =
  | 'active'
  | 'renewal_due'
  | 'attention_required'
  | 'suspended';

export type CustomFieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'select';

export interface DemoUser {
  id: string;
  name: string;
  title: string;
  organization: string;
  role: UserRole;
  dealerId: string | null;
  customerId: string | null;
  avatarUrl: string;
}

export interface Dealer {
  id: string;
  name: string;
  region: string;
  partnerTier: 'Platinum' | 'Gold';
  accountCode: string;
}

export interface Customer {
  id: string;
  dealerId: string;
  organizationName: string;
  contactName: string;
  address: string;
  city: string;
  province: string;
  email: string;
  phone: string;
  paymentInfo: string;
  industry: string;
}

export interface SanitizedCustomer {
  id: string;
  dealerId: string;
  province: string;
  industry: string;
  organizationName: string | null;
  contactName: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  paymentInfo: string | null;
  piiRedacted: boolean;
}

export interface FieldDefinition {
  key: string;
  label: string;
  dataType: CustomFieldDataType;
  required: boolean;
  options?: string[];
  unit?: string;
  description?: string;
  isSystem?: boolean;
  conditionalHideWhen?: {
    fieldKey: string;
    equalsValue: boolean | string;
  };
}

export interface SubscriptionTypeDefinition {
  id: SubscriptionCategory;
  name: string;
  shortLabel: string;
  description: string;
  fields: FieldDefinition[];
}

export interface SubscriptionRecord {
  id: string;
  customerId: string;
  dealerId: string;
  planId: string;
  product: string;
  subscriptionType: SubscriptionCategory;
  startDate: string;
  renewalDate: string;
  billingFrequency: BillingFrequency;
  cost: number;
  monthlyEquivalentCost: number;
  status: SubscriptionStatus;
  legacySourceSystem: string;
  customFields: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface SanitizedSubscriptionView extends SubscriptionRecord {
  dealerName: string;
  customerDisplayLabel: string;
  customerRegion: string;
  planName: string;
  tonerServiceExcluded: boolean;
  visibleCustomFields: Record<string, string | number | boolean | null>;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  customerId: string;
  dealerId: string;
  billingMonth: string; // YYYY-MM
  unitsUsed: number;
  includedAllowance: number;
  overageUnits: number;
  overageCost: number;
  unitLabel: string;
}

export interface ServiceEvent {
  id: string;
  subscriptionId: string;
  customerId: string;
  dealerId: string;
  deviceModel: string;
  occurredAt: string; // YYYY-MM-DD
  eventType: 'service_flag' | 'maintenance_visit' | 'uptime_incident' | 'firmware_check';
  severity: 'low' | 'medium' | 'high';
  description: string;
  resolved: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  subscriptionType: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  baseCost: number;
  monthlyEquivalentBaseCost: number;
  includedUnits: number;
  unitLabel: string;
  overageRatePerUnit: number;
  eligibilityRule: string;
  targetSegment: string;
  tonerIncluded?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: UserRole;
  dealerId: string | null;
  customerId: string | null;
  actionType: 'ai_query' | 'subscription_create' | 'schema_update' | 'insight_summary' | 'role_switch';
  summary: string;
  queryText?: string;
  verificationStatus: 'verified' | 'restricted' | 'withheld' | 'recorded';
  authorizedSourceIds: string[];
  appliedFilters?: string[];
  calculationPerformed?: string;
}

export interface DatabaseSchema {
  users: DemoUser[];
  dealers: Dealer[];
  customers: Customer[];
  subscriptionTypes: SubscriptionTypeDefinition[];
  subscriptions: SubscriptionRecord[];
  usageRecords: UsageRecord[];
  serviceEvents: ServiceEvent[];
  plans: SubscriptionPlan[];
  auditLogs: AuditLogEntry[];
}

export type QueryEntity = 'subscriptions' | 'service_events' | 'usage_records';
export type QueryOperation = 'count' | 'sum' | 'average' | 'list' | 'group_count' | 'group_sum';

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gte' | 'lte' | 'gt' | 'lt' | 'month_eq';
  value: string | number | boolean;
}

export interface StructuredQuery {
  targetEntity: QueryEntity;
  operation: QueryOperation;
  targetField?: string;
  groupByField?: string;
  filters: QueryFilter[];
  dateRange?: {
    field: string;
    startDate: string;
    endDate: string;
  };
  intentSummary: string;
  requestsRestrictedPii?: boolean;
  restrictionReason?: string;
}

export interface VerificationEvidence {
  verificationStatus: 'verified' | 'restricted' | 'withheld';
  authorizedSourceIds: string[];
  appliedFilters: string[];
  calculationPerformed: string;
  verifiedAt: string;
  auditLogId: string;
  matchedRecordCount: number;
  computedResult: string | number | Record<string, number> | null;
  restrictionNotice?: string;
}

export interface ProactiveInsight {
  id: string;
  category:
    | 'requires_attention'
    | 'cost_optimization'
    | 'growth_opportunity'
    | 'upcoming_renewal';
  severity: 'high' | 'medium' | 'low';
  title: string;
  subscriptionId: string;
  product: string;
  subscriptionType: SubscriptionCategory;
  dealerId: string;
  dealerName: string;
  customerId: string;
  customerLabel: string;
  summary: string;
  whyItMatters: string;
  recommendedAction: string;
  advisoryDisclaimer: string;
  estimatedMonthlySavings?: number;
  estimatedAnnualSavings?: number;
  currentPlanName?: string;
  recommendedPlanName?: string;
  actualUsageSummary?: string;
  calculationBreakdown?: string;
  assumptions?: string[];
  supportingRecordIds: string[];
  metrics: Array<{ label: string; value: string }>;
}
