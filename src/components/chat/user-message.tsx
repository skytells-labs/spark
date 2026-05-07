import type { ChatMessage } from "@/lib/types";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from "@/components/ai/attachments";

/** Server Component — a plain user message bubble. */
export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="mb-6 flex justify-end px-1">
      <div className="max-w-[82%] space-y-2">
        {message.attachments?.length ? (
          <Attachments className="justify-end" variant="grid">
            {message.attachments.map((a) => (
              <Attachment
                data={{
                  filename: a.filename,
                  id: a.id,
                  mediaType: a.mediaType,
                  type: "file",
                  url: a.dataUrl,
                }}
                key={a.id}
              >
                <AttachmentPreview />
                <AttachmentInfo />
              </Attachment>
            ))}
          </Attachments>
        ) : null}

        <div className="rounded-[18px] border border-border bg-secondary px-4 py-2.5 text-[14px] leading-5 text-foreground/90 shadow-sm">
          {message.content}
        </div>
      </div>
    </div>
  );
}
