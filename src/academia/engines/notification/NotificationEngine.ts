// NOTIFICATION_ENGINE — avisos internos (conquistas, aprovações, riscos,
// recomendações). Ponto de extensão para push/e-mail no futuro.

import type { ID, Notification, Role } from "../../core/types";
import { notificationRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";

export const notificationEngine = {
  notifyEmployee(employeeId: ID, title: string, body: string, kind: Notification["kind"], link?: string): Notification {
    return notificationRepo.save({
      id: uid("NTF"),
      employeeId,
      title,
      body,
      kind,
      link,
      read: false,
      createdAt: nowIso(),
    });
  },

  notifyRole(role: Role, title: string, body: string, kind: Notification["kind"], link?: string): Notification {
    return notificationRepo.save({
      id: uid("NTF"),
      role,
      title,
      body,
      kind,
      link,
      read: false,
      createdAt: nowIso(),
    });
  },
};
