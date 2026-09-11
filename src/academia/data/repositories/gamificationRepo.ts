import { db } from "../db";
import type { Badge, EmployeeBadge, ID, XpTransaction } from "../../core/types";

export const gamificationRepo = {
  badges(): readonly Badge[] {
    return db.list("badges");
  },
  activeBadges(): Badge[] {
    return db.filter("badges", (b) => b.active);
  },
  badge(id?: ID): Badge | undefined {
    return db.byId("badges", id);
  },
  saveBadge(badge: Badge): Badge {
    return db.put("badges", badge);
  },
  badgesOf(employeeId: ID): EmployeeBadge[] {
    return db.filter("employee_badges", (b) => b.employeeId === employeeId)
      .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  },
  hasBadge(employeeId: ID, badgeId: ID): boolean {
    return !!db.find("employee_badges", (b) => b.employeeId === employeeId && b.badgeId === badgeId);
  },
  grantBadge(record: EmployeeBadge): EmployeeBadge {
    return db.put("employee_badges", record);
  },
  xpOf(employeeId: ID): XpTransaction[] {
    return db.filter("xp_transactions", (t) => t.employeeId === employeeId).sort((a, b) => b.at.localeCompare(a.at));
  },
  totalXp(employeeId: ID): number {
    let total = 0;
    for (const t of db.filter("xp_transactions", (x) => x.employeeId === employeeId)) total += t.amount;
    return total;
  },
  saveXp(transaction: XpTransaction): XpTransaction {
    return db.put("xp_transactions", transaction);
  },
  allXp(): readonly XpTransaction[] {
    return db.list("xp_transactions");
  },
};
