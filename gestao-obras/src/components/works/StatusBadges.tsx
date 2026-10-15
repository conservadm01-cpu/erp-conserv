import { Badge } from "../ui/Badge";
import { DOC_STATUS, EVAL_STATUS, RULE_STATUS, WORK_STATUS } from "./labels";

export function WorkStatusBadge({ status }: { status: string }) {
  const s = WORK_STATUS[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function DocStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUS[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function EvalStatusBadge({ status }: { status: string }) {
  const s = EVAL_STATUS[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RuleStatusBadge({ status }: { status: string }) {
  const s = RULE_STATUS[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
