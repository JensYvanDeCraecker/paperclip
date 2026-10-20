import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ExecutionBlocker } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { NativeSelect } from "./ui/select";

type ActionOutcome = "completed" | "not_performed" | "mixed";

// A stopped run whose last action has an unknown outcome stays on hold until a
// board member records what it did. The server already accepts that record on
// /recovery-actions/resolve; this is the form for it.
export function ExecutionHoldRelease({ issueId, holdId, blocker, onReleased }: {
  issueId: string; holdId: string; blocker: ExecutionBlocker; onReleased: () => void;
}) {
  const id = useId();
  const [providerStopped, setProviderStopped] = useState(false);
  const [actionOutcome, setActionOutcome] = useState<ActionOutcome | "">("");
  const [outcomeEvidence, setOutcomeEvidence] = useState("");
  const submit = useMutation({
    mutationFn: () => issuesApi.resolveRecoveryAction(issueId, {
      actionId: holdId, outcome: "restored", sourceIssueStatus: "todo",
      executionReconciliation: { runId: blocker.runId!, providerStopped: true,
        actionOutcome: actionOutcome as ActionOutcome, outcomeEvidence: outcomeEvidence.trim() },
    }), onSuccess: onReleased,
  });
  return <details className="w-full">
    <summary className="cursor-pointer">Release hold</summary>
    <div className="flex flex-col gap-2">
      <p>Inspect the run, then record what its last actions did. The task moves to To do and its assignee starts a fresh run. Actions you mark as completed will not be repeated.</p>
      <fieldset disabled={submit.isPending} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-stopped`} checked={providerStopped} onCheckedChange={checked => setProviderStopped(checked === true)} />
          <Label htmlFor={`${id}-stopped`}>The agent process for this run has stopped.</Label>
        </div>
        <Label htmlFor={`${id}-outcome`}>What the stopped run did</Label>
        <NativeSelect id={`${id}-outcome`} value={actionOutcome} onChange={event => setActionOutcome(event.target.value as ActionOutcome)}>
          <option value="" disabled>Choose an outcome</option>
          <option value="not_performed">Nothing was performed</option>
          <option value="completed">Its actions completed</option>
          <option value="mixed">Some completed, some not performed</option>
        </NativeSelect>
        <Label htmlFor={`${id}-evidence`}>Evidence from the run (at least 20 characters)</Label>
        <Textarea id={`${id}-evidence`} maxLength={12000} value={outcomeEvidence} onChange={event => setOutcomeEvidence(event.target.value)} />
      </fieldset>
      <div className="flex justify-end">
        <Button size="sm" disabled={submit.isPending || !providerStopped || !actionOutcome || outcomeEvidence.trim().length < 20}
          onClick={() => submit.mutate()}>{submit.isPending ? "Releasing…" : "Release hold"}</Button>
      </div>
      {submit.isError && <p role="alert" className="text-destructive">{submit.error.message}</p>}
    </div>
  </details>;
}
