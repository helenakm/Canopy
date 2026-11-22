import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { canopyApi } from '../api';
import { formatCurrency } from '../components/CanonLogo';
import type { DemoUser, ProactiveInsight } from '../types';

interface Props {
  currentUser: DemoUser;
  onSelectSubscription: (id: string) => void;
}

const CATEGORY_TABS: Array<{
  id: 'all' | ProactiveInsight['category'];
  label: string;
  icon: typeof AlertTriangle;
}> = [
  { id: 'all', label: 'All Recommendations', icon: Sparkles },
  { id: 'requires_attention', label: 'Service Alerts', icon: AlertTriangle },
  { id: 'cost_optimization', label: 'Cost Savings', icon: TrendingDown },
  { id: 'upcoming_renewal', label: 'Renewals', icon: CalendarClock },
  { id: 'growth_opportunity', label: 'Capacity & Growth', icon: TrendingUp },
];

export function InsightsPage({ currentUser, onSelectSubscription }: Props) {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [summary, setSummary] = useState<{
    totalInsights: number;
    requiresAttentionCount: number;
    costOptimizationCount: number;
    growthOpportunityCount: number;
    upcomingRenewalCount: number;
    totalMonthlySavings: number;
    totalAnnualSavings: number;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProactiveInsight['category']>('all');
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBriefing(null);
    setBriefingError(null);
    canopyApi
      .getInsights()
      .then((res) => {
        if (!cancelled) {
          setInsights(res.insights);
          setSummary(res.summary);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const handleGenerateBriefing = async () => {
    setBriefingLoading(true);
    setBriefingError(null);
    try {
      const res = await canopyApi.generateInsightsBriefing();
      setBriefing(res.briefing);
    } catch (err) {
      setBriefingError(
        err instanceof Error ? err.message : 'Unable to generate executive briefing.',
      );
    } finally {
      setBriefingLoading(false);
    }
  };

  const filteredInsights =
    selectedCategory === 'all'
      ? insights
      : insights.filter((i) => i.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Insights &amp; Decisions</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Plain-language recommendations grounded in actual usage, contract renewals, and equipment telemetry.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateBriefing}
          disabled={briefingLoading || insights.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {briefingLoading ? 'Synthesizing...' : 'Summarize Insights'}
        </button>
      </div>

      {/* Advisory Banner (Mandatory Governance Clause) */}
      <div className="flex items-start gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 text-xs text-zinc-700 shadow-2xs">
        <Info className="h-4 w-4 text-canon shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-zinc-900">Non-binding Advisory Notice: </span>
          Recommendations are calculated for decision support and never alter signed agreements automatically. Plan adjustments require human authorization and partner agreement.
        </div>
      </div>

      {briefingError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          {briefingError}
        </div>
      )}

      {briefing && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 space-y-2 shadow-2xs">
          <div className="text-xs font-semibold text-canon flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Executive Briefing Summary
          </div>
          <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-line">
            {briefing}
          </p>
        </div>
      )}

      {/* Executive Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedCategory === tab.id;
          const count =
            tab.id === 'all'
              ? insights.length
              : tab.id === 'requires_attention'
                ? summary?.requiresAttentionCount || 0
                : tab.id === 'cost_optimization'
                  ? summary?.costOptimizationCount || 0
                  : tab.id === 'upcoming_renewal'
                    ? summary?.upcomingRenewalCount || 0
                    : summary?.growthOpportunityCount || 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all whitespace-nowrap border ${
                isSelected
                  ? 'border-canon bg-white text-zinc-900 shadow-2xs font-semibold'
                  : 'border-zinc-200/80 bg-white/70 text-zinc-600 hover:bg-white hover:text-zinc-900'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  isSelected ? 'text-canon' : 'text-zinc-400'
                }`}
              />
              <span>{tab.label}</span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-600">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-xl border border-zinc-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          No insights found under this category.
        </div>
      ) : (
        /* Visual Decision Cards */
        <div className="space-y-4">
          {filteredInsights.map((ins) => {
            const isExpanded = expandedInsightId === ins.id;
            const isCost = ins.category === 'cost_optimization';
            const isAlert = ins.category === 'requires_attention';
            const isRenewal = ins.category === 'upcoming_renewal';
            const isGrowth = ins.category === 'growth_opportunity';

            return (
              <div
                key={ins.id}
                className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs transition-all hover:border-zinc-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Left: Prominent Category Metric / Countdown + Core Description */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Hero Metric Block */}
                    <div className="shrink-0 text-center">
                      {isCost && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3 min-w-[120px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">
                            Annual Savings
                          </div>
                          <div className="text-xl font-bold text-emerald-800 tabular-nums mt-0.5">
                            {formatCurrency(ins.estimatedAnnualSavings || 0)}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">
                            {formatCurrency(ins.estimatedMonthlySavings || 0)}/mo
                          </div>
                        </div>
                      )}

                      {isAlert && (
                        <div className="rounded-xl bg-red-50 border border-red-200/80 p-3 min-w-[120px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-red-700">
                            Active Flags
                          </div>
                          <div className="text-2xl font-bold text-red-800 tabular-nums mt-0.5">
                            {ins.metrics.find((m) => m.label.toLowerCase().includes('flag'))?.value || 'Alert'}
                          </div>
                          <div className="text-[10px] text-red-600 font-semibold">
                            Immediate Action
                          </div>
                        </div>
                      )}

                      {isRenewal && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 min-w-[120px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-700">
                            Countdown
                          </div>
                          <div className="text-2xl font-bold text-amber-800 tabular-nums mt-0.5">
                            {ins.metrics.find((m) => m.label.toLowerCase().includes('day'))?.value || '90d'}
                          </div>
                          <div className="text-[10px] text-amber-700 font-medium">
                            Until Renewal
                          </div>
                        </div>
                      )}

                      {isGrowth && (
                        <div className="rounded-xl bg-blue-50 border border-blue-200/80 p-3 min-w-[120px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-blue-700">
                            Capacity
                          </div>
                          <div className="text-xl font-bold text-blue-800 tabular-nums mt-0.5">
                            {ins.metrics.find((m) => m.label.toLowerCase().includes('utilization') || m.label.toLowerCase().includes('used'))?.value || '92%'}
                          </div>
                          <div className="text-[10px] text-blue-600 font-medium">
                            Near Limit
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        <span className="font-semibold text-zinc-800">{ins.customerLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono bg-zinc-100 px-1 py-0.2 rounded text-[10px]">
                          {ins.subscriptionId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ins.product}</span>
                      </div>

                      <h2 className="text-base font-bold text-zinc-900 leading-snug">
                        {ins.title}
                      </h2>

                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {ins.summary}
                      </p>

                      {/* Plan Comparison Strip (for Cost Optimization) */}
                      {isCost && ins.currentPlanName && ins.recommendedPlanName && (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 border border-zinc-200/80">
                          <span className="text-zinc-500">Current Plan:</span>
                          <span className="font-semibold text-zinc-900">{ins.currentPlanName}</span>
                          <ArrowRight className="h-3 w-3 text-zinc-400" />
                          <span className="text-zinc-500">Recommended:</span>
                          <span className="font-bold text-emerald-700">{ins.recommendedPlanName}</span>
                        </div>
                      )}

                      <div className="text-xs text-zinc-700 font-medium pt-1">
                        <span className="text-zinc-500">Next Step: </span>
                        {ins.recommendedAction}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2 shrink-0 pt-2 lg:pt-0">
                    <button
                      type="button"
                      onClick={() => onSelectSubscription(ins.subscriptionId)}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 shadow-2xs flex items-center gap-1.5"
                    >
                      {isAlert ? (
                        <>
                          <Wrench className="h-3.5 w-3.5" />
                          <span>Schedule Service</span>
                        </>
                      ) : isRenewal ? (
                        <>
                          <CalendarClock className="h-3.5 w-3.5" />
                          <span>Review Renewal</span>
                        </>
                      ) : (
                        <>
                          <span>Inspect Agreement</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedInsightId(isExpanded ? null : ins.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Verification'}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Technical Explanations & Assumptions Accordion */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-zinc-100 text-xs space-y-3 bg-zinc-50/60 p-4 rounded-lg">
                    <div>
                      <div className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wider mb-1">
                        Technical Context &amp; Why It Matters
                      </div>
                      <p className="text-zinc-600 leading-relaxed">{ins.whyItMatters}</p>
                    </div>

                    {ins.calculationBreakdown && (
                      <div>
                        <div className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wider mb-1">
                          Calculation Methodology
                        </div>
                        <p className="font-mono text-[11px] text-zinc-700 bg-white p-2 rounded border border-zinc-200">
                          {ins.calculationBreakdown}
                        </p>
                      </div>
                    )}

                    {ins.assumptions && ins.assumptions.length > 0 && (
                      <div>
                        <div className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wider mb-1">
                          Underlying Verification Assumptions
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5 text-zinc-600 text-[11px]">
                          {ins.assumptions.map((asm, idx) => (
                            <li key={idx}>{asm}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200">
                      Advisory note: {ins.advisoryDisclaimer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
