import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { canopyApi } from '../api';
import { formatCategoryLabel, formatCurrency } from '../components/CanonLogo';
import type {
  DemoUser,
  QueryEntity,
  QueryFilter,
  QueryOperation,
  ReportQueryResponse,
  StructuredQuery,
  SubscriptionView,
} from '../types';

interface Props {
  currentUser: DemoUser;
  onSelectSubscription: (id: string) => void;
}

interface QuickTemplate {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  query: StructuredQuery;
}

export function ReportsPage({ currentUser, onSelectSubscription }: Props) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Report Output
  const [activeReportTitle, setActiveReportTitle] = useState<string>('Adobe Acrobat Licences Expiring October 2027');
  const [reportResult, setReportResult] = useState<ReportQueryResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [sourceRecordsExpanded, setSourceRecordsExpanded] = useState(true);

  // Custom Report Builder Form State
  const [builderOpen, setBuilderOpen] = useState(false);
  const [entity, setEntity] = useState<QueryEntity>('subscriptions');
  const [operation, setOperation] = useState<QueryOperation>('sum');
  const [targetField, setTargetField] = useState('monthlyEquivalentCost');
  const [groupByField, setGroupByField] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // 4 Built-in Quick Templates executing directly from the dataset (0ms latency, zero Gemini dependency)
  const quickTemplates: QuickTemplate[] = [
    {
      id: 'adobe_oct_2027',
      title: 'Adobe Acrobat Licences Expiring October 2027',
      description: 'Sum of seats across all authorized Adobe Acrobat contracts with October 2027 expiry',
      icon: Layers,
      query: {
        targetEntity: 'subscriptions',
        operation: 'sum',
        targetField: 'licenceSeats',
        filters: [
          { field: 'product', operator: 'contains', value: 'Adobe Acrobat' },
          { field: 'renewalDate', operator: 'month_eq', value: '2027-10' },
        ],
        intentSummary: 'Sum of Adobe Acrobat seats expiring in October 2027',
      },
    },
    {
      id: 'dxc5860i_flags',
      title: 'DX C5860i Active Service Flags',
      description: 'Count of unresolved diagnostic flags on imageRUNNER ADVANCE DX C5860i copiers',
      icon: Wrench,
      query: {
        targetEntity: 'service_events',
        operation: 'count',
        filters: [
          { field: 'deviceModel', operator: 'contains', value: 'DX C5860i' },
          { field: 'eventType', operator: 'eq', value: 'service_flag' },
          { field: 'resolved', operator: 'eq', value: false },
        ],
        intentSummary: 'Unresolved service flags on imageRUNNER ADVANCE DX C5860i devices',
      },
    },
    {
      id: 'subs_by_customer',
      title: 'Agreements by Customer Account',
      description: 'Distribution of contracts grouped by customer account across all tiers',
      icon: Users,
      query: {
        targetEntity: 'subscriptions',
        operation: 'group_count',
        groupByField: 'customerId',
        filters: [],
        intentSummary: 'Total agreement count grouped by customer account',
      },
    },
    {
      id: 'upcoming_renewals_90d',
      title: 'Renewals Due within 90 Days',
      description: 'All active agreements with renewal dates falling within the 90-day window',
      icon: Calendar,
      query: {
        targetEntity: 'subscriptions',
        operation: 'group_sum',
        groupByField: 'subscriptionType',
        targetField: 'monthlyEquivalentCost',
        dateRange: {
          field: 'renewalDate',
          startDate: '2026-11-21',
          endDate: '2027-02-19',
        },
        filters: [{ field: 'status', operator: 'neq', value: 'suspended' }],
        intentSummary: 'Renewals due within 90 days grouped by subscription type',
      },
    },
  ];

  // Execute a report deterministically via canopyApi.executeReportQuery
  const runReport = async (title: string, query: StructuredQuery) => {
    setActiveReportTitle(title);
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await canopyApi.executeReportQuery(query);
      setReportResult(res);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Unable to execute report query.');
      setReportResult(null);
    } finally {
      setReportLoading(false);
    }
  };

  // Initial load: Fetch subscriptions and execute the first mandatory template
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    canopyApi
      .getSubscriptions()
      .then((res) => {
        if (!cancelled) {
          setSubscriptions(res.subscriptions);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load dataset.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Run first template automatically
    runReport(quickTemplates[0].title, quickTemplates[0].query);

    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  // Execute custom builder query
  const handleExecuteCustomReport = () => {
    const filters: QueryFilter[] = [];
    if (filterCategory !== 'all') {
      filters.push({ field: 'subscriptionType', operator: 'eq', value: filterCategory });
    }
    if (filterStatus !== 'all') {
      filters.push({ field: 'status', operator: 'eq', value: filterStatus });
    }

    const customQuery: StructuredQuery = {
      targetEntity: entity,
      operation,
      targetField: ['sum', 'average', 'group_sum'].includes(operation) ? targetField : undefined,
      groupByField: ['group_count', 'group_sum'].includes(operation) ? (groupByField || 'subscriptionType') : undefined,
      filters,
      intentSummary: `Custom ${operation.toUpperCase()} on ${entity}`,
    };

    runReport(`Custom ${operation.replace('_', ' ').toUpperCase()} Report`, customQuery);
  };

  // Export current report results to CSV
  const handleExportCsv = () => {
    if (!reportResult || reportResult.matchedRecords.length === 0) return;

    const rows = reportResult.matchedRecords;
    const allKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

    const csvHeaders = allKeys.join(',');
    const csvRows = rows.map((r) =>
      allKeys
        .map((k) => {
          const val = r[k];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );

    const csv = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `canopy-report-${activeReportTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Executive Reports</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Instant deterministic contract audits, renewal forecasting, and capacity calculations with CSV export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser.role === 'canon_admin' && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs">
              <Lock className="h-3.5 w-3.5 text-canon" />
              Customer details protected
            </span>
          )}

          <button
            type="button"
            disabled={!reportResult || reportResult.matchedRecords.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:border-canon hover:text-canon disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report CSV
          </button>
        </div>
      </div>

      {/* 1. Quick Report Templates Strip (100% Deterministic, 0ms, No Gemini dependency) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Quick Report Templates
          </div>
          <button
            type="button"
            onClick={() => setBuilderOpen(!builderOpen)}
            className="text-xs font-semibold text-canon hover:underline flex items-center gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{builderOpen ? 'Close Custom Builder' : 'Open Custom Builder'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickTemplates.map((tmpl) => {
            const isSelected = activeReportTitle === tmpl.title;
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => runReport(tmpl.title, tmpl.query)}
                className={`text-left p-3.5 rounded-xl border transition-all shadow-2xs flex flex-col justify-between ${
                  isSelected
                    ? 'border-canon bg-red-50/40 ring-1 ring-canon'
                    : 'border-zinc-200/80 bg-white hover:border-zinc-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-canon' : 'text-zinc-500'}`} />
                    <span className="text-xs font-bold text-zinc-900 leading-snug">
                      {tmpl.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-normal line-clamp-2">
                    {tmpl.description}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-semibold">
                  <span className={isSelected ? 'text-canon' : 'text-zinc-400'}>
                    Instant Calculation
                  </span>
                  <ArrowRight className={`h-3 w-3 ${isSelected ? 'text-canon' : 'text-zinc-300'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Report Builder Accordion */}
      {builderOpen && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-canon" />
                Custom Report Builder
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Build ad-hoc aggregations and filters directly across your authorized record schema.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEntity('subscriptions');
                setOperation('sum');
                setTargetField('monthlyEquivalentCost');
                setGroupByField('');
                setFilterCategory('all');
                setFilterStatus('all');
              }}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Form
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Entity */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-700">Target Entity</label>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value as QueryEntity)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:border-canon focus:outline-none"
              >
                <option value="subscriptions">Subscriptions (Contracts)</option>
                <option value="service_events">Service Events (Equipment Alerts)</option>
                <option value="usage_records">Usage Telemetry (Pages &amp; Units)</option>
              </select>
            </div>

            {/* Aggregation Function */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-700">Aggregation Function</label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value as QueryOperation)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:border-canon focus:outline-none"
              >
                <option value="sum">SUM (Total of field)</option>
                <option value="count">COUNT (Number of records)</option>
                <option value="average">AVERAGE (Mean value)</option>
                <option value="group_count">GROUP COUNT (Breakdown by field)</option>
                <option value="group_sum">GROUP SUM (Sum by group)</option>
                <option value="list">LIST (Display matching records)</option>
              </select>
            </div>

            {/* Target Field */}
            {['sum', 'average', 'group_sum'].includes(operation) && (
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Numeric Target Field</label>
                <select
                  value={targetField}
                  onChange={(e) => setTargetField(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:border-canon focus:outline-none"
                >
                  <option value="monthlyEquivalentCost">Monthly Normalized Cost (CAD)</option>
                  <option value="cost">Contract Total Cost (CAD)</option>
                  <option value="licenceSeats">Licence Seats (Software)</option>
                  <option value="monthlyPageUsage">Page Usage (Hardware)</option>
                  <option value="pageAllowance">Page Allowance (Hardware)</option>
                </select>
              </div>
            )}

            {/* Group By Field */}
            {['group_count', 'group_sum'].includes(operation) && (
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Group By Field</label>
                <select
                  value={groupByField}
                  onChange={(e) => setGroupByField(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:border-canon focus:outline-none"
                >
                  <option value="subscriptionType">Subscription Category</option>
                  <option value="dealerId">Issuing Partner</option>
                  <option value="status">Contract Status</option>
                  <option value="customerId">Customer Account ID</option>
                </select>
              </div>
            )}

            {/* Filter Category */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-700">Category Filter</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:border-canon focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="hardware_maintenance">Hardware &amp; Maintenance</option>
                <option value="software_licence">Software Licences</option>
                <option value="managed_it">Managed IT Services</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-700">Status Filter</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:border-canon focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="renewal_due">Renewal Due</option>
                <option value="attention_required">Requires Attention</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end">
            <button
              type="button"
              onClick={handleExecuteCustomReport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark transition-colors shadow-2xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Generate Custom Report
            </button>
          </div>
        </div>
      )}

      {/* 3. Report Results Display */}
      {reportLoading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center space-y-3">
          <div className="h-5 w-5 border-2 border-canon border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-semibold text-zinc-700">
            Calculating verified figures against authorized dataset...
          </div>
        </div>
      ) : reportError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-xs text-red-800">
          {reportError}
        </div>
      ) : reportResult ? (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs space-y-6">
          {/* Result Header & Prominent Number */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-100 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified Independent Calculation</span>
                <span className="text-zinc-300 font-normal">|</span>
                <span className="text-zinc-500 font-mono text-[10px]">
                  {reportResult.evidence.auditLogId}
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-900">
                {activeReportTitle}
              </h2>
              <div className="mt-1 text-xs text-zinc-500 font-mono">
                {reportResult.evidence.calculationPerformed}
              </div>
            </div>

            {/* Prominent Computed Result Badge */}
            <div className="text-left sm:text-right shrink-0 bg-zinc-50 sm:bg-transparent p-3 sm:p-0 rounded-lg">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Calculated Total
              </div>
              <div className="text-3xl font-extrabold text-zinc-900 tabular-nums mt-0.5">
                {typeof reportResult.outcome.computedResult === 'object' && reportResult.outcome.computedResult !== null
                  ? `${Object.keys(reportResult.outcome.computedResult).length} groups`
                  : typeof reportResult.outcome.computedResult === 'number'
                    ? reportResult.evidence.calculationPerformed.includes('SUM(monthlyEquivalentCost)') || reportResult.evidence.calculationPerformed.includes('SUM(cost)')
                      ? formatCurrency(reportResult.outcome.computedResult)
                      : reportResult.outcome.computedResult.toLocaleString()
                    : String(reportResult.outcome.computedResult ?? 0)}
              </div>
              <div className="text-[11px] text-zinc-500">
                Across {reportResult.outcome.matchedRecordCount} authorized records
              </div>
            </div>
          </div>

          {/* Grouped Breakdown Chart (if group_count or group_sum) */}
          {typeof reportResult.outcome.computedResult === 'object' &&
            reportResult.outcome.computedResult !== null && (
              <div className="space-y-3 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Grouped Breakdown
                </div>
                <div className="space-y-2">
                  {Object.entries(reportResult.outcome.computedResult as Record<string, number>).map(
                    ([groupKey, val]) => {
                      const maxVal = Math.max(
                        1,
                        ...Object.values(reportResult.outcome.computedResult as Record<string, number>),
                      );
                      const widthPercent = Math.max(8, Math.round((val / maxVal) * 100));

                      return (
                        <div key={groupKey} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-zinc-800 font-semibold">{groupKey}</span>
                            <span className="font-bold text-zinc-900 tabular-nums">
                              {reportResult.evidence.calculationPerformed.includes('SUM')
                                ? formatCurrency(val)
                                : `${val} records`}
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-canon rounded-full transition-all duration-300"
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

          {/* Expandable Source Records Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSourceRecordsExpanded(!sourceRecordsExpanded)}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 hover:text-zinc-900"
              >
                <span>Authorized Source Records ({reportResult.matchedRecords.length})</span>
                {sourceRecordsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              <span className="text-[11px] text-zinc-500">
                PII-sanitized underlying evidence
              </span>
            </div>

            {sourceRecordsExpanded && (
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-2.5">Record ID</th>
                      <th className="px-4 py-2.5">Item / Product / Device</th>
                      <th className="px-4 py-2.5">Category / Event</th>
                      <th className="px-4 py-2.5">Account Scope</th>
                      <th className="px-4 py-2.5">Date / Renewal</th>
                      <th className="px-4 py-2.5 text-right">Value / Metric</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {reportResult.matchedRecords.map((rec, idx) => {
                      const recId = String(rec.id || rec.subscriptionId || idx);
                      const title = String(rec.product || rec.deviceModel || rec.softwareName || recId);
                      const cat = String(rec.subscriptionType || rec.eventType || 'Record');
                      const account = String(rec.customerLabel || rec.customerId || '');
                      const date = String(rec.renewalDate || rec.occurredAt || rec.billingMonth || '-');
                      const metric =
                        rec.licenceSeats !== undefined
                          ? `${rec.licenceSeats} seats`
                          : rec.monthlyEquivalentCost !== undefined
                            ? `${formatCurrency(Number(rec.monthlyEquivalentCost))}/mo`
                            : rec.severity !== undefined
                              ? `Severity: ${rec.severity}`
                              : '-';

                      return (
                        <tr
                          key={recId}
                          onClick={() => {
                            if (rec.id && String(rec.id).startsWith('SUB-')) {
                              onSelectSubscription(String(rec.id));
                            }
                          }}
                          className={`hover:bg-zinc-50/80 transition-colors ${
                            rec.id && String(rec.id).startsWith('SUB-') ? 'cursor-pointer' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-medium text-zinc-700">
                            {recId}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900 max-w-[240px] truncate">
                            {title}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 capitalize">
                            {cat.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 truncate max-w-[180px]">
                            {account}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-zinc-700">
                            {date}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-zinc-900 tabular-nums">
                            {metric}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
