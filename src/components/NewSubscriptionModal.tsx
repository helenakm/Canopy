import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { canopyApi } from '../api';
import type {
  BillingFrequency,
  DemoUser,
  SanitizedCustomer,
  SubscriptionCategory,
  SubscriptionPlan,
  SubscriptionTypeDefinition,
} from '../types';

interface Props {
  open: boolean;
  currentUser: DemoUser;
  onClose: () => void;
  onCreated: (newId: string) => void;
}

export function NewSubscriptionModal({ open, currentUser, onClose, onCreated }: Props) {
  const [typeDefs, setTypeDefs] = useState<SubscriptionTypeDefinition[]>([]);
  const [customers, setCustomers] = useState<SanitizedCustomer[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedType, setSelectedType] = useState<SubscriptionCategory>('hardware_maintenance');
  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [product, setProduct] = useState('');
  const [startDate, setStartDate] = useState('2026-11-21');
  const [renewalDate, setRenewalDate] = useState('2027-11-21');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly');
  const [cost, setCost] = useState('420');
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean>>({
    tonerIncluded: true,
    autoRenew: true,
    maintenanceStatus: 'Active',
    subscriptionTier: 'Pro',
    supportLevel: '24/7 Gold',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    canopyApi
      .getMetadata()
      .then((meta) => {
        setTypeDefs(meta.subscriptionTypes);
        setCustomers(meta.customers);
        setPlans(meta.plans);
        if (meta.customers.length > 0) setCustomerId(meta.customers[0].id);
        const match = meta.plans.find((p) => p.subscriptionType === selectedType);
        if (match) {
          setPlanId(match.id);
          setCost(String(match.baseCost));
          setBillingFrequency(match.billingFrequency);
        }
      })
      .finally(() => setLoading(false));
  }, [open, currentUser.id]);

  if (!open) return null;

  const currentTypeDef = typeDefs.find((t) => t.id === selectedType);
  const filteredPlans = plans.filter((p) => p.subscriptionType === selectedType);

  const handleTypeChange = (nextType: SubscriptionCategory) => {
    setSelectedType(nextType);
    const firstPlan = plans.find((p) => p.subscriptionType === nextType);
    if (firstPlan) {
      setPlanId(firstPlan.id);
      setCost(String(firstPlan.baseCost));
      setBillingFrequency(firstPlan.billingFrequency);
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await canopyApi.createSubscription({
        customerId,
        planId,
        product,
        subscriptionType: selectedType,
        startDate,
        renewalDate,
        billingFrequency,
        cost: Number(cost),
        customFields: customValues,
      });
      setProduct('');
      onCreated(res.subscription.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create subscription.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Add New Subscription</h2>
            <p className="text-xs text-zinc-500">
              Fields adapt automatically to the selected subscription category
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loading ? (
            <div className="h-48 rounded-lg bg-zinc-100 animate-pulse" />
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  Subscription Type
                </label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {typeDefs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTypeChange(t.id)}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        selectedType === t.id
                          ? 'border-canon bg-red-50/40'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-zinc-900">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Customer *</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organizationName ? `${c.organizationName} (${c.id})` : c.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">Plan Template</label>
                  <select
                    value={planId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setPlanId(nextId);
                      const p = plans.find((x) => x.id === nextId);
                      if (p) {
                        setCost(String(p.baseCost));
                        setBillingFrequency(p.billingFrequency);
                        if (p.tonerIncluded !== undefined) {
                          setCustomValues((prev) => ({ ...prev, tonerIncluded: p.tonerIncluded! }));
                        }
                      }
                    }}
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                  >
                    {filteredPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.baseCost}/{p.billingFrequency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-700">
                    Product or Agreement Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="e.g. Canon imageRUNNER ADVANCE DX C5860i Maintenance"
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-xs font-mono text-zinc-900 focus:border-canon focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">Renewal Date *</label>
                  <input
                    type="date"
                    required
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-xs font-mono text-zinc-900 focus:border-canon focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">Billing Cycle *</label>
                  <select
                    value={billingFrequency}
                    onChange={(e) => setBillingFrequency(e.target.value as BillingFrequency)}
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">Cost (CAD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-xs font-mono text-zinc-900 focus:border-canon focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-700">
                    {currentTypeDef?.name} Details
                  </h3>
                  {selectedType === 'hardware_maintenance' &&
                    customValues.tonerIncluded === false && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Toner excluded — toner options hidden
                      </span>
                    )}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentTypeDef?.fields
                    .filter((field) => {
                      if (!field.conditionalHideWhen) return true;
                      return (
                        customValues[field.conditionalHideWhen.fieldKey] !==
                        field.conditionalHideWhen.equalsValue
                      );
                    })
                    .map((field) => {
                      const val = customValues[field.key];
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-zinc-700">
                            {field.label}
                            {field.required ? ' *' : ''}
                          </label>
                          {field.dataType === 'boolean' ? (
                            <div className="mt-1.5 flex items-center gap-2 h-8">
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                onChange={(e) =>
                                  setCustomValues((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 accent-canon"
                              />
                              <span className="text-xs text-zinc-600">
                                {val ? 'Included' : 'Excluded'}
                              </span>
                            </div>
                          ) : field.dataType === 'select' ? (
                            <select
                              required={field.required}
                              value={String(val ?? field.options?.[0] ?? '')}
                              onChange={(e) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                            >
                              {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                field.dataType === 'number'
                                  ? 'number'
                                  : field.dataType === 'date'
                                    ? 'date'
                                    : 'text'
                              }
                              required={field.required}
                              value={String(val ?? '')}
                              onChange={(e) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.key]:
                                    field.dataType === 'number'
                                      ? e.target.value === ''
                                        ? ''
                                        : Number(e.target.value)
                                      : e.target.value,
                                }))
                              }
                              className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark disabled:opacity-45"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {submitting ? 'Saving...' : 'Create Subscription'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
