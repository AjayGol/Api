export class Notification {
  public id?: string;
  public churchId?: string;
  public personId?: string;
  public contentType?: string;
  public contentId?: string;
  public timeSent?: Date;
  public isNew?: boolean;
  public message?: string;
  public link?: string;
  public deliveryMethod?: string;
  public triggeredByPersonId?: string;
  public timeToSend?: Date;
  public status?: "scheduled" | "processing" | "sent" | "failed" | "cancelled";
  public title?: string;
}
