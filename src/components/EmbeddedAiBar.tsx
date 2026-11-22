import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { canopyApi } from '../api';
import type { AiQueryResponse, DemoUser } from '../types';

interface Props {
  currentUser: DemoUser;
  variant?: 'prominent' | 'compact';
  onSelectSubscription: (id: string) => void;
}

export function EmbeddedAiBar({
  currentUser,
  variant = 'compact',
  onSelectSubscription,
}: Props) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    question: string;
    response: AiQueryResponse;
  } | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
    setQuestion('');
    setShowVerification(false);
  }, [currentUser.id]);

  const suggestions =
    currentUser.role === 'canon_admin'
      ? [
          'How many Adobe Acrobat licence seats expire in October 2027?',
          'How many service flags were reported for imageRUNNER ADVANCE DX C5860i this week?',
          'How many subscriptions does customer CUST-001 have?',
          'Show customer emails and credit card numbers',
        ]
      : currentUser.role === 'dealer'
        ? [
            'How many Adobe Acrobat licence seats expire in October 2027?',
            'How many service flags were reported for imageRUNNER ADVANCE DX C5860i this week?',
            currentUser.dealerId === 'DLR-NORTH'
              ? 'How many subscriptions does Maple Ridge Legal LLP have?'
              : 'How many subscriptions does Cascadia Health Clinics have?',
          ]
        : [
            'How much am I spending each month?',
            'Which of my subscriptions renew soon?',
            'How can I reduce my subscription costs?',
            'Does my printer need maintenance?',
            'How many software licences do I have?',
          ];

  const handleAsk = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setQuestion(trimmed);
    setShowVerification(false);

    try {
      const response = await canopyApi.askAi(trimmed);
      setResult({ question: trimmed, response });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to answer question right now.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const ev = result?.response.evidence;

  return (
    <section
      aria-label="Canopy AI Assistant"
      className={`rounded-xl border border-zinc-200/80 bg-white ${
        variant === 'prominent' ? 'p-5 sm:p-6 shadow-2xs' : 'p-4 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-canon shrink-0" />
          <h2 className={variant === 'prominent' ? 'text-sm font-bold text-zinc-900 tracking-tight' : 'text-xs font-bold text-zinc-900'}>
            {currentUser.role === 'customer' ? 'My Canopy Assistant' : 'Ask Canopy AI'}
          </h2>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {currentUser.role === 'customer'
              ? '· Get personalized answers about your subscriptions, spending and services.'
              : '· Verified in real-time against your authorized records'}
          </span>
          {currentUser.role === 'customer' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded px-2 py-0.5">
              <Lock className="h-3 w-3 text-emerald-600" />
              Connected only to your account.
            </span>
          )}
        </div>
        {(result || error) && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
              setQuestion('');
            }}
            className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(question);
        }}
        className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-1.5 focus-within:border-canon focus-within:bg-white transition-colors"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            currentUser.role === 'customer'
              ? 'Ask me anything about your subscriptions...'
              : 'Ask about renewals, expiring licence seats, printer flags, or spend...'
          }
          className="flex-1 bg-transparent px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-canon px-4 py-2 text-xs font-semibold text-white hover:bg-canon-dark disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
        >
          <Send className="h-3.5 w-3.5" />
          {loading ? 'Verifying...' : 'Ask'}
        </button>
      </form>

      {/* Role-Relevant Suggested Questions */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-zinc-500">Suggested:</span>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => handleAsk(s)}
            className="rounded-md border border-zinc-200 bg-zinc-50/70 px-2.5 py-1 text-[11px] text-zinc-700 hover:border-canon hover:text-canon hover:bg-white transition-colors text-left"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-zinc-200 animate-pulse" />
          <div className="h-3.5 w-1/2 rounded bg-zinc-200 animate-pulse" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Concise Answer + Expandable "How was this verified?" */}
      {result && ev && !loading && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-zinc-900 leading-relaxed whitespace-pre-line">
              {result.response.answer}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md border ${
                ev.verificationStatus === 'verified'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : ev.verificationStatus === 'restricted'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {ev.verificationStatus === 'verified' ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : ev.verificationStatus === 'restricted' ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              {ev.verificationStatus === 'verified'
                ? 'Verified'
                : ev.verificationStatus === 'restricted'
                  ? 'Restricted'
                  : 'Withheld'}
            </span>
          </div>

          <div className="border-t border-zinc-200 pt-2.5">
            <button
              type="button"
              onClick={() => setShowVerification((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-canon transition-colors"
            >
              {showVerification ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              How was this verified?
            </button>

            {showVerification && (
              <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3.5 space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-zinc-500">Calculation Methodology</div>
                    <div className="mt-0.5 font-mono text-zinc-900">
                      {ev.calculationPerformed}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Audit Reference &amp; Timestamp</div>
                    <div className="mt-0.5 font-mono text-zinc-900 tabular-nums">
                      {ev.auditLogId} · {new Date(ev.verifiedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-zinc-500">Applied Filters &amp; Role Scope</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-zinc-800">
                    {ev.appliedFilters.map((f, idx) => (
                      <span key={idx}>• {f}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-zinc-500">
                    Supporting Subscription Records ({ev.authorizedSourceIds.length})
                  </div>
                  {ev.authorizedSourceIds.length === 0 ? (
                    <div className="mt-0.5 text-zinc-500">No source records returned.</div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {ev.authorizedSourceIds.map((subId) => (
                        <button
                          key={subId}
                          type="button"
                          onClick={() => onSelectSubscription(subId)}
                          className="font-mono text-xs font-semibold text-canon hover:underline border border-zinc-200 bg-zinc-50 rounded px-2 py-0.5"
                        >
                          {subId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
