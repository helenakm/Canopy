import type { SubscriptionCategory, SubscriptionStatus, UserRole } from '../types';

export function CanonInspiredMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="8" fill="#CC0000" />
      <path
        d="M24.2 12.6C22.7 11.1 20.6 10.2 18.2 10.2C13.5 10.2 9.8 13.7 9.8 18C9.8 22.3 13.5 25.8 18.2 25.8C20.6 25.8 22.7 24.9 24.2 23.4"
        stroke="white"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <path
        d="M18.2 14.5C20.1 14.5 21.7 16.1 21.7 18C21.7 19.9 20.1 21.5 18.2 21.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function formatRoleLabel(role: UserRole): string {
  if (role === 'canon_admin') return 'Canon Administrator';
  if (role === 'dealer') return 'Authorized Dealer';
  return 'Customer';
}

export function formatCategoryLabel(category: SubscriptionCategory): string {
  if (category === 'hardware_maintenance') return 'Hardware & Maintenance';
  if (category === 'software_licence') return 'Software Licence';
  return 'Managed IT Services';
}

export function formatDataSourceLabel(source: string | null | undefined): string {
  if (!source) return '';
  if (source === 'Canon eMaintenance Legacy') {
    return 'Canon Device Monitoring System (Simulated)';
  }
  return source;
}

export function formatStatusText(status: SubscriptionStatus): {
  label: string;
  colorClass: string;
  dotClass: string;
  bgClass: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        colorClass: 'text-emerald-700',
        dotClass: 'bg-emerald-500',
        bgClass: 'bg-emerald-50/80 border-emerald-200/60',
      };
    case 'renewal_due':
      return {
        label: 'Renewal Due',
        colorClass: 'text-amber-700',
        dotClass: 'bg-amber-500',
        bgClass: 'bg-amber-50/80 border-amber-200/60',
      };
    case 'attention_required':
      return {
        label: 'Attention Required',
        colorClass: 'text-rose-700',
        dotClass: 'bg-rose-500',
        bgClass: 'bg-rose-50/80 border-rose-200/60',
      };
    case 'suspended':
      return {
        label: 'Suspended',
        colorClass: 'text-zinc-600',
        dotClass: 'bg-zinc-400',
        bgClass: 'bg-zinc-100 border-zinc-200/60',
      };
  }
}

export function formatCategoryBadge(category: SubscriptionCategory): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (category) {
    case 'hardware_maintenance':
      return {
        label: 'Hardware & Maintenance',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200/60',
        dotClass: 'bg-blue-500',
      };
    case 'software_licence':
      return {
        label: 'Software Licence',
        badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200/60',
        dotClass: 'bg-purple-500',
      };
    case 'managed_it':
      return {
        label: 'Managed IT Services',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200/70',
        dotClass: 'bg-slate-500',
      };
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
