/**
 * Auri editing backend — Node client (independent reimplementation).
 *
 * Contract verified against the auri-editor FastAPI source (api/routes.py).
 * We do NOT import or modify dockkit-demo / auri-editor — this is standalone so
 * neither the robot demo nor the backend is touched.
 *
 * Pipeline (simplified, `full_video` source mode — see MEMORY_AUTO_EDIT_DESIGN.md):
 *   createVideo → (per ≤30s segment: prepareChunk → PUT upload → commitChunk)
 *   → completeUpload → createVlog(full_video) → renderVlog → poll → downloadVlog
 *
 * Auth: the LOCAL backend has no app-id check (dev against localhost needs none).
 * The DEPLOYED backend allowlists app UUIDs (+ HMAC) — see AURI_APP_ID / docs.
 */

// Isomorphic UUID — works in the browser and in Node 18+ (both expose global crypto).
const randomUUID = (): string => globalThis.crypto.randomUUID();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AuriClientConfig {
  host: string; // local dev: http://localhost:8000 ; deployed: https://auriedit.onrender.com
  appId: string;
  authToken?: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}

export function auriConfigFromEnv(): AuriClientConfig {
  return {
    // Plain AURI_* should win on the server (API routes, smoke tests, deployed
    // secrets); NEXT_PUBLIC_* remains the browser-readable fallback.
    host: (process.env.AURI_HOST || process.env.NEXT_PUBLIC_AURI_HOST || "https://auriedit.onrender.com").replace(/\/$/, ""),
    appId: process.env.NEXT_PUBLIC_AURI_APP_ID || process.env.AURI_APP_ID || "homeagent-memory",
    authToken: process.env.AURI_AUTH_TOKEN || undefined,
    pollIntervalMs: Number(process.env.AURI_POLL_INTERVAL_MS || 5000),
    pollTimeoutMs: Number(process.env.AURI_POLL_TIMEOUT_MS || 20 * 60 * 1000),
  };
}

// ---------------------------------------------------------------------------
// Errors + response envelope
// ---------------------------------------------------------------------------

export class AuriError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryable = false,
    readonly referenceId?: string,
  ) {
    super(message);
    this.name = "AuriError";
  }
}

// Success: { success: true, message, data, error: null }
// Error:   { error: { code, message, retryable, status, reference_id, details } }
interface AuriEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean; status?: number; reference_id?: string } | null;
}

// ---------------------------------------------------------------------------
// Wire types (camelCase in TS; snake_case on the wire)
// ---------------------------------------------------------------------------

export interface CreateVideoInput {
  clientVideoUuid: string;
  title?: string;
  expectedChunks: number;
  chunkDurationTarget?: number; // 10–30s
  estimatedDurationSeconds?: number;
}

export interface UploadContract {
  type?: string; // "local_put"
  method: string; // "PUT"
  url: string; // path or absolute URL
  headers?: Record<string, string>;
  fields?: Record<string, string>;
}

export interface CreateVideoResponse {
  videoId: string;
  status: string;
  expectedChunks: number;
}

export interface PrepareChunkResponse {
  chunkId: string;
  chunkIndex: number;
  uploadContract: UploadContract;
}

export type VlogSourceMode = "full_video" | "uploaded_clips";

export type VlogStatus =
  | "CREATED" | "UPLOADING" | "UPLOADED" | "RENDER_QUEUED"
  | "RENDERING" | "READY" | "CANCELED" | "FAILED" | "EXPIRED";

const VLOG_TERMINAL_FAIL: VlogStatus[] = ["CANCELED", "FAILED", "EXPIRED"];

export interface VlogUploadContract {
  segmentIndex: number;
  startTimeOriginal: number;
  endTimeOriginal: number;
  maxSizeBytes: number;
}

export interface VlogStatusResponse {
  vlogId: string;
  videoId: string;
  status: VlogStatus;
  stage?: string;
  progress?: number;
  expectedClips?: number;
  receivedClips?: number;
  storyBudgetSeconds?: number;
  uploadContracts: VlogUploadContract[];
  downloadUrl?: string | null;
  error?: unknown;
}

