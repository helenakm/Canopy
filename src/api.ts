import type {
  AiQueryResponse,
  AuditLogEntry,
  BillingFrequency,
  CustomFieldDataType,
  DashboardPayload,
  Dealer,
  DemoUser,
  ProactiveInsight,
  SanitizedCustomer,
  ServiceEvent,
  SubscriptionCategory,
  SubscriptionPlan,
  SubscriptionTypeDefinition,
  SubscriptionView,
  UsageRecord,
} from './types';

// Hold server-issued session token strictly in memory (never localStorage/sessionStorage)
let inMemorySessionToken: string | null = null;

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemorySessionToken) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkErr) {
    const msg =
      networkErr instanceof Error && networkErr.message && networkErr.message !== 'Load failed'
        ? networkErr.message
        : 'Connection interrupted while waiting for the server. Please retry.';
    throw new Error(msg);
  }

  const rawText = await res.text();
  let data = {} as T & { error?: string };
  if (rawText) {
    try {
      data = JSON.parse(rawText) as T & { error?: string };
    } catch {
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}.`);
      }
    }
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const canopyApi = {
  async getSession(): Promise<{
    currentUser: DemoUser;
    demoUsers: DemoUser[];
    sessionToken: string;
  }> {
    const res = await apiFetch<{
      currentUser: DemoUser;
      demoUsers: DemoUser[];
      sessionToken: string;
    }>('/api/session');
    if (res.sessionToken) {
      inMemorySessionToken = res.sessionToken;
    }
    return res;
  },

  async switchAccount(accountId: string): Promise<{
    currentUser: DemoUser;
    sessionToken: string;
  }> {
    const res = await apiFetch<{
      currentUser: DemoUser;
      sessionToken: string;
    }>('/api/session/switch', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    if (res.sessionToken) {
      inMemorySessionToken = res.sessionToken;
    }
    return res;
  },

  async getMetadata(): Promise<{
    dealers: Dealer[];
    customers: SanitizedCustomer[];
    subscriptionTypes: SubscriptionTypeDefinition[];
    plans: SubscriptionPlan[];
  }> {
    return apiFetch('/api/metadata');
  },

  async getDashboard(): Promise<DashboardPayload> {
    return apiFetch('/api/dashboard');
  },

  async getSubscriptions(params?: {
    type?: string;
    status?: string;
    dealerId?: string;
    renewalWindow?: string;
    search?: string;
  }): Promise<{ subscriptions: SubscriptionView[] }> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.status) qs.set('status', params.status);
    if (params?.dealerId) qs.set('dealerId', params.dealerId);
    if (params?.renewalWindow) qs.set('renewalWindow', params.renewalWindow);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch(`/api/subscriptions${suffix}`);
  },

  async getSubscriptionDetail(id: string): Promise<{
    subscription: SubscriptionView;
    typeDefinition: SubscriptionTypeDefinition;
    customer: SanitizedCustomer | undefined;
    usageHistory: UsageRecord[];
    serviceEvents: ServiceEvent[];
  }> {
    return apiFetch(`/api/subscriptions/${encodeURIComponent(id)}`);
  },

  async createSubscription(payload: {
    customerId: string;
    planId: string;
    product: string;
    subscriptionType: SubscriptionCategory;
    startDate: string;
    renewalDate: string;
    billingFrequency: BillingFrequency;
    cost: number;
    customFields: Record<string, string | number | boolean | null>;
  }): Promise<{ subscription: SubscriptionView }> {
    return apiFetch('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addCustomField(payload: {
    subscriptionType: SubscriptionCategory;
    label: string;
    dataType: CustomFieldDataType;
    required: boolean;
    options?: string[];
    unit?: string;
  }): Promise<{ subscriptionType: SubscriptionTypeDefinition }> {
    return apiFetch('/api/schema/fields', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getInsights(): Promise<{
    insights: ProactiveInsight[];
    summary: {
      totalInsights: number;
      requiresAttentionCount: number;
      costOptimizationCount: number;
      growthOpportunityCount: number;
      upcomingRenewalCount: number;
      totalMonthlySavings: number;
      totalAnnualSavings: number;
    };
  }> {
    return apiFetch('/api/insights');
  },

  async generateInsightsBriefing(): Promise<{ briefing: string }> {
    return apiFetch('/api/insights/briefing', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async askAi(question: string): Promise<AiQueryResponse> {
    return apiFetch('/api/ai/query', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },

  async executeReportQuery(query: import('./types').StructuredQuery): Promise<import('./types').ReportQueryResponse> {
    return apiFetch('/api/reports/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  async getAuditLogs(): Promise<{ auditLogs: AuditLogEntry[] }> {
    return apiFetch('/api/audit');
  },
};
