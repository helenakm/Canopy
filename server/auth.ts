import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { dataStore } from './dataStore.ts';
import type {
  AuditLogEntry,
  Customer,
  Dealer,
  DemoUser,
  SanitizedCustomer,
  SanitizedSubscriptionView,
  ServiceEvent,
  SubscriptionPlan,
  SubscriptionRecord,
  SubscriptionTypeDefinition,
  UsageRecord,
} from './types.ts';

const SESSION_COOKIE_NAME = 'canopy_sid';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface SessionRecord {
  sessionId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const sessionStore = new Map<string, SessionRecord>();

function signSessionId(sessionId: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  return `${sessionId}.${sig}`;
}

function verifySignedToken(token: string | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const sessionId = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  if (providedSig.length !== expectedSig.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig));
  return valid ? sessionId : null;
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      result[k] = v;
    }
  }
  return result;
}

export function setSessionCookie(res: Response, signedToken: string): void {
  const cookieAttrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signedToken)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
    'Max-Age=86400',
  ];
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

export function createSessionForUser(userId: string): { sessionId: string; signedToken: string } {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  sessionStore.set(sessionId, {
    sessionId,
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return { sessionId, signedToken: signSessionId(sessionId) };
}

export function updateSessionUser(sessionId: string, userId: string): void {
  const existing = sessionStore.get(sessionId);
  if (existing) {
    existing.userId = userId;
    existing.updatedAt = new Date().toISOString();
  } else {
    const now = new Date().toISOString();
    sessionStore.set(sessionId, {
      sessionId,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: DemoUser;
  authSessionId?: string;
  authSignedToken?: string;
}

export async function attachSessionMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const cookies = parseCookieHeader(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE_NAME];

    const sessionIdFromBearer = verifySignedToken(bearerToken);
    const sessionIdFromCookie = verifySignedToken(cookieToken);
    const sessionId = sessionIdFromBearer || sessionIdFromCookie;

    let session = sessionId ? sessionStore.get(sessionId) : undefined;

    if (!session) {
      // Initialize server-side demo session defaulting to Canon Administrator
      const created = createSessionForUser('canon-admin');
      session = sessionStore.get(created.sessionId)!;
      setSessionCookie(res, created.signedToken);
      req.authSignedToken = created.signedToken;
    } else {
      req.authSignedToken = signSessionId(session.sessionId);
    }

    const user = await dataStore.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ error: 'Invalid session identity.' });
      return;
    }

    req.authUser = user;
    req.authSessionId = session.sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

// ---------- STRICT SERVER-SIDE RBAC PROJECTIONS ----------

export function getAuthorizedSubscriptions(
  user: DemoUser,
  subscriptions: SubscriptionRecord[],
): SubscriptionRecord[] {
  if (user.role === 'canon_admin') {
    return subscriptions;
  }
  if (user.role === 'dealer' && user.dealerId) {
    return subscriptions.filter((s) => s.dealerId === user.dealerId);
  }
  if (user.role === 'customer' && user.customerId) {
    return subscriptions.filter((s) => s.customerId === user.customerId);
  }
  return [];
}

export function getAuthorizedCustomers(
  user: DemoUser,
  customers: Customer[],
): SanitizedCustomer[] {
  if (user.role === 'canon_admin') {
    // Canon administrators NEVER receive customer names, addresses, emails, phones, or payment details.
    return customers.map((c) => ({
      id: c.id,
      dealerId: c.dealerId,
      province: c.province,
      industry: c.industry,
      organizationName: null,
      contactName: null,
      address: null,
      city: null,
      email: null,
      phone: null,
      paymentInfo: null,
      piiRedacted: true,
    }));
  }

  if (user.role === 'dealer' && user.dealerId) {
    return customers
      .filter((c) => c.dealerId === user.dealerId)
      .map((c) => ({
        ...c,
        piiRedacted: false,
      }));
  }

  if (user.role === 'customer' && user.customerId) {
    return customers
      .filter((c) => c.id === user.customerId)
      .map((c) => ({
        ...c,
        piiRedacted: false,
      }));
  }

  return [];
}

export function getAuthorizedUsageRecords(
  user: DemoUser,
  usageRecords: UsageRecord[],
): UsageRecord[] {
  if (user.role === 'canon_admin') return usageRecords;
  if (user.role === 'dealer' && user.dealerId) {
    return usageRecords.filter((u) => u.dealerId === user.dealerId);
  }
  if (user.role === 'customer' && user.customerId) {
    return usageRecords.filter((u) => u.customerId === user.customerId);
  }
  return [];
}

export function getAuthorizedServiceEvents(
  user: DemoUser,
  events: ServiceEvent[],
): ServiceEvent[] {
  if (user.role === 'canon_admin') return events;
  if (user.role === 'dealer' && user.dealerId) {
    return events.filter((e) => e.dealerId === user.dealerId);
  }
  if (user.role === 'customer' && user.customerId) {
    return events.filter((e) => e.customerId === user.customerId);
  }
  return [];
}

export function getAuthorizedAuditLogs(
  user: DemoUser,
  logs: AuditLogEntry[],
): AuditLogEntry[] {
  if (user.role === 'canon_admin') {
    // Canon admin sees governance logs across the platform, with any customer identity/PII scrubbed
    return logs.map((log) =>
      log.role === 'customer'
        ? {
            ...log,
            userName: `Restricted Customer (${log.customerId ?? 'Unknown'})`,
            summary: `[Customer PII Redacted] ${log.actionType} (${log.verificationStatus})`,
            queryText: log.queryText ? '[Customer query text redacted for privacy]' : undefined,
          }
        : log,
    );
  }
  if (user.role === 'dealer' && user.dealerId) {
    return logs.filter(
      (log) => log.dealerId === user.dealerId && log.userId === user.id,
    );
  }
  if (user.role === 'customer' && user.customerId) {
    return logs.filter(
      (log) => log.customerId === user.customerId && log.userId === user.id,
    );
  }
  return [];
}

export function projectSubscriptionView(
  user: DemoUser,
  sub: SubscriptionRecord,
  dealers: Dealer[],
  customers: Customer[],
  plans: SubscriptionPlan[],
  typeDefs: SubscriptionTypeDefinition[],
): SanitizedSubscriptionView {
  const dealer = dealers.find((d) => d.id === sub.dealerId);
  const customer = customers.find((c) => c.id === sub.customerId);
  const plan = plans.find((p) => p.id === sub.planId);
  const typeDef = typeDefs.find((t) => t.id === sub.subscriptionType);

  const visibleCustomFields: Record<string, string | number | boolean | null> = {};
  const tonerExcluded =
    sub.subscriptionType === 'hardware_maintenance' &&
    sub.customFields.tonerIncluded === false;

  if (typeDef) {
    for (const fieldDef of typeDef.fields) {
      if (fieldDef.conditionalHideWhen) {
        const refVal = sub.customFields[fieldDef.conditionalHideWhen.fieldKey];
        if (refVal === fieldDef.conditionalHideWhen.equalsValue) {
          continue;
        }
      }
      if (tonerExcluded && fieldDef.key.toLowerCase().includes('toner') && fieldDef.key !== 'tonerIncluded') {
        continue;
      }
      if (fieldDef.key in sub.customFields) {
        visibleCustomFields[fieldDef.key] = sub.customFields[fieldDef.key];
      }
    }
  } else {
    Object.assign(visibleCustomFields, sub.customFields);
  }

  // Strictly suppress customer organization / contact name for Canon Admin
  const customerDisplayLabel =
    user.role === 'canon_admin'
      ? `Restricted Account (${sub.customerId})`
      : customer?.organizationName || sub.customerId;

  const customerRegion = customer
    ? `${customer.province} · ${customer.industry}`
    : 'Canada';

  return {
    ...sub,
    dealerName: dealer?.name || sub.dealerId,
    customerDisplayLabel,
    customerRegion,
    planName: plan?.name || sub.planId,
    tonerServiceExcluded: tonerExcluded,
    visibleCustomFields,
  };
}
