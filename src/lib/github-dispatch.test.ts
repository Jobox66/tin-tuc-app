import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDispatch, maybeDispatchGithub, STALE_ACTIVE_MS } from './github-dispatch';

const MIN = 60_000;
const NOW = Date.parse('2026-11-09T04:00:00Z');
const run = (minAgo: number, status = 'completed') => ({ status, createdAt: NOW - minAgo * MIN });

test('shouldDispatch: chua co luot nao -> kich hoat', () => {
    assert.deepEqual(shouldDispatch(null, NOW, 10 * MIN), { dispatch: true });
});

test('shouldDispatch: nhip 10 phut, cron 5 phut, co bu 1 phut', () => {
    assert.equal(shouldDispatch(run(4), NOW, 10 * MIN).dispatch, false);
    assert.equal(shouldDispatch(run(9.5), NOW, 10 * MIN).dispatch, true);   // 9:30 + 1 phut bu >= 10
    assert.equal(shouldDispatch(run(15), NOW, 10 * MIN).dispatch, true);
    // Luot schedule cu 5 tieng (dang bi GitHub hoan) -> kich hoat
    assert.equal(shouldDispatch(run(300), NOW, 10 * MIN).dispatch, true);
});

test('shouldDispatch: luot truoc dang chay/cho -> khong chong them, tru khi treo', () => {
    assert.equal(shouldDispatch(run(12, 'in_progress'), NOW, 10 * MIN).dispatch, false);
    assert.equal(shouldDispatch(run(12, 'queued'), NOW, 10 * MIN).dispatch, false);
    assert.equal(shouldDispatch(run(STALE_ACTIVE_MS / MIN + 1, 'in_progress'), NOW, 10 * MIN).dispatch, true);
});

test('shouldDispatch: moc tao hong -> kich hoat', () => {
    assert.equal(shouldDispatch({ status: 'completed', createdAt: NaN }, NOW, 10 * MIN).dispatch, true);
});

// ===== maybeDispatchGithub voi fetch gia lap =====
const realFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => { globalThis.fetch = realFetch; process.env = { ...env }; });

type Call = { url: string; init?: RequestInit };
function mockFetch(responses: Response[]): Call[] {
    const calls: Call[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return responses.shift()!;
    }) as typeof fetch;
    return calls;
}
const runsBody = (minAgo: number, status = 'completed') =>
    Response.json({ workflow_runs: [{ status, created_at: new Date(NOW - minAgo * MIN).toISOString() }] });

test('maybeDispatchGithub: chua dat token -> khong goi mang', async () => {
    delete process.env.GH_DISPATCH_TOKEN;
    const calls = mockFetch([]);
    const r = await maybeDispatchGithub(NOW);
    assert.equal(r.dispatched, false);
    assert.match(r.reason!, /GH_DISPATCH_TOKEN/);
    assert.equal(calls.length, 0);
});

test('maybeDispatchGithub: du lau -> POST dispatches dung URL, header, body', async () => {
    process.env.GH_DISPATCH_TOKEN = 'github_pat_test';
    const calls = mockFetch([runsBody(20), new Response(null, { status: 204 })]);
    const r = await maybeDispatchGithub(NOW);
    assert.deepEqual(r, { dispatched: true });
    assert.equal(calls[0].url, 'https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/runs?per_page=1');
    assert.equal(calls[1].url, 'https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/dispatches');
    assert.equal(calls[1].init!.method, 'POST');
    assert.equal(calls[1].init!.body, '{"ref":"master"}');
    const h = calls[1].init!.headers as Record<string, string>;
    assert.equal(h.Authorization, 'Bearer github_pat_test');
    assert.equal(h['Content-Type'], 'application/json');
});

test('maybeDispatchGithub: luot truoc moi chay -> chi doc, khong POST', async () => {
    process.env.GH_DISPATCH_TOKEN = 'github_pat_test';
    const calls = mockFetch([runsBody(3)]);
    const r = await maybeDispatchGithub(NOW);
    assert.equal(r.dispatched, false);
    assert.equal(calls.length, 1);
});

test('maybeDispatchGithub: token het han -> loi de hieu, khong nem', async () => {
    process.env.GH_DISPATCH_TOKEN = 'github_pat_test';
    mockFetch([new Response('{"message":"Bad credentials"}', { status: 401 })]);
    const r = await maybeDispatchGithub(NOW);
    assert.equal(r.dispatched, false);
    assert.match(r.error!, /401.*het han/);
});

test('maybeDispatchGithub: mang loi -> tra error, khong nem', async () => {
    process.env.GH_DISPATCH_TOKEN = 'github_pat_test';
    globalThis.fetch = (async () => { throw new Error('timeout'); }) as typeof fetch;
    const r = await maybeDispatchGithub(NOW);
    assert.deepEqual(r, { dispatched: false, error: 'timeout' });
});
