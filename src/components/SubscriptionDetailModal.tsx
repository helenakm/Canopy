import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Printer,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import { canopyApi } from '../api';
import type {
  DemoUser,
  SanitizedCustomer,
  ServiceEvent,
  SubscriptionTypeDefinition,
  SubscriptionView,
  UsageRecord,
} from '../types';
import {
  formatCategoryBadge,
  formatCategoryLabel,
  formatCurrency,
  formatDataSourceLabel,
  formatStatusText,
} from './CanonLogo';

interface Props {
  subscriptionId: string | null;
  currentUser: DemoUser;
  onClose: () => void;
}

type DetailTab = 'overview' | 'usage' | 'service';

export function SubscriptionDetailModal({ subscriptionId, currentUser, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [detail, setDetail] = useState<{
    subscription: SubscriptionView;
    typeDefinition: SubscriptionTypeDefinition;
    customer: SanitizedCustomer | undefined;
    usageHistory: UsageRecord[];
    serviceEvents: ServiceEvent[];
  } | null>(null);

  useEffect(() => {
    if (!subscriptionId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveTab('overview');

    canopyApi
      .getSubscriptionDetail(subscriptionId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load subscription details.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subscriptionId]);

  if (!subscriptionId) return null;

  const openFlagCount =
    detail?.serviceEvents.filter((e) => e.eventType === 'service_flag' && !e.resolved).length || 0;

  const catBadge = detail ? formatCategoryBadge(detail.subscription.subscriptionType) : null;
  const statusInfo = detail ? formatStatusText(detail.subscription.status) : null;

  // Usage calculations for Tab 2
  const usageCount = detail?.usageHistory.length || 0;
  const totalUnitsUsed = detail?.usageHistory.reduce((acc, u) => acc + u.unitsUsed, 0) || 0;
  const totalAllowance = detail?.usageHistory.reduce((acc, u) => acc + u.includedAllowance, 0) || 1;
  const avgUtilizationPct = Math.min(200, Math.round((totalUnitsUsed / totalAllowance) * 100));
  const totalOveragesCost = detail?.usageHistory.reduce((acc, u) => acc + u.overageCost, 0) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-2xl overflow-y-auto bg-white border-l border-zinc-200/80 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Title and Tabs */}
        <div className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px]">
                  {subscriptionId}
                </span>
                <span aria-hidden="true">·</span>
                {catBadge && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${catBadge.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${catBadge.dotClass}`} />
                    {catBadge.label}
                  </span>
                )}
              </div>
              <h2 className="mt-1 truncate text-lg font-bold text-zinc-900 tracking-tight">
                {detail ? detail.subscription.product : 'Subscription Details'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
              aria-label="Close detail view"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 3 Executive Tabs */}
          <div className="flex items-center gap-1 px-6 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-canon text-canon'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Overview &amp; Plan Fields
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('usage')}
              className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'usage'
                  ? 'border-canon text-canon'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Usage &amp; Overages
              {usageCount > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-600">
                  {usageCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('service')}
              className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'service'
                  ? 'border-canon text-canon'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Service Activity
              {openFlagCount > 0 ? (
                <span className="rounded-full bg-rose-50 border border-rose-200/60 text-rose-700 px-1.5 py-0.2 text-[10px] font-semibold">
                  {openFlagCount} flag{openFlagCount > 1 ? 's' : ''}
                </span>
              ) : (
                detail?.serviceEvents.length ? (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-600">
                    {detail.serviceEvents.length}
                  </span>
                ) : null
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 space-y-6">
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 rounded-xl bg-zinc-100 animate-pulse" />
                <div className="h-20 rounded-xl bg-zinc-100 animate-pulse" />
                <div className="h-20 rounded-xl bg-zinc-100 animate-pulse" />
              </div>
              <div className="h-44 rounded-xl bg-zinc-100 animate-pulse" />
              <div className="h-36 rounded-xl bg-zinc-100 animate-pulse" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              {error}
            </div>
          )}

          {detail && !loading && (
            <>
              {/* TAB 1: OVERVIEW & PLAN FIELDS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* 3-Column Hero Summary Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Status */}
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                      <div className="text-[11px] font-medium text-zinc-500">Agreement Status</div>
                      <div className="mt-1.5">
                        {statusInfo && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border ${statusInfo.bgClass} ${statusInfo.colorClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Billing */}
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                      <div className="text-[11px] font-medium text-zinc-500">Contract Value &amp; Cadence</div>
                      <div className="mt-1 text-sm font-bold text-zinc-900 tabular-nums">
                        {formatCurrency(detail.subscription.cost)}{' '}
                        <span className="text-xs font-normal text-zinc-500 capitalize">
                          / {detail.subscription.billingFrequency}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
                        {formatCurrency(detail.subscription.monthlyEquivalentCost)}/mo normalized
                      </div>
                    </div>

                    {/* Renewal */}
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                      <div className="text-[11px] font-medium text-zinc-500">Next Renewal</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900 tabular-nums">
                        {detail.subscription.renewalDate}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
                        Effective {detail.subscription.startDate}
                      </div>
                    </div>
                  </div>

                  {/* Account & Partner Ownership */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                        Account &amp; Partner Ownership
                      </h3>
                      {currentUser.role === 'canon_admin' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200/60 rounded px-2 py-0.5">
                          <Lock className="h-3 w-3" />
                          Customer details protected
                        </span>
                      )}
                    </div>

                    {detail.customer?.piiRedacted ? (
                      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 text-xs text-zinc-700 space-y-2">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="h-4 w-4 text-canon shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="font-semibold text-zinc-900">
                              Customer Reference ID:{' '}
                              <span className="font-mono bg-white border border-zinc-200 px-1.5 py-0.5 rounded text-[11px]">
                                {detail.subscription.customerId}
                              </span>
                            </div>
                            <p className="text-zinc-600 leading-relaxed text-[11px]">
                              Province: <span className="font-medium text-zinc-900">{detail.customer.province}</span> · Industry: <span className="font-medium text-zinc-900">{detail.customer.industry}</span>. Under Canon Canada governance and PIPEDA compliance, customer trade names, personal contacts, email addresses, phone numbers, and payment details are strictly masked.
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-zinc-200/60 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-zinc-500">Issuing Partner: </span>
                            <span className="font-semibold text-zinc-900">{detail.subscription.dealerName}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Dealer Code: </span>
                            <span className="font-mono text-zinc-700">{detail.subscription.dealerId}</span>
                          </div>
                        </div>
                      </div>
                    ) : detail.customer ? (
                      <div className="rounded-xl border border-zinc-200/80 bg-white p-4 space-y-3.5 shadow-2xs">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-bold text-zinc-900">
                              {detail.customer.organizationName}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500">
                              Account Ref: <span className="font-mono font-medium text-zinc-700">{detail.customer.id}</span> · {detail.customer.industry}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-zinc-900">{detail.subscription.dealerName}</div>
                            <div className="text-[11px] text-zinc-500">Issuing Partner ({detail.subscription.dealerId})</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-100 text-xs">
                          <div>
                            <div className="text-zinc-500">Primary Contact</div>
                            <div className="mt-0.5 font-medium text-zinc-900">{detail.customer.contactName}</div>
                            <div className="text-zinc-600">{detail.customer.email}</div>
                          </div>
                          <div>
                            <div className="text-zinc-500">Telephone &amp; Payment Mandate</div>
                            <div className="mt-0.5 font-medium text-zinc-900 tabular-nums">{detail.customer.phone}</div>
                            <div className="text-zinc-600">{detail.customer.paymentInfo}</div>
                          </div>
                          <div className="sm:col-span-2">
                            <div className="text-zinc-500">Service Location</div>
                            <div className="mt-0.5 text-zinc-800">
                              {detail.customer.address}, {detail.customer.city}, {detail.customer.province}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>

                  {/* Agreement Summary */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                      Agreement Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                        <div className="text-[11px] text-zinc-500">Plan Tier</div>
                        <div className="mt-1 text-xs font-semibold text-zinc-900">
                          {detail.subscription.planName}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                        <div className="text-[11px] text-zinc-500">Data Source</div>
                        <div className="mt-1 text-xs font-medium text-zinc-800">
                          {formatDataSourceLabel(detail.subscription.legacySourceSystem)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                        <div className="text-[11px] text-zinc-500">Agreement Term</div>
                        <div className="mt-1 text-xs font-medium text-zinc-900 tabular-nums">
                          {detail.subscription.startDate} → {detail.subscription.renewalDate}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                        <div className="text-[11px] text-zinc-500">Issuing Partner</div>
                        <div className="mt-1 text-xs font-medium text-zinc-900">
                          {detail.subscription.dealerName}{' '}
                          <span className="font-mono text-zinc-400">({detail.subscription.dealerId})</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Tailored Subscription Specifications (Custom Fields) */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                        {detail.typeDefinition?.name || 'Category'} Specifications
                      </h3>
                      {detail.subscription.tonerServiceExcluded && (
                        <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/60 rounded px-2 py-0.5">
                          Parts &amp; Labour Only
                        </span>
                      )}
                    </div>

                    {detail.subscription.tonerServiceExcluded && (
                      <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 leading-relaxed">
                        <div className="font-semibold">Toner Replenishment Excluded</div>
                        <p className="mt-0.5 text-[11px]">
                          This printer maintenance agreement explicitly excludes toner replenishment. Automated toner dispatch and supply replenishment tiers are omitted.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {detail.typeDefinition?.fields
                        .filter((f) => f.key in detail.subscription.visibleCustomFields)
                        .map((field) => {
                          const raw = detail.subscription.visibleCustomFields[field.key];
                          let formatted = String(raw ?? '—');
                          if (typeof raw === 'boolean') {
                            if (field.key === 'tonerIncluded') {
                              formatted = raw ? 'Included in Agreement' : 'Excluded (Not Covered)';
                            } else {
                              formatted = raw ? 'Enabled' : 'Disabled';
                            }
                          } else if (typeof raw === 'number') {
                            formatted = field.unit
                              ? `${raw.toLocaleString()} ${field.unit}`
                              : raw.toLocaleString();
                          }
                          return (
                            <div
                              key={field.key}
                              className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs"
                            >
                              <div className="text-[11px] text-zinc-500">{field.label}</div>
                              <div className="mt-1 text-xs font-semibold text-zinc-900 tabular-nums">
                                {formatted}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 2: USAGE & OVERAGES */}
              {activeTab === 'usage' && (
                <div className="space-y-6">
                  {detail.usageHistory.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-10 text-center space-y-2">
                      <BarChart2 className="h-8 w-8 text-zinc-400 mx-auto" />
                      <div className="text-sm font-semibold text-zinc-900">No Metered Usage Records</div>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        This subscription tier is billed at a fixed rate and does not accrue metered volume or page overage charges.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Visual Usage Summary & Progress Bar */}
                      <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-zinc-900">Historical Consumption Pace</div>
                            <div className="text-[11px] text-zinc-500">
                              Average monthly volume vs. contracted plan allowance
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-zinc-900 tabular-nums">
                              {avgUtilizationPct}%
                            </span>
                            <span className="text-[11px] text-zinc-500 ml-1">contracted volume</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                avgUtilizationPct > 100 ? 'bg-rose-600' : 'bg-canon'
                              }`}
                              style={{ width: `${Math.min(100, avgUtilizationPct)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 tabular-nums">
                            <span>0 units</span>
                            <span>
                              {totalUnitsUsed.toLocaleString()} used of {totalAllowance.toLocaleString()} included
                            </span>
                          </div>
                        </div>

                        {totalOveragesCost > 0 && (
                          <div className="rounded-lg bg-red-50/70 border border-red-200/60 p-3 text-xs text-red-800 flex items-center justify-between">
                            <span>Total Historical Overage Invoiced</span>
                            <span className="font-bold tabular-nums">{formatCurrency(totalOveragesCost)}</span>
                          </div>
                        )}
                      </div>

                      {/* Monthly Usage Ledger Table */}
                      <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                        <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/50">
                          <h4 className="text-xs font-semibold text-zinc-900">Monthly Usage Log</h4>
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                              <th className="px-4 py-2.5">Billing Month</th>
                              <th className="px-4 py-2.5 text-right">Units Used</th>
                              <th className="px-4 py-2.5 text-right">Allowance</th>
                              <th className="px-4 py-2.5 text-center">Utilization</th>
                              <th className="px-4 py-2.5 text-right">Overage</th>
                              <th className="px-4 py-2.5 text-right">Fee</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 tabular-nums">
                            {detail.usageHistory.map((u) => {
                              const rowPct = Math.round((u.unitsUsed / u.includedAllowance) * 100);
                              return (
                                <tr key={u.id} className="hover:bg-zinc-50/70 transition-colors">
                                  <td className="px-4 py-3 font-medium text-zinc-800">
                                    {u.billingMonth}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                                    {u.unitsUsed.toLocaleString()}{' '}
                                    <span className="text-[11px] font-normal text-zinc-500">{u.unitLabel}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-zinc-600">
                                    {u.includedAllowance.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                        rowPct > 100
                                          ? 'bg-rose-50 text-rose-700 font-semibold'
                                          : 'bg-zinc-100 text-zinc-700'
                                      }`}
                                    >
                                      {rowPct}%
                                    </span>
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-right font-medium ${
                                      u.overageUnits > 0 ? 'text-rose-700 font-semibold' : 'text-zinc-400'
                                    }`}
                                  >
                                    {u.overageUnits > 0 ? `+${u.overageUnits.toLocaleString()}` : '0'}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                                    {formatCurrency(u.overageCost)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: SERVICE ACTIVITY */}
              {activeTab === 'service' && (
                <div className="space-y-6">
                  {detail.serviceEvents.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-10 text-center space-y-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                      <div className="text-sm font-semibold text-zinc-900">Operating Nominally</div>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        No service flags or incidents have been logged for this agreement. All hardware, firmware, and endpoint monitoring parameters are healthy.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Flag Summary Banner */}
                      {openFlagCount > 0 ? (
                        <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 p-4 text-xs text-rose-900 flex items-start gap-3">
                          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold">
                              {openFlagCount} Open Service Flag{openFlagCount > 1 ? 's' : ''} Require Attention
                            </div>
                            <p className="mt-0.5 text-[11px] text-rose-800">
                              Service visits or maintenance checks have been triggered by automated device telemetry.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-xs text-emerald-900 flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>All recorded service activities and diagnostic visits are marked resolved.</span>
                        </div>
                      )}

                      {/* Event Cards */}
                      <div className="space-y-3">
                        {detail.serviceEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-2.5 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                {evt.resolved ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <div className="text-xs font-semibold text-zinc-900">
                                    {evt.description}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                                    <span className="font-mono">{evt.id}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{evt.occurredAt}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{evt.deviceModel}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                    evt.severity === 'high'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                      : evt.severity === 'medium'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                        : 'bg-zinc-100 text-zinc-600'
                                  }`}
                                >
                                  {evt.severity}
                                </span>
                                <span
                                  className={`text-[11px] font-semibold ${
                                    evt.resolved ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {evt.resolved ? 'Resolved' : 'Open Flag'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
