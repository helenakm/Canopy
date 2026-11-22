import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Lock,
  PieChart,
  Printer,
  Server,
  TrendingDown,
} from 'lucide-react';
import { canopyApi } from '../api';
import {
  formatCategoryBadge,
  formatCategoryLabel,
  formatCurrency,
  formatStatusText,
} from '../components/CanonLogo';
import { EmbeddedAiBar } from '../components/EmbeddedAiBar';
import type { DashboardPayload, DemoUser, SubscriptionCategory } from '../types';

export interface SubscriptionPresetFilter {
  type?: string;
  status?: string;
  renewalWindow?: string;
  dealerId?: string;
  customerId?: string;
}

interface Props {
  currentUser: DemoUser;
  onOpenFilteredSubscriptions: (preset: SubscriptionPresetFilter) => void;
  onSelectSubscription: (id: string) => void;
  onOpenInsights: () => void;
}

const CATEGORY_COLORS: Record<SubscriptionCategory, { stroke: string; bg: string; fill: string; text: string }> = {
  hardware_maintenance: {
    stroke: '#CC0000',
    bg: 'bg-red-500',
    fill: '#FEE2E2',
    text: 'text-red-700',
  },
  software_licence: {
    stroke: '#2563EB',
    bg: 'bg-blue-600',
    fill: '#DBEAFE',
    text: 'text-blue-700',
  },
  managed_it: {
    stroke: '#0D9488',
    bg: 'bg-teal-600',
    fill: '#CCFBF1',
    text: 'text-teal-700',
  },
};

