import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HardDrive,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Printer,
  Search,
  Server,
  Users,
  X,
} from 'lucide-react';
import { canopyApi } from '../api';
import {
  formatCategoryBadge,
  formatCategoryLabel,
  formatCurrency,
  formatStatusText,
} from '../components/CanonLogo';
import { NewSubscriptionModal } from '../components/NewSubscriptionModal';
import type { Dealer, DemoUser, SubscriptionCategory, SubscriptionView } from '../types';
import type { SubscriptionPresetFilter } from './HomePage';

interface Props {
  currentUser: DemoUser;
  presetFilter: SubscriptionPresetFilter | null;
  onClearPreset: () => void;
  onSelectSubscription: (id: string) => void;
}

const CATEGORY_TABS: Array<{
  id: 'all' | SubscriptionCategory;
  label: string;
  icon: typeof Layers;
}> = [
  { id: 'all', label: 'All Subscriptions', icon: Layers },
  { id: 'hardware_maintenance', label: 'Hardware & Maintenance', icon: Printer },
  { id: 'software_licence', label: 'Software Licences', icon: KeyRound },
  { id: 'managed_it', label: 'Managed IT Services', icon: Server },
];

export function SubscriptionsPage({
  currentUser,
  presetFilter,
  onClearPreset,
  onSelectSubscription,
}: Props) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionView[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);

  // View mode: default to 'cards' for customers, 'table' for dealers & Canon admin
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(
    currentUser.role === 'customer' ? 'cards' : 'table',
  );
  const [groupByCustomer, setGroupByCustomer] = useState(false);

  const [typeFilter, setTypeFilter] = useState<string>(presetFilter?.type || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(presetFilter?.status || 'all');
  const [renewalWindow, setRenewalWindow] = useState<string>(
    presetFilter?.renewalWindow || 'all',
  );
  const [dealerFilter, setDealerFilter] = useState<string>(presetFilter?.dealerId || 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (presetFilter) {
      setTypeFilter(presetFilter.type || 'all');
      setStatusFilter(presetFilter.status || 'all');
      setRenewalWindow(presetFilter.renewalWindow || 'all');
      setDealerFilter(presetFilter.dealerId || 'all');
    }
  }, [presetFilter]);

  useEffect(() => {
    canopyApi
      .getMetadata()
      .then((meta) => setDealers(meta.dealers))
      .catch(() => {});
  }, [currentUser.id]);

  const fetchList = () => {
    setLoading(true);
    setError(null);
    canopyApi
      .getSubscriptions({
        type: typeFilter,
        status: statusFilter,
        dealerId: dealerFilter,
        renewalWindow,
        search: searchTerm,
      })
      .then((res) => setSubscriptions(res.subscriptions))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load subscriptions.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, [currentUser.id, typeFilter, statusFilter, dealerFilter, renewalWindow, searchTerm]);

  const hasActiveFilter =
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    renewalWindow !== 'all' ||
    dealerFilter !== 'all' ||
    searchTerm.trim() !== '';

  const resetAllFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setRenewalWindow('all');
    setDealerFilter('all');
    setSearchTerm('');
    onClearPreset();
  };

  // Group subscriptions by customer account
  const customerGroups = subscriptions.reduce<Record<string, { label: string; dealerName: string; subs: SubscriptionView[] }>>(
    (acc, sub) => {
      const key = sub.customerId;
      if (!acc[key]) {
        acc[key] = {
          label: sub.customerDisplayLabel,
          dealerName: sub.dealerName,
          subs: [],
        };
      }
      acc[key].subs.push(sub);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Subscriptions</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {currentUser.role === 'canon_admin'
              ? 'Authorized subscription portfolio across Canon partners. Customer personal details are protected.'
              : currentUser.role === 'dealer'
                ? 'Agreements sold and managed by your dealership. Select any record to inspect telemetry and terms.'
                : 'Your organization’s active hardware, software licences, and managed IT services.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser.role === 'canon_admin' && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs">
              <Lock className="h-3.5 w-3.5 text-canon" />
              Customer details protected
            </span>
          )}

          {currentUser.role === 'dealer' && (
            <button
              type="button"
              onClick={() => setNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              New Subscription
            </button>
          )}
        </div>
      </div>

      {/* 1-Click Category Tabs + View Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = typeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap border ${
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
              </button>
            );
          })}
        </div>

        {/* View Options: Cards vs Table + Group by Customer */}
        <div className="flex items-center gap-2">
          {currentUser.role !== 'customer' && (
            <button
              type="button"
              onClick={() => setGroupByCustomer(!groupByCustomer)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                groupByCustomer
                  ? 'border-canon bg-red-50/50 text-canon font-semibold'
                  : 'border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Group by Customer</span>
            </button>
          )}

          {/* Cards vs Table Segmented Control */}
          <div className="inline-flex rounded-lg border border-zinc-200/80 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Cards View"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product, agreement ID, printer model, or customer..."
            className="h-9 w-full rounded-lg border border-zinc-200/80 bg-zinc-50/50 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-canon focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="h-9 rounded-lg border border-zinc-200/80 bg-white px-3 text-xs text-zinc-700 focus:border-canon focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="renewal_due">Renewal Due</option>
            <option value="attention_required">Requires Attention</option>
          </select>

          <select
            value={renewalWindow}
            onChange={(e) => setRenewalWindow(e.target.value)}
            aria-label="Filter by renewal window"
            className="h-9 rounded-lg border border-zinc-200/80 bg-white px-3 text-xs text-zinc-700 focus:border-canon focus:outline-none"
          >
            <option value="all">All Renewal Dates</option>
            <option value="30d">Due in 30 Days</option>
            <option value="90d">Due in 90 Days</option>
            <option value="2027">Expiring in 2027</option>
          </select>

          {currentUser.role === 'canon_admin' && (
            <select
              value={dealerFilter}
              onChange={(e) => setDealerFilter(e.target.value)}
              aria-label="Filter by issuing partner"
              className="h-9 rounded-lg border border-zinc-200/80 bg-white px-3 text-xs text-zinc-700 focus:border-canon focus:outline-none"
            >
              <option value="all">All Issuing Partners</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 h-9 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-56 rounded-xl border border-zinc-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          No subscriptions match the selected criteria.
        </div>
      ) : groupByCustomer && currentUser.role !== 'customer' ? (
        /* Grouped by Customer View */
        <div className="space-y-6">
          {Object.entries(customerGroups).map(([custKey, group]) => (
            <div key={custKey} className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-50/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-zinc-200/60 flex items-center justify-center text-zinc-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900">
                      {group.label}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Account: <span className="font-mono">{custKey}</span> · Partner: {group.dealerName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="font-semibold text-zinc-900">{group.subs.length}</span> agreements
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-zinc-900 tabular-nums">
                    {formatCurrency(group.subs.reduce((acc, s) => acc + s.monthlyEquivalentCost, 0))}/mo
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.subs.map((sub) => (
                    <SubscriptionCard
                      key={sub.id}
                      sub={sub}
                      onSelect={() => onSelectSubscription(sub.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'cards' ? (
        /* Flat Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              sub={sub}
              onSelect={() => onSelectSubscription(sub.id)}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-3.5">Product &amp; ID</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Renewal Date</th>
                <th className="px-5 py-3.5">
                  {currentUser.role === 'canon_admin'
                    ? 'Partner & Account'
                    : currentUser.role === 'dealer'
                      ? 'Customer Account'
                      : 'Issuing Partner'}
                </th>
                <th className="px-5 py-3.5 text-right">Contract Value</th>
                <th className="px-5 py-3.5">Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {subscriptions.map((sub) => {
                const st = formatStatusText(sub.status);
                const cat = formatCategoryBadge(sub.subscriptionType);
                const flagCount = Number(sub.visibleCustomFields.serviceFlags || 0);

                return (
                  <tr
                    key={sub.id}
                    onClick={() => onSelectSubscription(sub.id)}
                    className="cursor-pointer hover:bg-zinc-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 max-w-[260px]">
                      <div className="font-semibold text-zinc-900 truncate">{sub.product}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        <span className="font-mono bg-zinc-100 px-1 py-0.2 rounded text-[10px]">
                          {sub.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${cat.badgeClass}`}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[11px]">
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dotClass}`} />
                        <span className={st.colorClass}>{st.label}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-medium text-zinc-900 tabular-nums">
                        {sub.renewalDate}
                      </div>
                      <div className="text-[11px] text-zinc-500 capitalize">
                        {sub.billingFrequency}
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-[200px]">
                      <div className="font-medium text-zinc-900 truncate">
                        {sub.customerDisplayLabel}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {sub.dealerName}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="font-bold text-zinc-900 tabular-nums">
                        {formatCurrency(sub.monthlyEquivalentCost)}/mo
                      </div>
                      <div className="text-[11px] text-zinc-500 tabular-nums">
                        {formatCurrency(sub.cost)} ({sub.billingFrequency})
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {flagCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {flagCount} flag{flagCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Nominal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for creating subscriptions (Dealers only) */}
      {currentUser.role === 'dealer' && (
        <NewSubscriptionModal
          open={newModalOpen}
          currentUser={currentUser}
          onClose={() => setNewModalOpen(false)}
          onCreated={() => {
            setNewModalOpen(false);
            fetchList();
          }}
        />
      )}
    </div>
  );
}

/**
 * Dedicated SubscriptionCard component:
 * Clean, visual card rendering domain-specific telemetry and clear renewal indicators
 */
function SubscriptionCard({
  sub,
  onSelect,
}: {
  sub: SubscriptionView;
  onSelect: () => void;
}) {
  const st = formatStatusText(sub.status);
  const cat = formatCategoryBadge(sub.subscriptionType);
  const flagCount = Number(sub.visibleCustomFields.serviceFlags || 0);

  // Check if renewing within 90 days of 2026-11-21
  const diffDays = Math.round(
    (new Date(sub.renewalDate + 'T00:00:00Z').getTime() -
      new Date('2026-11-21T00:00:00Z').getTime()) /
      86400000,
  );
  const isRenewingSoon = diffDays >= 0 && diffDays <= 90;

  // Domain-specific telemetry variables
  const isHardware = sub.subscriptionType === 'hardware_maintenance';
  const isSoftware = sub.subscriptionType === 'software_licence';
  const isManagedIt = sub.subscriptionType === 'managed_it';

  const pagesUsed = Number(sub.visibleCustomFields.monthlyPageUsage || 0);
  const pageAllowance = Number(sub.visibleCustomFields.pageAllowance || 0);
  const licenceSeats = Number(sub.visibleCustomFields.licenceSeats || 0);
  const activeUtilization = Number(sub.visibleCustomFields.activeSeatUtilization || 0);
  const uptime = sub.visibleCustomFields.uptimePercentage;
  const capacity = sub.visibleCustomFields.capacityLimit;

  return (
    <div
      onClick={onSelect}
      className="text-left rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-canon transition-all cursor-pointer shadow-2xs flex flex-col justify-between group"
    >
      <div>
        {/* Category & Status Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            {isHardware ? (
              <Printer className="h-4 w-4 text-red-600" />
            ) : isSoftware ? (
              <KeyRound className="h-4 w-4 text-blue-600" />
            ) : (
              <Server className="h-4 w-4 text-teal-600" />
            )}
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${cat.badgeClass}`}>
              {cat.label}
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
            <span className={`h-1.5 w-1.5 rounded-full ${st.dotClass}`} />
            <span className={st.colorClass}>{st.label}</span>
          </span>
        </div>

        {/* Product Title & ID */}
        <div className="font-bold text-sm text-zinc-900 group-hover:text-canon transition-colors leading-snug line-clamp-1">
          {sub.product}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500 flex items-center gap-2">
          <span className="font-mono bg-zinc-100 px-1 py-0.2 rounded text-[10px]">
            {sub.id}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{sub.customerDisplayLabel}</span>
        </div>

        {/* Domain-Specific Telemetry Box */}
        <div className="mt-4 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 space-y-1.5 border border-zinc-100">
          {isHardware && (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Monthly Usage:</span>
                <span className="font-semibold text-zinc-800 tabular-nums">
                  {pagesUsed.toLocaleString()} / {pageAllowance.toLocaleString()} pages
                </span>
              </div>
              {!sub.tonerServiceExcluded && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Toner Service:</span>
                  <span className="text-zinc-800 font-medium">Included</span>
                </div>
              )}
              {flagCount > 0 ? (
                <div className="flex items-center justify-between text-[11px] text-red-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Open Service Flags:
                  </span>
                  <span>{flagCount}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-emerald-700">
                  <span>Maintenance Status:</span>
                  <span className="font-medium">Nominal</span>
                </div>
              )}
            </>
          )}

          {isSoftware && (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Licence Seats:</span>
                <span className="font-semibold text-zinc-800 tabular-nums">
                  {licenceSeats} total
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Utilization:</span>
                <span className="font-semibold text-zinc-800 tabular-nums">
                  {activeUtilization}% active
                </span>
              </div>
              {sub.visibleCustomFields.subscriptionTier && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Tier:</span>
                  <span className="text-zinc-800 font-medium">
                    {String(sub.visibleCustomFields.subscriptionTier)}
                  </span>
                </div>
              )}
            </>
          )}

          {isManagedIt && (
            <>
              {uptime && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Target Uptime:</span>
                  <span className="font-semibold text-zinc-800">{String(uptime)}</span>
                </div>
              )}
              {capacity && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Capacity:</span>
                  <span className="font-semibold text-zinc-800">{String(capacity)}</span>
                </div>
              )}
              {sub.visibleCustomFields.supportLevel && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">SLA:</span>
                  <span className="text-zinc-800 font-medium">
                    {String(sub.visibleCustomFields.supportLevel)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Card Footer: Pricing & Renewal Date */}
      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
        <div>
          <div className="font-bold text-zinc-900 tabular-nums">
            {formatCurrency(sub.monthlyEquivalentCost)}/mo
          </div>
          <div className="text-[10px] text-zinc-500 tabular-nums">
            {formatCurrency(sub.cost)} ({sub.billingFrequency})
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-700 tabular-nums">
            <Calendar className="h-3 w-3 text-zinc-400" />
            {sub.renewalDate}
          </div>
          {isRenewingSoon && (
            <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
              Due in {diffDays} days
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
