import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  path: text("path").notNull().unique(),
  m3u8Url: text("m3u8_url"),
  kodk: text("kodk"),
  kos: text("kos"),
  status: text("status").notNull().default("unknown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
