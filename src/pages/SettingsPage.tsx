import { useEffect, useState } from 'react';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { canopyApi } from '../api';
import { formatRoleLabel } from '../components/CanonLogo';
import type {
  AuditLogEntry,
  CustomFieldDataType,
  DemoUser,
  SubscriptionCategory,
  SubscriptionTypeDefinition,
} from '../types';

interface Props {
  currentUser: DemoUser;
  onSelectSubscription: (id: string) => void;
}

type SettingsTab = 'fields' | 'billing' | 'audit' | 'access';

export function SettingsPage({ currentUser, onSelectSubscription }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('fields');

  // Custom field builder state
  const [typeDefs, setTypeDefs] = useState<SubscriptionTypeDefinition[]>([]);
  const [schemaTargetType, setSchemaTargetType] =
    useState<SubscriptionCategory>('hardware_maintenance');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldDataType, setNewFieldDataType] = useState<CustomFieldDataType>('string');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldOptions, setNewFieldOptions] = useState('Option A, Option B');
  const [submittingSchema, setSubmittingSchema] = useState(false);
  const [schemaFeedback, setSchemaFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  // Billing rules demo state (executive toggles)
  const [autoRenewDefault, setAutoRenewDefault] = useState(true);
  const [noticeWindowDays, setNoticeWindowDays] = useState(90);
  const [netPaymentDays, setNetPaymentDays] = useState(30);
  const [requireTonerExclusionNotice, setRequireTonerExclusionNotice] = useState(true);
  const [overageGraceBufferPct, setOverageGraceBufferPct] = useState(5);
  const [billingSavedNotice, setBillingSavedNotice] = useState(false);

  // Audit logs state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    setSchemaFeedback(null);
    canopyApi
      .getMetadata()
      .then((meta) => setTypeDefs(meta.subscriptionTypes))
      .catch(() => {});

    setLoadingLogs(true);
    canopyApi
      .getAuditLogs()
      .then((res) => setLogs(res.auditLogs))
      .finally(() => setLoadingLogs(false));
  }, [currentUser.id]);

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSchema(true);
    setSchemaFeedback(null);
    try {
      const res = await canopyApi.addCustomField({
        subscriptionType: schemaTargetType,
        label: newFieldLabel,
        dataType: newFieldDataType,
        required: newFieldRequired,
        unit: newFieldUnit || undefined,
        options:
          newFieldDataType === 'select'
            ? newFieldOptions
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
      });
      setTypeDefs((prev) =>
        prev.map((t) => (t.id === res.subscriptionType.id ? res.subscriptionType : t)),
      );
      setSchemaFeedback({
        type: 'success',
        msg: `Added "${newFieldLabel}" to ${res.subscriptionType.name}. Subscriptions now track this specification.`,
      });
      setNewFieldLabel('');
      setNewFieldUnit('');
    } catch (err) {
      setSchemaFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Unable to add field.',
      });
    } finally {
      setSubmittingSchema(false);
    }
  };

  const handleSaveBillingRules = () => {
    setBillingSavedNotice(true);
    setTimeout(() => setBillingSavedNotice(false), 3000);
  };

  const currentTypeMeta = typeDefs.find((t) => t.id === schemaTargetType);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Field &amp; Billing Rules
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Contract field metadata, corporate billing governance terms, and verified audit ledger.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
          {[
            { id: 'fields', label: 'Field Configuration' },
            { id: 'billing', label: 'Billing Terms' },
            { id: 'audit', label: 'Audit Ledger' },
            { id: 'access', label: 'Access Governance' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. DYNAMIC FIELD CONFIGURATION AS VISUAL CARDS */}
      {activeTab === 'fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">
                  {currentTypeMeta?.name || 'Category'} Fields
                </h2>
                <p className="text-xs text-zinc-500">
                  Configured specifications attached to each agreement under this subscription type
                </p>
              </div>

              <select
                value={schemaTargetType}
                onChange={(e) => setSchemaTargetType(e.target.value as SubscriptionCategory)}
                className="h-9 rounded-lg border border-zinc-200/80 bg-white px-3 text-xs font-medium text-zinc-800 focus:border-canon focus:outline-none"
              >
                {typeDefs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Cards Grid for Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentTypeMeta?.fields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs space-y-2 hover:border-zinc-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-zinc-900">{field.label}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{field.key}</div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        field.required
                          ? 'bg-red-50 text-canon border border-red-200/60'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {field.required ? 'Mandatory' : 'Optional'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                    <span className="capitalize font-medium text-zinc-700">Type: {field.dataType}</span>
                    {field.unit && <span>Unit: {field.unit}</span>}
                    {field.options && <span>{field.options.length} options</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Field Card */}
          <form
            onSubmit={handleAddField}
            className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs h-fit"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-canon" />
              <h2 className="text-sm font-bold text-zinc-900">Define Custom Field</h2>
            </div>

            {currentUser.role !== 'canon_admin' && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 leading-snug">
                Only <span className="font-semibold">Canon HQ Administrators</span> can deploy global metadata specifications.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Field Label *</label>
              <input
                type="text"
                required
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g. Firmware Compliance Tier"
                disabled={currentUser.role !== 'canon_admin'}
                className="mt-1 h-9 w-full rounded-lg border border-zinc-200/80 px-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-canon focus:outline-none disabled:bg-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Data Type *</label>
              <select
                value={newFieldDataType}
                onChange={(e) => setNewFieldDataType(e.target.value as CustomFieldDataType)}
                disabled={currentUser.role !== 'canon_admin'}
                className="mt-1 h-9 w-full rounded-lg border border-zinc-200/80 bg-white px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none disabled:bg-zinc-50"
              >
                <option value="string">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Yes / No</option>
                <option value="date">Date</option>
                <option value="select">Dropdown Select</option>
              </select>
            </div>

            {newFieldDataType === 'select' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  Dropdown Options (comma-separated)
                </label>
                <input
                  type="text"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  disabled={currentUser.role !== 'canon_admin'}
                  className="mt-1 h-9 w-full rounded-lg border border-zinc-200/80 px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Unit (optional)</label>
              <input
                type="text"
                value={newFieldUnit}
                onChange={(e) => setNewFieldUnit(e.target.value)}
                placeholder="e.g. pages/mo, seats, devices"
                disabled={currentUser.role !== 'canon_admin'}
                className="mt-1 h-9 w-full rounded-lg border border-zinc-200/80 px-3 text-xs text-zinc-900 focus:border-canon focus:outline-none disabled:bg-zinc-50"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="settings-req"
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)}
                disabled={currentUser.role !== 'canon_admin'}
                className="h-4 w-4 accent-canon rounded"
              />
              <label htmlFor="settings-req" className="text-xs text-zinc-700 select-none">
                Required on new subscriptions
              </label>
            </div>

            {schemaFeedback && (
              <div
                className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${
                  schemaFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{schemaFeedback.msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingSchema || currentUser.role !== 'canon_admin'}
              className="w-full rounded-lg bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark disabled:opacity-45 transition-colors shadow-2xs"
            >
              {submittingSchema ? 'Deploying...' : 'Deploy Specification'}
            </button>
          </form>
        </div>
      )}

      {/* 2. BILLING TERMS & GOVERNANCE RULES (CARDS / TOGGLES) */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto-renew rule */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-zinc-900">Default Auto-Renewal Policy</div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Automatically roll expiring agreements into equivalent annual or monthly extensions unless flagged 90 days prior.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoRenewDefault(!autoRenewDefault)}
                  className="text-zinc-700 shrink-0"
                >
                  {autoRenewDefault ? (
                    <ToggleRight className="h-7 w-7 text-canon" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-zinc-400" />
                  )}
                </button>
              </div>
              <div className="text-[11px] font-medium text-zinc-500 pt-2 border-t border-zinc-100">
                Current Status: {autoRenewDefault ? 'Active by default' : 'Manual renewal required'}
              </div>
            </div>

            {/* Renewal Notice Window */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-bold text-zinc-900">Executive Renewal Notice Lead Time</div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Triggers dashboard alerts and automated dealer review tasks prior to agreement expiry.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                {[30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setNoticeWindowDays(days)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      noticeWindowDays === days
                        ? 'border-canon bg-red-50/70 text-canon'
                        : 'border-zinc-200/80 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {days} Days Notice
                  </button>
                ))}
              </div>
            </div>

            {/* Default Invoicing Cadence */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-bold text-zinc-900">Corporate Payment Terms</div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Default invoice settlement period for hardware maintenance, metered print overages, and software seats.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                {[15, 30, 45, 60].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setNetPaymentDays(days)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      netPaymentDays === days
                        ? 'border-canon bg-red-50/70 text-canon'
                        : 'border-zinc-200/80 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    Net {days}
                  </button>
                ))}
              </div>
            </div>

            {/* Toner Service Exclusion Warning */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-zinc-900">Parts &amp; Labour Toner Exclusion Flags</div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Require explicit visual notices and suppress automated toner dispatch whenever contracts exclude supply coverage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireTonerExclusionNotice(!requireTonerExclusionNotice)}
                  className="text-zinc-700 shrink-0"
                >
                  {requireTonerExclusionNotice ? (
                    <ToggleRight className="h-7 w-7 text-canon" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-zinc-400" />
                  )}
                </button>
              </div>
              <div className="text-[11px] font-medium text-zinc-500 pt-2 border-t border-zinc-100">
                Rule Status: {requireTonerExclusionNotice ? 'Strictly Enforced' : 'Advisory Only'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Save Governance Terms</div>
              <p className="text-[11px] text-zinc-500">
                Updates default policies across dealer portals and automated renewal warnings.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {billingSavedNotice && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Saved
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveBillingRules}
                className="rounded-lg bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark transition-colors shadow-2xs"
              >
                Apply Billing Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. AUDIT & VERIFICATION LEDGER */}
      {activeTab === 'audit' && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-3">Audit Reference &amp; Timestamp</th>
                <th className="px-5 py-3">Actor &amp; Scope</th>
                <th className="px-5 py-3">Activity &amp; Methodology</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3">Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {loadingLogs ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                    Loading verified audit ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                    No audit records found for your role scope.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 align-top transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-mono font-semibold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] inline-block">
                        {log.id}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500 tabular-nums">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-zinc-900">{log.userName}</div>
                      <div className="text-[11px] text-zinc-500">{formatRoleLabel(log.role)}</div>
                    </td>
                    <td className="px-5 py-3.5 max-w-md">
                      <div className="font-medium text-zinc-900">{log.summary}</div>
                      {log.queryText && (
                        <div className="mt-1 text-zinc-600 italic text-[11px]">
                          &ldquo;{log.queryText}&rdquo;
                        </div>
                      )}
                      {log.calculationPerformed && (
                        <div className="mt-1 font-mono text-[11px] text-zinc-500 bg-zinc-50 p-1.5 rounded border border-zinc-100">
                          {log.calculationPerformed}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold capitalize text-xs ${
                          log.verificationStatus === 'verified'
                            ? 'text-emerald-700'
                            : log.verificationStatus === 'restricted'
                              ? 'text-rose-700'
                              : log.verificationStatus === 'withheld'
                                ? 'text-amber-700'
                                : 'text-zinc-700'
                        }`}
                      >
                        {log.verificationStatus === 'verified' ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        ) : log.verificationStatus === 'restricted' ? (
                          <Lock className="h-3.5 w-3.5 text-rose-600" />
                        ) : log.verificationStatus === 'withheld' ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                        ) : null}
                        {log.verificationStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {log.authorizedSourceIds.length === 0 ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                          {log.authorizedSourceIds.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => onSelectSubscription(id)}
                              className="font-mono text-[11px] font-semibold text-canon hover:underline bg-white border border-zinc-200 px-1.5 py-0.2 rounded"
                            >
                              {id}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. ACCESS ADMINISTRATION */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs shadow-2xs">
            <div>
              <div className="text-zinc-500">Authenticated Actor</div>
              <div className="mt-1 font-semibold text-zinc-900">{currentUser.name}</div>
              <div className="text-[11px] font-mono text-zinc-400">{currentUser.id}</div>
            </div>
            <div>
              <div className="text-zinc-500">Enforced Governance Role</div>
              <div className="mt-1 font-semibold text-zinc-900">
                {formatRoleLabel(currentUser.role)}
              </div>
            </div>
            <div>
              <div className="text-zinc-500">Authorized Tenant Boundary</div>
              <div className="mt-1 text-zinc-900 font-medium">
                {currentUser.role === 'canon_admin'
                  ? 'Canon HQ (Global · PII Masked)'
                  : currentUser.role === 'dealer'
                    ? `dealerId = ${currentUser.dealerId}`
                    : `customerId = ${currentUser.customerId}`}
              </div>
            </div>
            <div>
              <div className="text-zinc-500">Identity Mode</div>
              <div className="mt-1 text-zinc-700">
                Simulated Enterprise Session (SSO/OIDC Ready)
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-zinc-900">
              Role-Based Access Control Architecture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 space-y-2">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-canon" />
                  Canon HQ Administrator
                </div>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Unrestricted oversight of all subscription metadata, pricing models, renewal timelines, and partner performance. Customer PII is scrubbed before UI projection and before passing context to Gemini.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 space-y-2">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-canon" />
                  Authorized Dealership
                </div>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Restricted strictly to agreements sold and maintained by the dealer&apos;s own organization. Cross-dealer queries or parameters return HTTP 403 Forbidden.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 space-y-2">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-canon" />
                  Customer Organization
                </div>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Secure client view of contracted products, historical usage logs, upcoming renewal dates, and verified cost-saving recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
