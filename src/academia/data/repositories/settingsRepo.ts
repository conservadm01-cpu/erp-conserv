import { db } from "../db";
import { DEFAULT_SETTINGS } from "../defaults";
import type { AppSettings } from "../../core/types";
import { nowIso } from "../../core/dates";

export const settingsRepo = {
  get(): AppSettings {
    return db.byId("settings", "settings") ?? DEFAULT_SETTINGS;
  },
  save(changes: Partial<AppSettings>): AppSettings {
    const next: AppSettings = { ...this.get(), ...changes, id: "settings", updatedAt: nowIso() };
    return db.put("settings", next);
  },
  saveAi(changes: Partial<AppSettings["ai"]>): AppSettings {
    const current = this.get();
    return this.save({ ai: { ...current.ai, ...changes } });
  },
};
