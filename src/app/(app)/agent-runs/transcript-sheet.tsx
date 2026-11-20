"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadFailedState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AGENT_LABELS, MESSAGE_ROLE_LABELS, toolLabel } from "@/lib/agents";
import { agentsApi } from "@/lib/api/agents";
import type { AgentBlock, AgentMessage, AgentRun } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import "@/styles/sections/agents.css";

/**
 * A run's conversation as the model saw it (docs/decisions/agents.md AGT3,
 * AGT9): patients' details already masked, tool calls and their results
 * included. Reading it needs agents:transcripts, and the API writes an
 * audit entry each time. Nothing is kept in the browser once it closes.
 */
export function TranscriptSheet({ run, onOpenChange }: { run: AgentRun | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={run !== null} onOpenChange={onOpenChange}>
      <SheetContent>{run ? <Transcript key={run.runId} run={run} onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function Transcript({ run, onDone }: { run: AgentRun; onDone: () => void }) {
  const { current } = useTenant();
  const conversation = useQuery({
    queryKey: ["agent-conversation", current.tenantId, run.conversationId],
    queryFn: () => agentsApi.conversation(current.tenantId, run.conversationId),
    // A transcript is read on purpose, each read audited: never again in the background.
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>Transcript</SheetTitle>
        <SheetDescription>
          {AGENT_LABELS[run.agent]}, {formatDateTime(run.queuedAt)}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        {conversation.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading transcript">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </div>
        ) : conversation.isError ? (
          <LoadFailedState noun="transcript" onRetry={() => void conversation.refetch()} />
        ) : (
          <ol className="transcript" aria-label="Conversation">
            {conversation.data.messages.map((message) => (
              <Line key={message.id} message={message} thisRun={message.runId === run.runId} />
            ))}
          </ol>
        )}
      </SheetBody>
      <SheetFooter note="Names and contact details were masked before the model saw them.">
        <Button type="button" variant="outline" onClick={onDone}>
          Close
        </Button>
      </SheetFooter>
    </>
  );
}

function Line({ message, thisRun }: { message: AgentMessage; thisRun: boolean }) {
  return (
    <li className="transcript-line" data-role={message.role}>
      <div className="transcript-head">
        <b>{MESSAGE_ROLE_LABELS[message.role]}</b>
        <span>{formatDateTime(message.createdAt)}</span>
        {message.untrusted ? <StatusBadge label="From outside" tone="neutral" size="sm" dot={false} /> : null}
        {thisRun ? null : message.runId ? <StatusBadge label="Another run" tone="neutral" size="sm" dot={false} /> : null}
      </div>
      {message.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </li>
  );
}

function Block({ block }: { block: AgentBlock }) {
  if (block.type === "text") return <p className="transcript-text">{block.text}</p>;
  if (block.type === "tool_use") {
    return (
      <p className="transcript-code">
        {block.name === "hand_off" ? "Handed to a person" : `Used: ${toolLabel(block.name)}`} {JSON.stringify(block.input)}
      </p>
    );
  }
  return (
    <p className="transcript-code">
      {block.isError ? "Refused: " : "Result: "}
      {block.content}
    </p>
  );
}
