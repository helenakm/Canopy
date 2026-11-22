import { useEffect, useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Home,
  Lightbulb,
  Settings,
} from 'lucide-react';
import { canopyApi } from './api';
import { formatRoleLabel } from './components/CanonLogo';
import { FloatingAiAssistant } from './components/FloatingAiAssistant';
import { SubscriptionDetailModal } from './components/SubscriptionDetailModal';
import { HomePage, type SubscriptionPresetFilter } from './pages/HomePage';
import { InsightsPage } from './pages/InsightsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import type { DemoUser } from './types';

type PageId = 'home' | 'subscriptions' | 'insights' | 'reports' | 'settings';

const PRIMARY_NAV: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'subscriptions', label: 'Subscriptions', icon: FileSpreadsheet },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [subscriptionPreset, setSubscriptionPreset] =
    useState<SubscriptionPresetFilter | null>(null);
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    canopyApi
      .getSession()
      .then((res) => {
        setCurrentUser(res.currentUser);
        setDemoUsers(res.demoUsers);
      })
      .catch((err) => {
        setSessionError(err instanceof Error ? err.message : 'Unable to initialize session.');
      });
  }, []);

  const handleSwitchAccount = async (accountId: string) => {
    if (!currentUser || accountId === currentUser.id) return;
    setSwitchingId(accountId);
    setSelectedSubscriptionId(null);
    setSubscriptionPreset(null);
    try {
      const res = await canopyApi.switchAccount(accountId);
      setCurrentUser(res.currentUser);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Unable to switch perspective.');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleOpenFilteredSubscriptions = (preset: SubscriptionPresetFilter) => {
    setSubscriptionPreset(preset);
    setActivePage('subscriptions');
  };

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800 shadow-2xs">
          <div className="font-semibold text-zinc-900">Session Initialization Error</div>
          <p className="mt-2">{sessionError}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-sm font-medium text-zinc-500">Loading Canopy workspace...</div>
      </div>
    );
  }

  const pageLabel =
    activePage === 'settings'
      ? 'Field & Billing Rules'
      : PRIMARY_NAV.find((n) => n.id === activePage)?.label || 'Overview';

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-zinc-900">
      {/* Streamlined Left Sidebar */}
      <aside className="w-64 shrink-0 border-r border-zinc-200/80 bg-white flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="px-5 py-4 border-b border-zinc-200/80 bg-white">
            <img
              src="/assets/aistudio/Screenshot_2026-11-21_at_3.58.27_PM_23f2879e.png"
              alt="Canopy"
              referrerPolicy="no-referrer"
              className="h-8 w-auto object-contain"
            />
            <div className="mt-1 text-[11px] font-medium text-zinc-500">
              Canon Canada Subscriptions
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="p-3 space-y-1" aria-label="Primary navigation">
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'subscriptions') setSubscriptionPreset(null);
                    setActivePage(item.id);
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-red-50/80 text-canon font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-canon' : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Secondary Navigation: Field & Billing Rules */}
          <div className="px-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setActivePage('settings')}
              className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activePage === 'settings'
                  ? 'bg-red-50/80 text-canon font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Settings
                className={`h-4 w-4 shrink-0 ${
                  activePage === 'settings' ? 'text-canon' : 'text-zinc-400'
                }`}
              />
              <span>Field &amp; Billing Rules</span>
            </button>
          </div>
        </div>

        {/* Portal Perspective (Role Governance Switcher) */}
        <div className="border-t border-zinc-200/80 p-4 bg-zinc-50/70 space-y-2.5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
              Portal Perspective
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500 leading-snug">
              Simulated view across authorization tiers
            </div>
          </div>

          <div className="space-y-1.5">
            {demoUsers.map((u) => {
              const isCurrent = u.id === currentUser.id;
              const isSwitching = switchingId === u.id;
              const roleSubtitle =
                u.role === 'canon_admin'
                  ? 'Canon Administrator'
                  : u.role === 'customer'
                    ? 'Customer, Maple Ridge Legal LLP (CUST-001)'
                    : u.id === 'dealer-north'
                      ? 'Dealer A, NorthStar Office Systems'
                      : u.id === 'dealer-pacific'
                        ? 'Dealer B, Pacific Print & Cloud'
                        : 'Authorized Dealer';

              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={Boolean(switchingId)}
                  onClick={() => handleSwitchAccount(u.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors ${
                    isCurrent
                      ? 'border-canon bg-white shadow-2xs'
                      : 'border-zinc-200/80 bg-white/70 hover:bg-white'
                  }`}
                >
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover border border-zinc-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-zinc-900">
                      {isSwitching ? 'Switching...' : u.name}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {roleSubtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Single-Row Top Bar */}
        <header className="h-15 border-b border-zinc-200 bg-white px-8 flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 min-w-0">
            <span className="font-semibold text-zinc-800 whitespace-nowrap shrink-0">Canopy</span>
            <span aria-hidden="true">/</span>
            <span className="truncate font-medium text-zinc-600">{pageLabel}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-full object-cover border border-zinc-200"
            />
            <div className="leading-tight text-right">
              <div className="text-xs font-semibold text-zinc-900 whitespace-nowrap">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-zinc-500 whitespace-nowrap">
                {formatRoleLabel(currentUser.role)}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            {activePage === 'home' && (
              <HomePage
                currentUser={currentUser}
                onOpenFilteredSubscriptions={handleOpenFilteredSubscriptions}
                onSelectSubscription={setSelectedSubscriptionId}
                onOpenInsights={() => setActivePage('insights')}
              />
            )}
            {activePage === 'subscriptions' && (
              <SubscriptionsPage
                currentUser={currentUser}
                presetFilter={subscriptionPreset}
                onClearPreset={() => setSubscriptionPreset(null)}
                onSelectSubscription={setSelectedSubscriptionId}
              />
            )}
            {activePage === 'insights' && (
              <InsightsPage
                currentUser={currentUser}
                onSelectSubscription={setSelectedSubscriptionId}
              />
            )}
            {activePage === 'reports' && (
              <ReportsPage
                currentUser={currentUser}
                onSelectSubscription={setSelectedSubscriptionId}
              />
            )}
            {activePage === 'settings' && (
              <SettingsPage
                currentUser={currentUser}
                onSelectSubscription={setSelectedSubscriptionId}
              />
            )}
          </div>
        </main>
      </div>

      <FloatingAiAssistant
        currentUser={currentUser}
        onSelectSubscription={setSelectedSubscriptionId}
        isOpen={isAssistantOpen}
        onToggle={() => setIsAssistantOpen((prev) => !prev)}
      />

      <SubscriptionDetailModal
        subscriptionId={selectedSubscriptionId}
        currentUser={currentUser}
        onClose={() => setSelectedSubscriptionId(null)}
      />
    </div>
  );
}
