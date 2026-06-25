import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex("idx_notifications_status_timeToSend")
    .on("notifications")
    .columns(["status", "timeToSend"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex("idx_notifications_status_timeToSend")
    .on("notifications")
    .execute();
}

