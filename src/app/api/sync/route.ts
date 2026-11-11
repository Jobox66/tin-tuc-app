/**
 * LUOT NHANH tren Vercel: cron-job.org goi moi vai phut de tin len sheet ngay,
 * khong phai cho GitHub Actions (lich bi GitHub hoan 4-8 tieng tren repo cong khai).
 *
 * Chi doc RSS + them bai moi (cot I = PENDING). Tom tat bang Python, gia vang,
 * don trung/cat bot van do GitHub Actions lam - va route nay tu kich hoat
 * GitHub Actions moi ~30 phut (xem src/lib/github-dispatch.ts).
 *
 * Goi:  GET (hoac POST) /api/sync
 *       Header  Authorization: Bearer <SYNC_SECRET>
 * SYNC_SECRET dat trong Environment Variables cua Vercel, KHONG dua vao code/chat.
 */
import { timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { CATEGORIES, collectCategory } from '@/lib/news-sync';
import { maybeDispatchGithub } from '@/lib/github-dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Luot nhanh do tai may mat 3-4s; de du cho mang cham
export const maxDuration = 30;

const MIN_SECRET_LENGTH = 24;

function checkAuth(req: Request): 'ok' | 'unauthorized' | 'not-configured' {
    const secret = process.env.SYNC_SECRET;
    if (!secret || secret.length < MIN_SECRET_LENGTH) return 'not-configured';
    const got = Buffer.from(req.headers.get('authorization') ?? '');
    const want = Buffer.from(`Bearer ${secret}`);
    return got.length === want.length && timingSafeEqual(got, want) ? 'ok' : 'unauthorized';
}

async function handle(req: Request): Promise<Response> {
    const auth = checkAuth(req);
    if (auth === 'not-configured') {
        console.error(`[api/sync] SYNC_SECRET chưa đặt hoặc ngắn hơn ${MIN_SECRET_LENGTH} ký tự - từ chối mọi lời gọi.`);
        return Response.json({ ok: false, error: 'SYNC_SECRET chưa được cấu hình trên server' }, { status: 503 });
    }
    if (auth === 'unauthorized') {
        return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    // Kich hoat GitHub Actions (tom tat, gia vang, don dep) song song voi lay tin.
    // Loi o day KHONG lam route tra 500: cron-job.org tu tat job sau nhieu lan
    // loi, se keo theo ca luot lay tin. Loi duoc ghi log Vercel + tra trong JSON.
    const githubTask = maybeDispatchGithub(startedAt).then(r => {
        if (r.error) console.error(`[api/sync] GitHub dispatch lỗi: ${r.error}`);
        return r;
    });

    // Hai sheet doc lap -> chay song song
    const results = await Promise.all(CATEGORIES.map(async cat => {
        try {
            return { name: cat.name, added: await collectCategory(cat) };
        } catch (err) {
            console.error(`[api/sync] ${cat.name} lỗi:`, err);
            return { name: cat.name, error: err instanceof Error ? err.message : String(err) };
        }
    }));

    // Trang dang cache 60s - co bai moi thi lam moi ngay
    if (results.some(r => (r.added ?? 0) > 0)) revalidatePath('/');

    const github = await githubTask;
    const failed = results.some(r => 'error' in r);
    return Response.json(
        { ok: !failed, results, github, ms: Date.now() - startedAt },
        // Mot muc loi -> 500 de cron-job.org bao loi (phan thanh cong van da ghi)
        { status: failed ? 500 : 200, headers: { 'Cache-Control': 'no-store' } }
    );
}

export const GET = handle;
export const POST = handle;
