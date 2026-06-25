import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("notifications")
    .addColumn("timeToSend", "datetime")
    .addColumn("status", "varchar(20)", (col) =>
      col.defaultTo("sent")
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("notifications")
    .dropColumn("status")
    .dropColumn("timeToSend")
    .execute();
}

