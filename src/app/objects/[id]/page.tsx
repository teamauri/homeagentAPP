import Link from "next/link";
import { notFound } from "next/navigation";
import { getDemoObject } from "@/lib/demo/demo-store";
import { DoodleIcon } from "@/components/Icons";
import { ObjectActionButton } from "./ObjectActionButton";

export const dynamic = "force-dynamic";

function titleFor(object: NonNullable<ReturnType<typeof getDemoObject>>) {
  const title = object.payload.title;
  if (typeof title === "string") return title;
  if (object.type === "calendar_draft") return "Calendar draft";
  if (object.type === "reminder_draft") return "Reminder draft";
  if (object.type === "baby_log") return "Baby care log";
  if (object.type === "lesson_recap") return "Lesson recap";
  if (object.type === "story_draft") return "Story draft";
  return "Memory item";
}

function iconFor(type: string) {
  if (type === "calendar_draft") return "calendar";
  if (type === "reminder_draft") return "bell";
  if (type === "baby_log") return "bottle";
  if (type === "lesson_recap") return "music";
  if (type === "story_draft") return "mail-heart";
  return "photos";
}

function actionLabelFor(type: string) {
  if (type === "calendar_draft") return "Add to calendar";
  if (type === "reminder_draft") return "Add reminder";
  if (type === "baby_log") return "Log feed";
  if (type === "story_draft") return "Mark ready to send";
  return "Save locally";
}

function actionFor(type: string) {
  if (type === "calendar_draft" || type === "reminder_draft") return "add";
  if (type === "baby_log") return "log";
  if (type === "story_draft") return "send";
  return "save";
}

function statusLabelFor(status: string) {
  if (status === "added") return "Added locally";
  if (status === "logged") return "Logged locally";
  if (status === "saved") return "Saved locally";
  if (status === "sent") return "Sent locally";
  if (status === "ready") return "Ready";
  return "Draft";
}

function displayRows(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .slice(0, 6);
}

export default function ObjectDetailPage({ params }: { params: { id: string } }) {
  const object = getDemoObject(params.id);
  if (!object) notFound();

  const rows = displayRows(object.payload);

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-3 py-4 md:grid md:place-items-center md:px-10">
      <div className="phone-shell mx-auto w-full max-w-[430px] overflow-hidden bg-white">
        <div className="relative flex h-[min(900px,calc(100dvh-2rem))] min-h-[760px] flex-col overflow-hidden bg-white">
          <div className="pointer-events-none absolute left-1/2 top-[18px] z-20 h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black shadow-inner" />
          <div className="z-10 flex items-center justify-between px-[34px] pt-[34px] text-[17px] font-semibold text-ink">
            <span>9:41</span>
            <span className="text-[15px]">Auri</span>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-[31px] pb-8 pt-[42px]">
            <Link href="/" className="mb-6 inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-medium text-ink">
              Back
            </Link>

            <div className="mb-5 grid h-16 w-16 place-items-center">
              <DoodleIcon name={iconFor(object.type)} className="h-14 w-14" />
            </div>

            <p className="mb-2 text-[14px] font-medium text-muted">{object.type.replaceAll("_", " ")}</p>
            <h1 className="font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-ink">{titleFor(object)}</h1>
            <p className="mt-4 text-[17px] leading-6 text-ink/80">
              Review this local draft before Auri writes to an external family app. External calendar, reminder, and sharing actions are mocked for this demo.
            </p>

            <section className="mt-7 rounded-[22px] border border-line bg-white px-4 py-2 shadow-[0_8px_24px_rgba(8,8,8,0.035)]">
              {rows.map(([key, value]) => (
                <div key={key} className="flex min-h-[46px] items-center justify-between gap-4 border-b border-line/80 py-2 last:border-b-0">
                  <span className="text-[14px] capitalize text-muted">{key.replaceAll(/([A-Z])/g, " $1")}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-[15px] font-medium text-ink">{String(value)}</span>
                </div>
              ))}
            </section>

            <div className="mt-7">
              <ObjectActionButton objectId={object.id} action={actionFor(object.type)} actionLabel={actionLabelFor(object.type)} initialStatus={statusLabelFor(object.status)} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