export function HomePage({
  currentUser,
  onOpenFilteredSubscriptions,
  onSelectSubscription,
  onOpenInsights,
}: Props) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<SubscriptionCategory | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    canopyApi
      .getDashboard()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load dashboard view.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const firstName = currentUser.name.split(' ')[0];

  const roleSubtitle =
    currentUser.role === 'canon_admin'
      ? 'Unified portfolio oversight across Canon Canada partners. Customer details protected under PIPEDA.'
      : currentUser.role === 'dealer'
        ? `Customer portfolio and commercial management for ${currentUser.organization.replace(/ \(Dealer [AB]\)/, '')}.`
        : `Your active hardware, software licences, and managed IT services for ${currentUser.organization}.`;

  // Compute donut chart geometry
  const totalSubCount = data
    ? data.categoryBreakdown.reduce((acc, c) => acc + c.count, 0)
    : 0;

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let accumulatedDash = 0;

  const donutSegments = (data?.categoryBreakdown || []).map((cat) => {
    const fraction = totalSubCount > 0 ? cat.count / totalSubCount : 0;
    const strokeDash = fraction * circumference;
    const offset = -accumulatedDash;
    accumulatedDash += strokeDash;
    const percentage = totalSubCount > 0 ? Math.round(fraction * 100) : 0;
    return {
      ...cat,
      percentage,
      strokeDash,
      offset,
      colors: CATEGORY_COLORS[cat.category] || {
        stroke: '#71717A',
        bg: 'bg-zinc-500',
        fill: '#F4F4F5',
        text: 'text-zinc-700',
      },
    };
  });

  // Compute horizontal bar chart values
  const maxBarValue = data
    ? currentUser.role === 'canon_admin'
      ? Math.max(1, ...data.dealerPerformance.map((d) => d.monthlyValue))
      : Math.max(1, ...data.categoryBreakdown.map((c) => c.monthlySpend))
    : 1;

  return (
    <div className="space-y-8">
      {/* 1. Header with Personalized Greeting & PIPEDA Protection Badge */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{roleSubtitle}</p>
        </div>

        {currentUser.role === 'canon_admin' && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs">
            <Lock className="h-3.5 w-3.5 text-canon" />
            <span>Customer details protected (PIPEDA compliant)</span>
          </div>
        )}
      </div>

      {/* 2. Prominent AI Question Bar (Exclusive to Overview Homepage) */}
      <EmbeddedAiBar
        currentUser={currentUser}
        variant="prominent"
        onSelectSubscription={onSelectSubscription}
      />

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-xl border border-zinc-200 bg-white animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 rounded-xl border border-zinc-200 bg-white animate-pulse" />
            <div className="h-72 rounded-xl border border-zinc-200 bg-white animate-pulse" />
          </div>
        </div>
      ) : error || !data ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error || 'Dashboard data unavailable.'}
        </div>
      ) : (
        <>
          {/* 3. Four Prominent Clickable KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Active Subscriptions */}
            <button
              type="button"
              onClick={() => onOpenFilteredSubscriptions({ status: 'all', type: 'all', renewalWindow: 'all' })}
              className="text-left rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-canon transition-all group shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-400 group-hover:text-canon transition-colors" />
                  Active Subscriptions
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-canon group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 tabular-nums">
                {data.kpis.activeSubscriptions}
              </div>
              <div className="mt-1.5 text-xs text-zinc-500">
                {currentUser.role === 'customer'
                  ? 'Across hardware, software & IT'
                  : 'Total active client agreements'}
              </div>
            </button>

            {/* KPI 2: Monthly Portfolio Value / Monthly Spend */}
            <button
              type="button"
              onClick={() => onOpenFilteredSubscriptions({ status: 'all', type: 'all', renewalWindow: 'all' })}
              className="text-left rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-canon transition-all group shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-400 group-hover:text-canon transition-colors" />
                  {currentUser.role === 'customer' ? 'Monthly Spend' : 'Monthly Portfolio Value'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-canon group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 tabular-nums">
                {formatCurrency(data.kpis.monthlyRecurringTotal)}
              </div>
              <div className="mt-1.5 text-xs text-zinc-500">
                {currentUser.role === 'customer'
                  ? 'Normalized monthly commitment'
                  : 'Recurring monthly contract revenue'}
              </div>
            </button>

            {/* KPI 3: Open Service Alerts */}
            <button
              type="button"
              onClick={() => onOpenFilteredSubscriptions({ status: 'attention_required', type: 'all', renewalWindow: 'all' })}
              className="text-left rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-canon transition-all group shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-zinc-400 group-hover:text-canon transition-colors" />
                  Open Service Alerts
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-canon group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-zinc-900 tabular-nums">
                  {data.kpis.openServiceFlagsCount}
                </span>
                {data.kpis.openServiceFlagsCount > 0 ? (
                  <span className="text-xs font-semibold text-red-600">Requires review</span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600">Healthy</span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-zinc-500">
                {data.kpis.openServiceFlagsCount > 0
                  ? 'Hardware alerts or capacity limits'
                  : 'All monitored devices nominal'}
              </div>
            </button>

            {/* KPI 4: Upcoming Renewals (Due within 90 days) */}
            <button
              type="button"
              onClick={() => onOpenFilteredSubscriptions({ renewalWindow: '90d', status: 'all', type: 'all' })}
              className="text-left rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-canon transition-all group shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-zinc-400 group-hover:text-canon transition-colors" />
                  Upcoming Renewals
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-canon group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-zinc-900 tabular-nums">
                  {data.kpis.upcomingRenewalsCount}
                </span>
                {data.kpis.upcomingRenewalsCount > 0 && (
                  <span className="text-xs font-semibold text-amber-700">Due within 90 days</span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-zinc-500">
                Click to inspect expiring agreements
              </div>
            </button>
          </div>

          {/* 4. Two Meaningful Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual 1: Donut Chart - Subscription Distribution by Category */}
            <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-canon" />
                    Subscription Distribution
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Breakdown across hardware, software, and managed IT services
                  </p>
                </div>
                <span className="text-xs font-medium text-zinc-500">
                  {totalSubCount} total
                </span>
              </div>

              {/* Donut Graphic + Legend Split */}
              <div className="py-6 flex flex-col sm:flex-row items-center justify-around gap-6">
                {/* SVG Donut */}
                <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke="#F4F4F5"
                      strokeWidth="20"
                    />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.category}
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke={seg.colors.stroke}
                        strokeWidth={hoveredCategory === seg.category ? '24' : '20'}
                        strokeDasharray={`${seg.strokeDash} ${circumference}`}
                        strokeDashoffset={seg.offset}
                        strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(seg.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={() => onOpenFilteredSubscriptions({ type: seg.category })}
                      />
                    ))}
                  </svg>
                  {/* Center Stat */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 tabular-nums">
                      {hoveredCategory
                        ? donutSegments.find((s) => s.category === hoveredCategory)?.count || totalSubCount
                        : totalSubCount}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-500">
                      {hoveredCategory
                        ? formatCategoryLabel(hoveredCategory)
                        : 'Agreements'}
                    </span>
                  </div>
                </div>

                {/* Interactive Legend Items */}
                <div className="space-y-2.5 w-full max-w-[260px]">
                  {donutSegments.map((seg) => {
                    const isHovered = hoveredCategory === seg.category;
                    return (
                      <button
                        key={seg.category}
                        type="button"
                        onClick={() => onOpenFilteredSubscriptions({ type: seg.category })}
                        onMouseEnter={() => setHoveredCategory(seg.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          isHovered
                            ? 'border-zinc-400 bg-zinc-50 shadow-2xs'
                            : 'border-zinc-100 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: seg.colors.stroke }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-zinc-800 truncate">
                              {seg.label}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {seg.percentage}% of portfolio
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-zinc-900 tabular-nums">
                            {seg.count}
                          </div>
                          <div className="text-[11px] text-zinc-500 tabular-nums">
                            {formatCurrency(seg.monthlySpend)}/mo
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 text-center text-[11px] text-zinc-500">
                Click any slice or category above to filter agreements
              </div>
            </div>

            {/* Visual 2: Horizontal Bar Chart - Role-Specific Comparison */}
            <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-canon" />
                    {currentUser.role === 'canon_admin'
                      ? 'Partner Portfolio Comparison'
                      : currentUser.role === 'dealer'
                        ? 'Customer Portfolio Distribution'
                        : 'Category Spend Allocation'}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {currentUser.role === 'canon_admin'
                      ? 'Monthly recurring revenue and service flag exposure by dealer'
                      : currentUser.role === 'dealer'
                        ? 'Monthly subscription value across customer accounts'
                        : 'Monthly spend normalized across service categories'}
                  </p>
                </div>
              </div>

              <div className="py-4 space-y-4">
                {currentUser.role === 'canon_admin' ? (
                  data.dealerPerformance.map((dp) => {
                    const barWidth = Math.max(8, Math.round((dp.monthlyValue / maxBarValue) * 100));
                    return (
                      <button
                        key={dp.dealerId}
                        type="button"
                        onClick={() => onOpenFilteredSubscriptions({ dealerId: dp.dealerId })}
                        className="w-full text-left group p-2.5 rounded-lg hover:bg-zinc-50/80 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-zinc-900 group-hover:text-canon transition-colors">
                            {dp.dealerName} ({dp.partnerTier})
                          </span>
                          <span className="font-bold text-zinc-900 tabular-nums">
                            {formatCurrency(dp.monthlyValue)}/mo
                          </span>
                        </div>
                        {/* Horizontal Bar */}
                        <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-canon rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{dp.subscriptionCount} active contracts · {dp.region}</span>
                          <span className={dp.openFlags > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700'}>
                            {dp.openFlags} open alerts
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  data.categoryBreakdown.map((cat) => {
                    const barWidth = Math.max(8, Math.round((cat.monthlySpend / maxBarValue) * 100));
                    const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.hardware_maintenance;
                    return (
                      <button
                        key={cat.category}
                        type="button"
                        onClick={() => onOpenFilteredSubscriptions({ type: cat.category })}
                        className="w-full text-left group p-2.5 rounded-lg hover:bg-zinc-50/80 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-zinc-900 group-hover:text-canon transition-colors">
                            {cat.label}
                          </span>
                          <span className="font-bold text-zinc-900 tabular-nums">
                            {formatCurrency(cat.monthlySpend)}/mo
                          </span>
                        </div>
                        <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: colors.stroke,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{cat.count} contracts in portfolio</span>
                          <span className="tabular-nums">
                            {data.kpis.monthlyRecurringTotal > 0
                              ? `${Math.round((cat.monthlySpend / data.kpis.monthlyRecurringTotal) * 100)}% of monthly total`
                              : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 text-center text-[11px] text-zinc-500">
                Click any bar to filter agreements
              </div>
            </div>
          </div>

          {/* 5. Compact Prioritized Action Center: Alerts, Renewals & Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Prioritized Action Center */}
            <div className="lg:col-span-2 rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Prioritized Action Center
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Critical alerts, upcoming renewals, and verified cost savings
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenInsights}
                  className="text-xs font-semibold text-canon hover:text-canon-dark whitespace-nowrap shrink-0"
                >
                  All Insights &rarr;
                </button>
              </div>

              {data.topInsights.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  All contracts and equipment are operating within normal parameters.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {data.topInsights.map((ins) => (
                    <div
                      key={ins.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/60 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          {ins.category === 'requires_attention' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                          ) : ins.category === 'cost_optimization' ? (
                            <TrendingDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : ins.category === 'upcoming_renewal' ? (
                            <CalendarClock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          )}
                          <span className="font-semibold text-zinc-700 capitalize">
                            {ins.category.replace('_', ' ')}
                          </span>
                          <span aria-hidden="true" className="text-zinc-300">·</span>
                          <span className="text-zinc-500 truncate">{ins.customerLabel}</span>
                          {ins.estimatedAnnualSavings && (
                            <>
                              <span aria-hidden="true" className="text-zinc-300">·</span>
                              <span className="text-emerald-700 font-semibold tabular-nums">
                                Save {formatCurrency(ins.estimatedAnnualSavings)}/yr
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-900 leading-snug">
                          {ins.title}
                        </h3>
                        <p className="text-xs text-zinc-600 line-clamp-2">
                          {ins.recommendedAction}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectSubscription(ins.subscriptionId)}
                        className="rounded-lg border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:border-canon hover:text-canon transition-colors whitespace-nowrap shrink-0 self-start sm:self-center shadow-2xs"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Renewals Panel */}
            <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
              <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Upcoming Renewals
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Contracts expiring within 90 days
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFilteredSubscriptions({ renewalWindow: '90d' })}
                  className="text-xs font-semibold text-canon hover:text-canon-dark whitespace-nowrap shrink-0"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="divide-y divide-zinc-100">
                {data.upcomingRenewals.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    No agreements expiring in the next 90 days.
                  </div>
                ) : (
                  data.upcomingRenewals.slice(0, 5).map((sub) => {
                    const st = formatStatusText(sub.status);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSelectSubscription(sub.id)}
                        className="w-full text-left px-5 py-3.5 hover:bg-zinc-50 transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-900 group-hover:text-canon transition-colors truncate">
                            {sub.product}
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
                            {formatCategoryLabel(sub.subscriptionType)} · {sub.customerDisplayLabel}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-medium text-zinc-900 tabular-nums">
                            {sub.renewalDate}
                          </div>
                          <div className={`text-[11px] font-medium ${st.colorClass}`}>
                            {st.label}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