interface RawVlogList {
  video_id: string;
  items?: RawVlog[];
  count?: number;
  limit?: number;
}

export type RawOutputTranscriptFormat = "json" | "txt";
export type RawOutputJobStatus = "pending" | "processing" | "ready" | "failed" | (string & {});

export interface RawOutputStatusResponse {
  rawOutputId?: string;
  jobId?: string;
  videoId: string;
  status: RawOutputJobStatus;
  progress?: number;
  summaryText?: string | null;
  summaryJson?: Record<string, unknown> | null;
  videoDownloadUrl?: string | null;
  transcriptJsonDownloadUrl?: string | null;
  transcriptTxtDownloadUrl?: string | null;
  error?: unknown;
}

export interface AuriDownloadHeadResponse {
  contentType?: string;
  contentLength?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AuriClient {
  constructor(private readonly config: AuriClientConfig = auriConfigFromEnv()) {}

  // --- low-level request layer ---------------------------------------------

  private baseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "X-Auri-App-Id": this.config.appId,
      "X-Auri-Timestamp": new Date().toISOString(),
      "X-Auri-Trace-Id": randomUUID(),
    };
    if (this.config.authToken) headers["Authorization"] = `Bearer ${this.config.authToken}`;
    return headers;
  }

  // Resolve a backend path/URL. Contract URLs already include the /v1 prefix.
  private resolve(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${this.config.host}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }

  private v1(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.config.host}/v1${path.startsWith("/") ? "" : "/"}${path}`);
    if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    return url.toString();
  }

  private async requestJSON<T>(method: string, fullUrl: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers = this.baseHeaders();
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const res = await fetch(fullUrl, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (!res.ok) throw this.toError(res.status, text);
    if (!text) return undefined as T;

    const json = JSON.parse(text) as AuriEnvelope<T>;
    if (json && typeof json === "object" && ("success" in json || "data" in json)) {
      if (json.success === false || json.error) throw this.toError(res.status || 502, text);
      return (json.data ?? (json as unknown)) as T;
    }
    return json as unknown as T;
  }

  private toError(status: number, body: string): AuriError {
    try {
      const parsed = JSON.parse(body) as { error?: AuriEnvelope<unknown>["error"]; detail?: { error?: AuriEnvelope<unknown>["error"] } | string };
      // FastAPI HTTPException wraps the envelope as { detail: { error: {...} } };
      // some endpoints return a top-level { error: {...} } instead.
      const e = parsed?.error ?? (typeof parsed?.detail === "object" ? parsed.detail?.error : undefined);
      if (e) return new AuriError(e.message || "Auri request failed", e.status ?? status, e.code, Boolean(e.retryable), e.reference_id);
      if (typeof parsed?.detail === "string") return new AuriError(parsed.detail, status);
    } catch {
      /* non-JSON */
    }
    return new AuriError(body.slice(0, 240) || "Auri request failed", status);
  }

  // --- Phase 1: ingest the source video ------------------------------------

  /** POST /v1/videos */
  async createVideo(input: CreateVideoInput): Promise<CreateVideoResponse> {
    const data = await this.requestJSON<{ video_id: string; status: string; expected_chunks: number }>(
      "POST",
      this.v1("/videos"),
      {
        client_video_uuid: input.clientVideoUuid,
        title: input.title,
        expected_chunks: input.expectedChunks,
        chunk_duration_target: input.chunkDurationTarget ?? 30,
        estimated_duration_seconds: input.estimatedDurationSeconds,
      },
      input.clientVideoUuid,
    );
    return { videoId: data.video_id, status: data.status, expectedChunks: data.expected_chunks };
  }

  /** POST /v1/videos/{id}/chunks:prepare */
  async prepareChunk(videoId: string, chunkIndex: number, durationSeconds: number, sizeBytes: number, checksumMd5?: string): Promise<PrepareChunkResponse> {
    const data = await this.requestJSON<{ chunk_id: string; chunk_index: number; upload_contract: UploadContract }>(
      "POST",
      this.v1(`/videos/${videoId}/chunks:prepare`),
      { chunk_index: chunkIndex, duration_seconds: durationSeconds, size_bytes: sizeBytes, checksum_md5: checksumMd5 },
    );
    return { chunkId: data.chunk_id, chunkIndex: data.chunk_index, uploadContract: data.upload_contract };
  }

  /** PUT to the upload-contract URL (direct to storage; no envelope). */
  async uploadChunk(contract: UploadContract, bytes: Uint8Array): Promise<void> {
    const headers: Record<string, string> = { ...this.baseHeaders(), ...(contract.headers ?? {}) };
    if (!headers["Content-Type"]) headers["Content-Type"] = "video/mp4";
    const res = await fetch(this.resolve(contract.url), { method: contract.method || "PUT", headers, body: bytes });
    if (!res.ok) throw this.toError(res.status, await res.text());
  }

  /**
   * POST /v1/videos/{id}/chunks/{chunkId}:commit. `checksum_md5` is a required
   * body field (Pydantic), but the handler only *verifies* it when non-empty — so
   * the browser path sends "" to satisfy the schema and skip md5 work.
   */
  async commitChunk(videoId: string, chunkId: string, sizeBytes: number, checksumMd5?: string): Promise<void> {
    await this.requestJSON("POST", this.v1(`/videos/${videoId}/chunks/${chunkId}:commit`), { size_bytes: sizeBytes, checksum_md5: checksumMd5 ?? "" });
  }

  /** POST /v1/videos/{id}:complete-upload */
  async completeUpload(videoId: string): Promise<void> {
    await this.requestJSON("POST", this.v1(`/videos/${videoId}:complete-upload`), {});
  }

  /** GET /v1/videos/{id} */
  async fetchVideoStatus(videoId: string): Promise<{ videoId: string; status: string; progress?: number }> {
    const data = await this.requestJSON<{ video_id: string; status: string; progress?: number }>("GET", this.v1(`/videos/${videoId}`));
    return { videoId: data.video_id, status: data.status, progress: data.progress };
  }

  // --- Raw + Transcript output --------------------------------------------

  /** GET /v1/videos/{id}/raw-output */
  async fetchRawOutputStatus(videoId: string): Promise<RawOutputStatusResponse> {
    return mapRawOutput(await this.requestJSON<RawRawOutput>("GET", this.v1(`/videos/${videoId}/raw-output`)), videoId);
  }

  private async headDownload(fullUrl: string): Promise<AuriDownloadHeadResponse> {
    const res = await fetch(fullUrl, { method: "HEAD", headers: this.baseHeaders() });
    if (!res.ok) throw this.toError(res.status, "");
    const length = Number(res.headers.get("content-length") || "");
    return {
      contentType: res.headers.get("content-type") || undefined,
      contentLength: Number.isFinite(length) ? length : undefined,
    };
  }

  /** HEAD /v1/videos/{id}/raw-output/video/download */
  async headRawOutputVideo(videoId: string): Promise<AuriDownloadHeadResponse> {
    return this.headDownload(this.v1(`/videos/${videoId}/raw-output/video/download`));
  }

  /** HEAD /v1/videos/{id}/raw-output/transcript/download?format=json|txt */
  async headRawOutputTranscript(videoId: string, format: RawOutputTranscriptFormat): Promise<AuriDownloadHeadResponse> {
    return this.headDownload(this.v1(`/videos/${videoId}/raw-output/transcript/download`, { format }));
  }

  /** GET /v1/videos/{id}/raw-output/video/download → source mp4 bytes */
  async downloadRawOutputVideo(videoId: string): Promise<Uint8Array> {
    const res = await fetch(this.v1(`/videos/${videoId}/raw-output/video/download`), { method: "GET", headers: this.baseHeaders() });
    if (!res.ok) throw this.toError(res.status, await res.text());
    return new Uint8Array(await res.arrayBuffer());
  }

  /** GET /v1/videos/{id}/raw-output/transcript/download?format=json|txt */
  async downloadRawOutputTranscript(videoId: string, format: RawOutputTranscriptFormat = "json"): Promise<Uint8Array> {
    const res = await fetch(this.v1(`/videos/${videoId}/raw-output/transcript/download`, { format }), { method: "GET", headers: this.baseHeaders() });
    if (!res.ok) throw this.toError(res.status, await res.text());
    return new Uint8Array(await res.arrayBuffer());
  }

  // --- Phase 2: create + render the story (full_video) ----------------------

  /**
   * POST /v1/videos/{id}/vlogs. Defaults to `uploaded_clips` — the cloud backend
   * rejects `full_video` (FULL_VIDEO_SOURCE_UNAVAILABLE) since it needs a
   * server-side source path we don't have for uploaded chunks.
   */
  async createVlog(videoId: string, opts: { sourceMode?: VlogSourceMode; provider?: string; renderProfile?: string; timelineId?: string } = {}): Promise<VlogStatusResponse> {
    const data = await this.requestJSON<RawVlog>("POST", this.v1(`/videos/${videoId}/vlogs`), {
      source_mode: opts.sourceMode ?? "uploaded_clips",
      provider: opts.provider ?? "gemini",
      render_profile: opts.renderProfile ?? "legacy_story_v1_fast",
      timeline_id: opts.timelineId,
      allow_mode_fallback: false,
    });
    return mapVlog(data);
  }

  /** POST /v1/videos/{id}/vlogs/{vlogId}/clips — multipart HQ clip for one segment. */
  async uploadVlogClip(videoId: string, vlogId: string, segmentIndex: number, bytes: Uint8Array, checksumMd5?: string): Promise<void> {
    const fd = new FormData();
    fd.append("segment_index", String(segmentIndex));
    fd.append("checksum_md5", checksumMd5 ?? "");
    fd.append("file", new Blob([bytes], { type: "video/mp4" }), `segment_${segmentIndex}.mp4`);
    const res = await fetch(this.v1(`/videos/${videoId}/vlogs/${vlogId}/clips`), { method: "POST", headers: this.baseHeaders(), body: fd });
    if (!res.ok) throw this.toError(res.status, await res.text());
  }

  /** POST /v1/videos/{id}/vlogs/{vlogId}:complete-upload */
  async completeVlogUpload(videoId: string, vlogId: string): Promise<VlogStatusResponse> {
    return mapVlog(await this.requestJSON<RawVlog>("POST", this.v1(`/videos/${videoId}/vlogs/${vlogId}:complete-upload`), {}));
  }

  /** Poll vlog status until the planner produces upload contracts (expected_clips>0). */
  async waitForUploadContracts(videoId: string, vlogId: string): Promise<VlogStatusResponse> {
    const deadline = Date.now() + this.config.pollTimeoutMs;
    for (;;) {
      const s = await this.fetchVlogStatus(videoId, vlogId, true);
      if (s.uploadContracts.length > 0 && (s.expectedClips ?? s.uploadContracts.length) <= s.uploadContracts.length) return s;
      if (VLOG_TERMINAL_FAIL.includes(s.status)) throw new AuriError(`vlog ${s.status} before contracts`, 500, s.status);
      if (Date.now() > deadline) throw new AuriError("vlog contracts timeout", 504, "VLOG_CONTRACTS_TIMEOUT", true);
      await new Promise((r) => setTimeout(r, this.config.pollIntervalMs));
    }
  }

  /** POST /v1/videos/{id}/vlogs/{vlogId}:render */
  async renderVlog(videoId: string, vlogId: string): Promise<VlogStatusResponse> {
    return mapVlog(await this.requestJSON<RawVlog>("POST", this.v1(`/videos/${videoId}/vlogs/${vlogId}:render`), {}));
  }

  /** GET /v1/videos/{id}/vlogs/{vlogId} */
  async fetchVlogStatus(videoId: string, vlogId: string, includeDiagnostics = false): Promise<VlogStatusResponse> {
    return mapVlog(await this.requestJSON<RawVlog>("GET", this.v1(`/videos/${videoId}/vlogs/${vlogId}`, { include_diagnostics: includeDiagnostics })));
  }

  /** GET /v1/videos/{id}/vlogs */
  async listVlogs(videoId: string, opts: { limit?: number; status?: VlogStatus } = {}): Promise<VlogStatusResponse[]> {
    const data = await this.requestJSON<RawVlogList>(
      "GET",
      this.v1(`/videos/${videoId}/vlogs`, { limit: opts.limit ?? 20, status: opts.status }),
    );
    return (data.items ?? []).map(mapVlog);
  }

  /** GET /v1/videos/{id}/vlogs/{vlogId}/download → mp4 bytes */
  async downloadVlog(videoId: string, vlogId: string): Promise<Uint8Array> {
    const res = await fetch(this.v1(`/videos/${videoId}/vlogs/${vlogId}/download`), { method: "GET", headers: this.baseHeaders() });
    if (!res.ok) throw this.toError(res.status, await res.text());
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Poll vlog status until READY (or terminal failure / timeout). */
  async pollUntilVlogFinished(videoId: string, vlogId: string, onProgress?: (s: VlogStatusResponse) => void): Promise<VlogStatusResponse> {
    const deadline = Date.now() + this.config.pollTimeoutMs;
    for (;;) {
      const s = await this.fetchVlogStatus(videoId, vlogId, true);
      onProgress?.(s);
      if (s.status === "READY") return s;
      if (VLOG_TERMINAL_FAIL.includes(s.status)) throw new AuriError(`vlog ${s.status}`, 500, s.status);
      if (Date.now() > deadline) throw new AuriError("vlog poll timeout", 504, "VLOG_POLL_TIMEOUT", true);
      await new Promise((r) => setTimeout(r, this.config.pollIntervalMs));
    }
  }
}

// ---------------------------------------------------------------------------

interface RawVlog {
  vlog_id: string;
  video_id: string;
  status: VlogStatus;
  stage?: string;
  progress?: number;
  expected_clips?: number;
  received_clips?: number;
  story_budget_seconds?: number;
  upload_contracts?: Array<{ segment_index: number; start_time_original: number; end_time_original: number; max_size_bytes: number }>;
  download_url?: string | null;
  error?: unknown;
}

interface RawRawOutput {
  raw_output_id?: string;
  job_id?: string;
  video_id?: string;
  status?: RawOutputJobStatus;
  progress?: number;
  summary_text?: string | null;
  summary_json?: Record<string, unknown> | null;
  video_download_url?: string | null;
  transcript_json_download_url?: string | null;
  transcript_txt_download_url?: string | null;
  transcript_text_download_url?: string | null;
  error?: unknown;
}

function normalizeRawOutputStatus(status: RawRawOutput["status"] | null | undefined): RawOutputJobStatus {
  const normalized = String(status ?? "pending").trim().toLowerCase();
  if (normalized === "ready" || normalized === "processing" || normalized === "failed" || normalized === "pending") {
    return normalized;
  }
  return normalized as RawOutputJobStatus;
}

function mapRawOutput(d: RawRawOutput | null | undefined, videoIdFallback: string): RawOutputStatusResponse {
  const raw = d ?? {};
  return {
    rawOutputId: raw.raw_output_id,
    jobId: raw.job_id,
    videoId: raw.video_id ?? videoIdFallback,
    status: normalizeRawOutputStatus(raw.status),
    progress: raw.progress,
    summaryText: raw.summary_text,
    summaryJson: raw.summary_json,
    videoDownloadUrl: raw.video_download_url,
    transcriptJsonDownloadUrl: raw.transcript_json_download_url,
    transcriptTxtDownloadUrl: raw.transcript_txt_download_url ?? raw.transcript_text_download_url,
    error: raw.error,
  };
}

function mapVlog(d: RawVlog): VlogStatusResponse {
  return {
    vlogId: d.vlog_id,
    videoId: d.video_id,
    status: d.status,
    stage: d.stage,
    progress: d.progress,
    expectedClips: d.expected_clips,
    receivedClips: d.received_clips,
    storyBudgetSeconds: d.story_budget_seconds,
    uploadContracts: (d.upload_contracts ?? []).map((c) => ({
      segmentIndex: c.segment_index,
      startTimeOriginal: c.start_time_original,
      endTimeOriginal: c.end_time_original,
      maxSizeBytes: c.max_size_bytes,
    })),
    downloadUrl: d.download_url,
    error: d.error,
  };
}
