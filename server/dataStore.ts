import fs from 'node:fs';
import path from 'node:path';
import { createInitialSeedData } from './seedData.ts';
import type {
  AuditLogEntry,
  Customer,
  DatabaseSchema,
  Dealer,
  DemoUser,
  FieldDefinition,
  ServiceEvent,
  SubscriptionCategory,
  SubscriptionPlan,
  SubscriptionRecord,
  SubscriptionTypeDefinition,
  UsageRecord,
} from './types.ts';

export interface SubscriptionDataStore {
  getUsers(): Promise<DemoUser[]>;
  getUserById(userId: string): Promise<DemoUser | undefined>;
  getDealers(): Promise<Dealer[]>;
  getCustomers(): Promise<Customer[]>;
  getSubscriptionTypes(): Promise<SubscriptionTypeDefinition[]>;
  getSubscriptions(): Promise<SubscriptionRecord[]>;
  getUsageRecords(): Promise<UsageRecord[]>;
  getServiceEvents(): Promise<ServiceEvent[]>;
  getPlans(): Promise<SubscriptionPlan[]>;
  getAuditLogs(): Promise<AuditLogEntry[]>;
  createSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord>;
  addCustomField(
    typeId: SubscriptionCategory,
    field: FieldDefinition,
  ): Promise<SubscriptionTypeDefinition>;
  appendAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry>;
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'canopy-db.json');

export class JsonDataStore implements SubscriptionDataStore {
  private cache: DatabaseSchema | null = null;

  private load(): DatabaseSchema {
    if (this.cache) {
      return this.cache;
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE_PATH)) {
      const seeded = createInitialSeedData();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seeded, null, 2), 'utf-8');
      this.cache = seeded;
      return seeded;
    }

    try {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      this.cache = parsed;
      return parsed;
    } catch {
      const seeded = createInitialSeedData();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seeded, null, 2), 'utf-8');
      this.cache = seeded;
      return seeded;
    }
  }

  private save(db: DatabaseSchema): void {
    this.cache = db;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  }

  async getUsers(): Promise<DemoUser[]> {
    return this.load().users;
  }

  async getUserById(userId: string): Promise<DemoUser | undefined> {
    return this.load().users.find((u) => u.id === userId);
  }

  async getDealers(): Promise<Dealer[]> {
    return this.load().dealers;
  }

  async getCustomers(): Promise<Customer[]> {
    return this.load().customers;
  }

  async getSubscriptionTypes(): Promise<SubscriptionTypeDefinition[]> {
    return this.load().subscriptionTypes;
  }

  async getSubscriptions(): Promise<SubscriptionRecord[]> {
    return this.load().subscriptions;
  }

  async getUsageRecords(): Promise<UsageRecord[]> {
    return this.load().usageRecords;
  }

  async getServiceEvents(): Promise<ServiceEvent[]> {
    return this.load().serviceEvents;
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.load().plans;
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.load().auditLogs;
  }

  async createSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord> {
    const db = this.load();
    db.subscriptions.unshift(record);
    this.save(db);
    return record;
  }

  async addCustomField(
    typeId: SubscriptionCategory,
    field: FieldDefinition,
  ): Promise<SubscriptionTypeDefinition> {
    const db = this.load();
    const target = db.subscriptionTypes.find((t) => t.id === typeId);
    if (!target) {
      throw new Error(`Unknown subscription type: ${typeId}`);
    }
    if (target.fields.some((f) => f.key === field.key)) {
      throw new Error(`Field key "${field.key}" already exists on ${target.name}`);
    }
    target.fields.push(field);
    this.save(db);
    return target;
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const db = this.load();
    db.auditLogs.unshift(entry);
    if (db.auditLogs.length > 250) {
      db.auditLogs = db.auditLogs.slice(0, 250);
    }
    this.save(db);
    return entry;
  }
}

export const dataStore: SubscriptionDataStore = new JsonDataStore();
