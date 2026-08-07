import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const creatorWorkspaces = sqliteTable("creator_workspaces", {
  ownerId: text("owner_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  stateVersion: integer("state_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    ownerId: text("owner_id").notNull(),
    endpoint: text("endpoint").notNull(),
    subscriptionJson: text("subscription_json").notNull(),
    lastSentKey: text("last_sent_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.endpoint] })],
);
