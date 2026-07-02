"use client";

import { useEffect, useRef, useState } from "react";
import { DoodleIcon } from "@/components/Icons";
import type { FamilyMemberProfile, FamilyRole } from "@/lib/family/profile";
import { saveFamilyToStorage, loadFamilyFromStorage } from "@/components/FamilyContext";

async function fileToAvatarUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const scale = size / Math.min(bitmap.width, bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h); // center-crop square
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function encodePhoto(file: File): Promise<{ name: string; mimeType: string; dataBase64: string; capturedAtISO: string } | null> {
  try {
    const max = 768;
    type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;
    type Decoded = { width: number; height: number; draw: DrawFn };
    let bitmap: ImageBitmap | null = null;
    try { bitmap = await createImageBitmap(file); } catch { /* HEIC fallback below */ }
    let decoded: Decoded;
    if (bitmap) {
      const b = bitmap;
      decoded = { width: b.width, height: b.height, draw: (c, w, h) => c.drawImage(b, 0, 0, w, h) };
    } else {
      decoded = await new Promise<Decoded>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight, draw: (c, w, h) => c.drawImage(img, 0, 0, w, h) }); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
        img.src = url;
      });
    }
    const { width, height, draw } = decoded;
    const scale = Math.min(1, max / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    draw(ctx, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const dataBase64 = dataUrl.split(",")[1] ?? "";
    if (!dataBase64) return null;
    return { name: file.name, mimeType: "image/jpeg", dataBase64, capturedAtISO: new Date(file.lastModified || Date.now()).toISOString() };
  } catch { return null; }
}

