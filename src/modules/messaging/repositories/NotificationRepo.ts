import { sql } from "kysely";
import { injectable } from "inversify";
import { UniqueIdHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";
import { Notification } from "../models/index.js";

@injectable()
export class NotificationRepo {
  public async save(model: Notification) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: Notification): Promise<Notification> {
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("notifications").values({
      id: model.id,
      churchId: model.churchId,
      personId: model.personId,
      contentType: model.contentType,
      contentId: model.contentId,
      message: model.message,
      link: model.link,
      deliveryMethod: model.deliveryMethod,
      triggeredByPersonId: model.triggeredByPersonId,
      timeSent: model.timeSent || (model.timeToSend ? null : sql`NOW()`),
      isNew: model.isNew !== undefined ? (model.isNew as any) : (model.timeToSend ? false : true as any),
      timeToSend: model.timeToSend || null,
      status: model.status || (model.timeToSend ? "scheduled" : "sent"),
      title: model.title || null
    }).execute();
    return model;
  }

  private async update(model: Notification): Promise<Notification> {
    await getDb().updateTable("notifications").set({
      contentType: model.contentType,
      contentId: model.contentId,
      isNew: model.isNew,
      message: model.message,
      link: model.link,
      deliveryMethod: model.deliveryMethod,
      triggeredByPersonId: model.triggeredByPersonId,
      timeSent: model.timeSent,
      status: model.status,
      timeToSend: model.timeToSend,
      title: model.title || null
    }).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
    return model;
  }

  public async loadById(churchId: string, id: string) {
    return (await getDb().selectFrom("notifications").selectAll()
      .where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null;
  }

  public async loadByPersonId(churchId: string, personId: string) {
    return getDb().selectFrom("notifications").selectAll()
      .where("churchId", "=", churchId)
      .where("personId", "=", personId)
      .where("status", "=", "sent")
      .where("timeSent", "is not", null)
      .orderBy("timeSent", "desc")
      .execute();
  }

  public async loadForEmail(frequency: string) {
    return getDb().selectFrom("notifications as n")
      .innerJoin("notificationPreferences as np", (join) =>
        join.onRef("np.churchId", "=", "n.churchId").onRef("np.personId", "=", "n.personId"))
      .select(["n.churchId", "n.personId"])
      .distinct()
      .where("n.deliveryMethod", "=", "email")
      .where("np.emailFrequency", "=", frequency)
      .where("n.timeSent", ">", sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)` as any)
      .limit(200)
      .execute();
  }

  public async loadByPersonIdForEmail(churchId: string, personId: string, frequency: string) {
    const timeCutoff = frequency === "individual"
      ? sql`DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
      : sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`;
    return getDb().selectFrom("notifications").selectAll()
      .where("churchId", "=", churchId)
      .where("personId", "=", personId)
      .where("deliveryMethod", "=", "email")
      .where("timeSent", ">=", timeCutoff as any)
      .orderBy("timeSent")
      .execute();
  }

  public async delete(churchId: string, id: string) {
    await getDb().deleteFrom("notifications").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async deleteAllForPerson(churchId: string, personId: string) {
    await getDb().deleteFrom("notifications")
      .where("churchId", "=", churchId)
      .where("personId", "=", personId)
      .execute();
  }

  public async markRead(churchId: string, personId: string) {
    await getDb().updateTable("notifications").set({
      isNew: false as any,
      deliveryMethod: "complete"
    }).where("churchId", "=", churchId).where("personId", "=", personId).execute();
  }

  public async markAllRead(churchId: string, personId: string) {
    await getDb().updateTable("notifications").set({
      isNew: false as any,
      deliveryMethod: "complete"
    }).where("churchId", "=", churchId).where("personId", "=", personId).execute();
  }

  public async loadForPerson(churchId: string, personId: string) {
    return getDb().selectFrom("notifications").selectAll()
      .where("churchId", "=", churchId)
      .where("personId", "=", personId)
      .where("status", "=", "sent")
      .where("timeSent", "is not", null)
      .orderBy("timeSent", "desc")
      .execute();
  }

  public async loadNewCounts(churchId: string, personId: string) {
    const result = await getDb().selectNoFrom((eb) => [
      eb.selectFrom("notifications")
        .select(sql<number>`COUNT(*)`.as("notificationCount"))
        .where("churchId", "=", churchId)
        .where("personId", "=", personId)
        .where("isNew", "=", true as any)
        .where("status", "=", "sent")
        .where("timeSent", "is not", null)
        .as("notificationCount"),
      eb.selectFrom("privateMessages")
        .select(sql<number>`COUNT(*)`.as("pmCount"))
        .where("churchId", "=", churchId)
        .where("notifyPersonId", "=", personId)
        .as("pmCount")
    ]).executeTakeFirst();
    return result || {};
  }

  public async loadUndelivered() {
    return getDb().selectFrom("notifications").selectAll()
      .where("isNew", "=", true as any)
      .where("status", "=", "sent")
      .where((eb) =>
        eb.or([
          eb("deliveryMethod", "is", null),
          eb("deliveryMethod", "=", ""),
          eb("deliveryMethod", "=", "push"),
          eb("deliveryMethod", "=", "socket"),
          eb("deliveryMethod", "=", "email")
        ]))
      .execute();
  }

  public async loadExistingUnread(churchId: string, contentType: string, contentId: string) {
    return getDb().selectFrom("notifications").selectAll()
      .where("churchId", "=", churchId)
      .where("contentType", "=", contentType)
      .where("contentId", "=", contentId)
      .where("isNew", "=", true as any)
      .execute();
  }

  public async loadPendingEscalation() {
    return getDb().selectFrom("notifications").selectAll()
      .where("isNew", "=", true as any)
      .where("status", "=", "sent")
      .where("deliveryMethod", "in", ["socket", "push"])
      .execute();
  }

  public async loadDueScheduled(limit: number) {
    return getDb().selectFrom("notifications").selectAll()
      .where("status", "=", "scheduled")
      .where("timeToSend", "<=", new Date())
      .orderBy("timeToSend", "asc")
      .limit(limit)
      .execute();
  }

  public async loadForGroup(churchId: string, contentId: string, limit: number) {
    return getDb().selectFrom("notifications")
      .select([
        "title",
        "message",
        "timeToSend",
        "timeSent",
        "status",
        "link",
        "triggeredByPersonId",
        sql<number>`count(distinct personId)`.as("recipientCount")
      ])
      .where("churchId", "=", churchId)
      .where("contentType", "=", "groupPushNotification")
      .where("contentId", "=", contentId)
      .groupBy(["title", "message", "timeToSend", "timeSent", "status", "link", "triggeredByPersonId"])
      .orderBy(sql`coalesce(timeToSend, timeSent)`, "desc")
      .limit(limit)
      .execute();
  }

  public async markProcessing(notificationIds: string[], lockId: string) {
    if (notificationIds.length === 0) return;
    await getDb().updateTable("notifications")
      .set({ status: "processing", deliveryMethod: lockId, timeSent: sql`NOW()` as any })
      .where("id", "in", notificationIds)
      .where("status", "=", "scheduled")
      .execute();
  }

  public async loadLockedForProcessing(lockId: string) {
    return getDb().selectFrom("notifications").selectAll()
      .where("status", "=", "processing")
      .where("deliveryMethod", "=", lockId)
      .execute();
  }

  public async recoverStuckProcessing() {
    const result = await getDb().updateTable("notifications")
      .set({ status: "scheduled", deliveryMethod: "scheduled", timeSent: null })
      .where("status", "=", "processing")
      .where("timeSent", "<=", sql`DATE_SUB(NOW(), INTERVAL 15 MINUTE)` as any)
      .execute();
    return Number(result[0]?.numUpdatedRows || 0n);
  }

  protected rowToModel(data: any): Notification {
    return {
      id: data.id,
      churchId: data.churchId,
      personId: data.personId,
      contentType: data.contentType,
      contentId: data.contentId,
      timeSent: data.timeSent,
      isNew: data.isNew,
      message: data.message,
      link: data.link,
      deliveryMethod: data.deliveryMethod,
      triggeredByPersonId: data.triggeredByPersonId,
      timeToSend: data.timeToSend,
      status: data.status,
      title: data.title
    };
  }

  public convertToModel(data: any) {
    return this.rowToModel(data);
  }

  public convertAllToModel(data: any[]) {
    return data.map((d: any) => this.rowToModel(d));
  }
}
