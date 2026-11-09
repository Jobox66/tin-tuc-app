/**
 * Vercel (/api/sync, cron-job.org goi 5 phut/lan) tu kich hoat GitHub Actions
 * bang workflow_dispatch - thay cho job cron-job.org rieng goi GitHub.
 *
 * Vi sao: lich `schedule` cua GitHub bi hoan 3-7 tieng tren repo cong khai,
 * con workflow_dispatch chay NGAY (do 09/11/2026: cho 0s, xong trong 88s).
 * GitHub van can cho tom tat Python, gia vang, don trung, cat bot.
 *
 * Khong can luu trang thai: moi luot hoi GitHub lan chay gan nhat cua workflow
 * (ke ca luot `schedule`), du lau moi kich hoat -> khong chong hang doi.
 *
 * Bien moi truong (Vercel):
 *   GH_DISPATCH_TOKEN          fine-grained PAT, chi quyen Actions: Read and write
 *   GH_DISPATCH_REPO           mac dinh Jobox66/tin-tuc-app
 *   GH_DISPATCH_WORKFLOW       mac dinh sync.yml
 *   GH_DISPATCH_REF            mac dinh master
 *   GH_DISPATCH_INTERVAL_MIN   mac dinh 10
 */

export interface LatestRun {
    status: string;      // queued | in_progress | completed | waiting | requested | pending
    createdAt: number;   // epoch ms
}

export type DispatchDecision = { dispatch: true } | { dispatch: false; reason: string };

/** Luot dang chay/cho qua moc nay thi coi nhu treo, kich hoat luot moi (workflow co timeout 20 phut) */
export const STALE_ACTIVE_MS = 30 * 60_000;

/**
 * Co nen kich hoat khong.
 * `graceMs` bu do lech nhip: cron 5 phut, nhip 10 phut - luot truoc cach 9:58
 * van tinh la du, neu khong se thanh 15 phut/lan.
 */
export function shouldDispatch(
    latest: LatestRun | null,
    nowMs: number,
    intervalMs: number,
    graceMs: number = 60_000
): DispatchDecision {
    if (!latest || !Number.isFinite(latest.createdAt)) return { dispatch: true };
    const age = nowMs - latest.createdAt;
    const active = latest.status !== 'completed';
    if (active && age < STALE_ACTIVE_MS) {
        return { dispatch: false, reason: `luot truoc dang ${latest.status}` };
    }
    if (age + graceMs < intervalMs) {
        return { dispatch: false, reason: `luot truoc moi ${Math.round(age / 60_000)} phut` };
    }
    return { dispatch: true };
}

export interface DispatchResult {
    dispatched: boolean;
    /** Ly do khong kich hoat, hoac loi */
    reason?: string;
    error?: string;
}

const API = 'https://api.github.com';
const TIMEOUT_MS = 8_000;

function config() {
    const token = (process.env.GH_DISPATCH_TOKEN || '').trim();
    const repo = process.env.GH_DISPATCH_REPO || 'Jobox66/tin-tuc-app';
    const workflow = process.env.GH_DISPATCH_WORKFLOW || 'sync.yml';
    const ref = process.env.GH_DISPATCH_REF || 'master';
    const minutes = Number(process.env.GH_DISPATCH_INTERVAL_MIN || 10);
    const intervalMs = (Number.isFinite(minutes) && minutes > 0 ? minutes : 10) * 60_000;
    return { token, repo, workflow, ref, intervalMs };
}

/** Thong bao loi de hieu theo ma HTTP cua GitHub */
export function explainGithubStatus(status: number): string {
    switch (status) {
        case 401: return '401: token sai hoac het han - tao token moi, sua GH_DISPATCH_TOKEN tren Vercel';
        case 403: return '403: token thieu quyen Actions: Read and write';
        case 404: return '404: sai repo/workflow, hoac token khong duoc cap repo nay';
        case 422: return '422: sai nhanh (GH_DISPATCH_REF) hoac workflow chua co workflow_dispatch';
        default: return `HTTP ${status}`;
    }
}

export async function maybeDispatchGithub(nowMs: number = Date.now()): Promise<DispatchResult> {
    const { token, repo, workflow, ref, intervalMs } = config();
    if (!token) return { dispatched: false, reason: 'chua dat GH_DISPATCH_TOKEN' };

    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'tin-tuc-app-sync',
    };
    const base = `${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}`;

    try {
        const res = await fetch(`${base}/runs?per_page=1`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
        if (!res.ok) return { dispatched: false, error: `doc lan chay gan nhat: ${explainGithubStatus(res.status)}` };
        const data = await res.json() as { workflow_runs?: { status?: string; created_at?: string }[] };
        const run = data.workflow_runs?.[0];
        const latest: LatestRun | null = run?.created_at
            ? { status: run.status || 'completed', createdAt: Date.parse(run.created_at) }
            : null;

        const decision = shouldDispatch(latest, nowMs, intervalMs);
        if (!decision.dispatch) return { dispatched: false, reason: decision.reason };

        const post = await fetch(`${base}/dispatches`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: 'no-store',
        });
        if (post.status === 204) return { dispatched: true };
        return { dispatched: false, error: `kich hoat: ${explainGithubStatus(post.status)}` };
    } catch (err) {
        return { dispatched: false, error: err instanceof Error ? err.message : String(err) };
    }
}