export default function FamilySettingsPage() {
  const [members, setMembers] = useState<FamilyMemberProfile[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [chatClearDone, setChatClearDone] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [organizeStatus, setOrganizeStatus] = useState<string | null>(null);
  const organizeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load from localStorage immediately (survives redeploys)
    const local = loadFamilyFromStorage();
    if (local) { setMembers(local); return; }
    fetch("/api/family")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  function update(id: string, patch: Partial<FamilyMemberProfile>) {
    setMembers((cur) => (cur ? cur.map((m) => (m.id === id ? { ...m, ...patch } : m)) : cur));
    setSaved(false);
  }

  function addChild() {
    setMembers((cur) => [
      ...(cur ?? []),
      { id: `child_${Date.now()}`, name: "", role: "child", avatar: "girl", interests: [], routines: [], health: [] },
    ]);
    setSaved(false);
  }

  function remove(id: string) {
    setMembers((cur) => (cur ? cur.filter((m) => m.id !== id) : cur));
    setSaved(false);
  }

  async function onOrganizeFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const isImage = (f: File) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(f.name);
    const images = [...files].filter(isImage);
    if (!images.length) { setOrganizeStatus("No photos found in selection."); return; }
    setOrganizing(true);
    setOrganizeStatus(null);
    try {
      const encoded = await Promise.all(images.map(encodePhoto));
      const photos = encoded.filter(Boolean);
      if (!photos.length) { setOrganizeStatus("Couldn't read those photos."); return; }
      const res = await fetch("/api/album/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setOrganizeStatus(`${photos.length} photo${photos.length === 1 ? "" : "s"} added to Journey ✓`);
    } catch {
      setOrganizeStatus("Organize failed — please try again.");
    } finally {
      setOrganizing(false);
    }
  }

  async function save() {
    if (!members) return;
    setSaving(true);
    setSaved(false);
    const toSave = members.filter((m) => m.name.trim());
    try {
      // Always persist to localStorage first (survives server restarts/redeploys)
      saveFamilyToStorage(toSave);
      const res = await fetch("/api/family", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: toSave }),
      });
      const d = await res.json();
      if (d.members) setMembers(d.members);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function resetDemo() {
    if (!window.confirm("Clear all test photos, videos and Stories created while testing? Your family settings are kept. This can’t be undone.")) return;
    setResetting(true);
    setResetDone(false);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) setResetDone(true);
    } finally {
      setResetting(false);
    }
  }

  async function clearChatHistory() {
    if (!window.confirm("Clear user chat history, drafts, and chat-created jobs? The built-in Sophie demo story will stay. This can’t be undone.")) return;
    setClearingChat(true);
    setChatClearDone(false);
    try {
      const res = await fetch("/api/chat/history/reset", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      try {
        localStorage.removeItem("auri.events.v1");
        localStorage.removeItem("auri.deletedIds.v1");
        sessionStorage.removeItem("auri.liveTurns.v1");
        sessionStorage.removeItem("auri.draftStates.v1");
        sessionStorage.removeItem("auri.job.v1");
        sessionStorage.removeItem("auri.returnHome.v1");
      } catch {
        // ignore storage failures
      }
      setChatClearDone(true);
    } finally {
      setClearingChat(false);
    }
  }

  return (
    <main className="h-[100dvh] bg-[#f5f1eb]">
      <div className="mx-auto w-full max-w-[430px] bg-paper h-full flex flex-col">
        <div className="relative shrink-0 px-[26px] pt-[18px]">
          <a href="/" className="inline-flex items-center gap-1 pt-2 text-[13px] text-muted">
            ‹ Home
          </a>
          <h1 className="mt-2 font-display text-[30px] tracking-[-0.02em] text-ink">Family</h1>
          <p className="mt-1 text-[13px] text-muted">Names, birthdays &amp; photos — used across the app and to sort memories by age.</p>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-[26px] pb-4 pt-4">
          {members === null ? (
            <p className="pt-8 text-center text-[14px] text-muted">Loading…</p>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} onChange={(p) => update(m.id, p)} onRemove={() => remove(m.id)} />
              ))}
              <button onClick={addChild} className="w-full rounded-[16px] border border-dashed border-line py-3 text-[14px] font-semibold text-muted">
                ＋ Add a child
              </button>

              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save family"}
              </button>

              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[13px] font-semibold text-ink">Journey</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Add photos from your camera roll to Journey. Cameraman will organize them by child and day.
                </p>
                <button
                  onClick={() => organizeRef.current?.click()}
                  disabled={organizing}
                  className="mt-3 w-full rounded-full border border-line bg-white py-3 text-[14px] font-semibold text-ink disabled:opacity-40"
                >
                  {organizing ? "Organizing…" : "＋ Organize photos"}
                </button>
                <input ref={organizeRef} type="file" accept="image/*" multiple hidden onChange={(e) => onOrganizeFiles(e.target.files)} />
                {organizeStatus ? (
                  <p className="mt-2 text-center text-[12px] text-muted">{organizeStatus}</p>
                ) : null}
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[13px] font-semibold text-ink">Chat history</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Clear user messages, draft states and jobs created from Chat. The built-in Sophie demo conversation stays.
                </p>
                <button
                  onClick={clearChatHistory}
                  disabled={clearingChat}
                  className="mt-3 w-full rounded-full border border-line bg-white py-3 text-[14px] font-semibold text-ink disabled:opacity-40"
                >
                  {clearingChat ? "Clearing…" : chatClearDone ? "Cleared ✓ — reopen Chat" : "Clear chat history"}
                </button>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[13px] font-semibold text-ink">Demo data</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Clear photos, videos and Stories added while testing, returning Memory to its starting state. Your family settings are kept.
                </p>
                <button
                  onClick={resetDemo}
                  disabled={resetting}
                  className="mt-3 w-full rounded-full border border-[#e3b7ab] py-3 text-[14px] font-semibold text-[#b5503a] disabled:opacity-40"
                >
                  {resetting ? "Clearing…" : resetDone ? "Cleared ✓ — reopen Memory" : "Reset demo data"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

const ROLE_LABELS: { value: FamilyRole; label: string }[] = [
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "baby", label: "Baby" },
  { value: "extended_family", label: "Family" },
];

function MemberRow({
  member,
  onChange,
  onRemove,
}: {
  member: FamilyMemberProfile;
  onChange: (patch: Partial<FamilyMemberProfile>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    onChange({ avatarUrl: await fileToAvatarUrl(file) });
  }

  return (
    <article className="rounded-[18px] border border-line bg-white p-4">
      <div className="flex items-start gap-3.5">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-soft"
          aria-label="Change photo"
        >
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <DoodleIcon name={member.avatar} className="h-9 w-9" />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-white">Photo</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={member.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Name"
              className="min-w-0 flex-1 border-b border-line pb-1 text-[17px] font-semibold text-ink outline-none placeholder:text-muted/50"
            />
            <button onClick={onRemove} className="shrink-0 text-[18px] text-muted/60" aria-label="Remove">
              ×
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <select
              value={member.role}
              onChange={(e) => onChange({ role: e.target.value as FamilyRole })}
              className="rounded-full border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink"
            >
              {ROLE_LABELS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
              Born
              <input
                type="date"
                value={member.birthday ?? ""}
                onChange={(e) => onChange({ birthday: e.target.value })}
                className="rounded-full border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink"
              />
            </label>
          </div>
        </div>
      </div>
    </article>
  );
}
