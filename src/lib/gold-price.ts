/**
 * Gold Price Crawler
 * - BTMC API (Bảo Tín Minh Châu): gồm cả vàng miếng SJC, nhẫn tròn trơn VRTL, trang sức
 * - PNJ API: nhẫn trơn PNJ, nữ trang các tuổi vàng
 */

export type GoldType = 'nhan' | 'mieng' | 'trangsuc' | 'nguyenlieu' | 'khac';

export const GOLD_TYPE_LABELS: Record<GoldType, string> = {
  nhan: 'Vàng nhẫn',
  mieng: 'Vàng miếng',
  trangsuc: 'Trang sức',
  nguyenlieu: 'Nguyên liệu',
  khac: 'Khác',
};

export interface GoldPriceItem {
  name: string;        // Product name
  brand: string;       // SJC | BTMC | PNJ | Nguyên liệu | Khác
  type: GoldType;      // Phân loại mặt hàng (nhẫn / miếng / trang sức ...)
  karat: string;       // e.g. "24k"
  purity: string;      // e.g. "999.9"
  buyPrice: number;    // Giá mua (VND/chỉ - 3.75g; da doi chieu voi gia the gioi)
  sellPrice: number;   // Giá bán (VND/chỉ)
  worldPrice: string;  // Giá thế giới (USD/oz)
  updatedAt: string;   // e.g. "17/04/2026 12:04"
  timestamp: number;   // Unix timestamp
}

export interface GoldPriceSnapshot {
  items: GoldPriceItem[];
  fetchedAt: string;
  worldPriceUsd: string;
  usdVnd: number;         // Ty gia USD/VND luc chup snapshot
  sourceErrors: string[]; // Nguon nao loi va loi gi - duoc ghi vao sheet de chan doan
}

// ===== Quy doi gia the gioi ve gia trong nuoc =====
// Gia the gioi niem yet USD/troy ounce; trong nuoc niem yet VND/chi.
export const OZ_TO_GRAM = 31.1035;
export const CHI_TO_GRAM = 3.75;

/** Ty gia du phong khi ca hai nguon deu khong goi duoc */
const FALLBACK_USD_VND = 26210;

/** USD/oz -> VND/chi theo ty gia cho truoc */
export function worldToVndPerChi(usdPerOz: number, usdVnd: number): number {
  if (!usdPerOz || !usdVnd) return 0;
  return Math.round(usdPerOz * (CHI_TO_GRAM / OZ_TO_GRAM) * usdVnd);
}

// Key public của BTMC. Cho phép override qua env để không phải sửa code khi BTMC đổi key.
const BTMC_API_KEY = process.env.BTMC_API_KEY || '3kd8ub1llcg9t45ez6v7';
// Host tach rieng de co the ep loi khi test nhanh du phong:
//   BTMC_API_HOST=khong-ton-tai.invalid npm run sync:local
const BTMC_HOST = process.env.BTMC_API_HOST || 'api.btmc.vn';
const BTMC_PATH = `${BTMC_HOST}/api/BTMCAPI/getpricebtmc?key=${BTMC_API_KEY}`;
// Endpoint HTTPS cua BTMC khong ket noi duoc tu runner GitHub Actions ("fetch failed"
// o ca 3 lan thu), trong khi HTTP thi duoc - doi chieu du lieu: lan CI cuoi cung lay
// duoc BTMC la 17/9 10:42 bang http, ngay sau khi chuyen sang https thi hong hoan toan.
// Thu HTTPS truoc, that bai moi ha xuong HTTP. Day la API gia cong khai, key cung
// cong khai, khong co bi mat nao di qua duong truyen.
const BTMC_API_URL = `https://${BTMC_PATH}`;
const BTMC_API_URL_INSECURE = `http://${BTMC_PATH}`;
const PNJ_API_URL = 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price';
const VCB_FX_URL = 'https://www.vietcombank.com.vn/api/exchangerates?date=now';
const FALLBACK_FX_URL = 'https://open.er-api.com/v6/latest/USD';
// Gia vang the gioi doc lap. Truoc day chi lay tu BTMC nen BTMC chet la mat luon.
const WORLD_GOLD_URL = 'https://api.gold-api.com/price/XAU';
// Nguon du phong cho BTMC/SJC. api.btmc.vn CHI truy cap duoc tu trong nuoc
// (timeout ca cong 80 lan 443 tu runner GitHub, ba proxy nuoc ngoai cung khong
// cham toi, va ca trang btmc.vn cung vay). 24h.com.vn thi goi duoc tu ca hai phia
// va niem yet lai dung gia cua BTMC - da doi chieu cung thoi diem: lech 0 dong.
const FALLBACK_24H_URL = 'https://www.24h.com.vn/gia-vang-hom-nay-c425.html';

// fetch mac dinh cua Node khong gui User-Agent giong trinh duyet; mot so API
// Viet Nam chan client la. Them UA + retry de bot phu thuoc vao moi truong chay.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function fetchJson(url: string, label: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        console.warn(`   ${label}: lần ${attempt} thất bại (${err instanceof Error ? err.message : err}), thử lại...`);
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
  }
  // Kem ca `cause`: fetch cua Node chi bao "fetch failed" o tang tren,
  // nguyen nhan that (ECONNREFUSED / ETIMEDOUT / TLS...) nam trong cause.
  const detail = lastError instanceof Error
    ? `${lastError.message}${lastError.cause ? ` (${String(lastError.cause).slice(0, 160)})` : ''}`
    : String(lastError);
  throw new Error(`${label} thất bại sau ${attempts} lần: ${detail}`);
}

/** Ty gia USD/VND - Vietcombank (gia ban ra), du phong open.er-api.com */
export async function fetchUsdVndRate(): Promise<number> {
  try {
    const data = await fetchJson(VCB_FX_URL, 'Vietcombank FX') as { Data?: { currencyCode?: string; sell?: string }[] };
    const usd = data?.Data?.find(x => x.currencyCode === 'USD');
    const rate = parseFloat(String(usd?.sell ?? '').replace(/,/g, ''));
    if (rate > 0) {
      console.log(`💱 Tỷ giá USD/VND (Vietcombank bán ra): ${rate.toLocaleString('en-US')}`);
      return rate;
    }
    throw new Error('Khong doc duoc gia ban USD');
  } catch (err) {
    console.warn(`💱 Vietcombank lỗi (${err instanceof Error ? err.message : err}), dùng nguồn dự phòng...`);
  }

  try {
    const data = await fetchJson(FALLBACK_FX_URL, 'open.er-api') as { rates?: { VND?: number } };
    const rate = data?.rates?.VND;
    if (rate && rate > 0) {
      console.log(`💱 Tỷ giá USD/VND (open.er-api): ${Math.round(rate).toLocaleString('en-US')}`);
      return Math.round(rate);
    }
  } catch (err) {
    console.error(`💱 Nguồn dự phòng cũng lỗi: ${err instanceof Error ? err.message : err}`);
  }

  console.warn(`💱 Dùng tỷ giá mặc định ${FALLBACK_USD_VND}`);
  return FALLBACK_USD_VND;
}

/**
 * Mặt hàng ĐẠI DIỆN của mỗi nhà, dùng cho biểu đồ lịch sử.
 * Chọn theo tiêu chí: sản phẩm chủ lực + có bề dày dữ liệu nhất trong sheet.
 * (BTMC lấy vàng miếng VRTL vì NHẪN TRÒN TRƠN mới được thu thập từ 17/9/2026.)
 */
export const BRAND_REPRESENTATIVE: Record<string, string> = {
  SJC: 'VÀNG MIẾNG SJC (Vàng SJC)',
  BTMC: 'VÀNG MIẾNG VRTL (Vàng Rồng Thăng Long)',
  PNJ: 'Nhẫn Trơn PNJ 999.9',
};

/**
 * "23/9/2026" -> timestamp. Chuoi ngay KHONG sap xep duoc bang so sanh chuoi
 * ("9/6/2026" > "23/9/2026" theo thu tu chu cai), nen moi noi can sap xep
 * theo thoi gian deu phai di qua ham nay.
 * Dat o day (khong phai google-sheets.ts) vi component phia client can dung,
 * ma google-sheets.ts keo theo ca googleapis - khong dong goi cho trinh duyet duoc.
 */
export function dayToTimestamp(day: string): number {
  const [d, m, y] = day.split('/').map(Number);
  if (!d || !m || !y) return 0;
  return new Date(y, m - 1, d).getTime();
}

/** Thứ tự phân khu hiển thị trên trang */
export const BRAND_SECTIONS = ['SJC', 'PNJ', 'BTMC'] as const;

/**
 * Phân loại mặt hàng theo tên. Dùng chung cho cả lúc ghi sheet lẫn lúc hiển thị,
 * nên áp dụng được ngược lại cho dữ liệu lịch sử đã lưu (sheet không có cột type).
 */
export function classifyGoldType(name: string): GoldType {
  const n = name.toUpperCase();
  if (n.includes('NHẪN')) return 'nhan';
  if (n.includes('NGUYÊN LIỆU')) return 'nguyenlieu';
  if (n.includes('MIẾNG') || n.includes('BẢN VÀNG') || n.includes('ĐỒNG XU')) return 'mieng';
  if (n.includes('TRANG SỨC') || n.includes('NỮ TRANG')) return 'trangsuc';
  return 'khac';
}

/**
 * Classify brand from product name (case-insensitive - BTMC trộn hoa/thường trong
 * cùng một tên, vd "NHẪN TRÒN TRƠN (Vàng Rồng Thăng Long)")
 */
export function classifyBrand(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('SJC')) return 'SJC';
  if (n.includes('RỒNG THĂNG LONG') || n.includes('VRTL') || n.includes('BTMC')) return 'BTMC';
  if (n.includes('ĐẮC LỘC')) return 'BTMC';
  if (n.includes('NHẪN TRÒN TRƠN')) return 'BTMC';
  if (n.includes('QUÀ MỪNG')) return 'BTMC';
  if (n.includes('NGUYÊN LIỆU')) return 'Nguyên liệu';
  if (n.includes('THƯƠNG HIỆU KHÁC') || n.includes('ĐỐI TÁC')) return 'Khác';
  return 'Khác';
}

/**
 * Parse Vietnamese date string to timestamp
 */
function parseVNDate(dateStr: string): number {
  // Format: "17/04/2026 12:04"
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!parts) return Date.now();
  const [, day, month, year, hour, minute] = parts;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`).getTime();
}

/**
 * Doc bang gia tu 24h.com.vn. Gia niem yet bang NGHIN dong/LUONG,
 * trong khi toan he thong dung VND/CHI -> nhan 100 (1 luong = 10 chi).
 * Ten san pham giu y het ten ben API BTMC de chuoi lich su khong bi dut doan.
 */
export async function fetch24hGoldPrices(): Promise<GoldPriceItem[]> {
  const res = await fetch(FALLBACK_24H_URL, {
    headers: { Accept: 'text/html', 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const html = await res.text();

  // Chi lay nhung dong bu dap dung phan mat khi khong goi duoc BTMC
  // Dung dong "BTMC SJC" chu KHONG phai dong "SJC": dong "SJC" la gia do chinh
  // cong ty SJC niem yet, con ta can gia BTMC niem yet cho vang mieng SJC - dung
  // nhu API BTMC van tra ve. Doi chieu cung thoi diem: dong nay lech 0d so voi API,
  // trong khi dong "SJC" lech 40-60k. Dung nham se lam chuoi lich su nhay giua hai
  // loai bao gia khac nhau.
  const WANTED: Record<string, { name: string; brand: string }> = {
    bao_tin_minh_chau: { name: 'VÀNG MIẾNG SJC (Vàng SJC)', brand: 'SJC' },
    btmc_vrtl: { name: 'VÀNG MIẾNG VRTL (Vàng Rồng Thăng Long)', brand: 'BTMC' },
  };

  const updatedAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const items: GoldPriceItem[] = [];

  for (const [, key, body] of html.matchAll(/<tr[^>]*data-seach="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const want = WANTED[key];
    if (!want) continue;

    const nums = [...body.matchAll(/<span class="fixW">([\d,.]+)<\/span>/g)]
      .map(m => parseInt(m[1].replace(/\D/g, ''), 10));
    if (nums.length < 2) continue;

    const buyPrice = nums[0] * 100;
    const sellPrice = nums[1] * 100;
    // Chan gia tri vo ly (doi don vi, doi layout...) thay vi ghi bua vao sheet
    if (buyPrice < 1_000_000 || buyPrice > 100_000_000 || sellPrice < buyPrice) {
      console.warn(`   24h: bỏ qua ${key} vì giá bất thường (${buyPrice}/${sellPrice})`);
      continue;
    }

    items.push({
      name: want.name,
      brand: want.brand,
      type: classifyGoldType(want.name),
      karat: '24k',
      purity: '999.9',
      buyPrice,
      sellPrice,
      worldPrice: '0',
      updatedAt,
      timestamp: Date.now(),
    });
  }

  if (items.length === 0) throw new Error('Khong doc duoc dong gia nao tu 24h.com.vn');
  return items;
}

/** Giá vàng thế giới USD/oz từ nguồn độc lập với BTMC */
export async function fetchWorldGoldUsd(): Promise<number> {
  const data = await fetchJson(WORLD_GOLD_URL, 'World gold API') as { price?: number };
  const price = Number(data?.price);
  if (!price || price <= 0) throw new Error('Khong doc duoc gia vang the gioi');
  return Math.round(price);
}

/**
 * BTMC: trả về ~1000 dòng gồm cả BẠC. Chỉ dòng vàng mới có karat ("24k").
 */
async function fetchBtmcPrices(): Promise<{ items: GoldPriceItem[]; worldPrice: string }> {
  let data: { DataList?: { Data?: Record<string, string>[] } };
  try {
    data = await fetchJson(BTMC_API_URL, 'BTMC API (https)', 2) as typeof data;
  } catch {
    data = await fetchJson(BTMC_API_URL_INSECURE, 'BTMC API (http)', 2) as typeof data;
    console.log('   BTMC: lấy được qua HTTP.');
  }
  const rawItems = data?.DataList?.Data || [];
  if (rawItems.length === 0) {
    console.warn('⚠️ BTMC API returned no data');
    return { items: [], worldPrice: '0' };
  }

  const items: GoldPriceItem[] = [];
  const seenKeys = new Set<string>();
  let worldPrice = '0';

  for (const item of rawItems) {
    const row = item['@row'];
    const name = item[`@n_${row}`] || '';
    const karat = item[`@k_${row}`] || '';
    const purity = item[`@h_${row}`] || '';
    const buyStr = item[`@pb_${row}`] || '0';
    const sellStr = item[`@ps_${row}`] || '0';
    const worldStr = item[`@pt_${row}`] || '0';
    const dateStr = item[`@d_${row}`] || '';

    // Chỉ lấy mặt hàng VÀNG. Dòng bạc không có karat.
    // (Trước đây còn lọc thêm name.includes('VÀNG') phân biệt hoa-thường, khiến
    //  "NHẪN TRÒN TRƠN (Vàng Rồng Thăng Long)" và "ĐỒNG XU VRTL" bị loại oan.)
    if (!karat) continue;
    const upper = name.toUpperCase();
    if (upper.includes('BẠC') || upper.includes(' AG ')) continue;

    // Deduplicate - keep only the LATEST entry per product name
    if (seenKeys.has(name)) continue;
    seenKeys.add(name);

    if (worldStr && worldStr !== '0') {
      worldPrice = worldStr;
    }

    items.push({
      name,
      brand: classifyBrand(name),
      type: classifyGoldType(name),
      karat,
      purity,
      buyPrice: parseInt(buyStr, 10) || 0,
      sellPrice: parseInt(sellStr, 10) || 0,
      worldPrice: worldStr,
      updatedAt: dateStr,
      timestamp: parseVNDate(dateStr),
    });
  }

  return { items, worldPrice };
}

/**
 * PNJ: giá niêm yết bằng NGHÌN đồng (14280 = 14.280.000 VNĐ/lượng).
 */
async function fetchPnjPrices(worldPrice: string): Promise<GoldPriceItem[]> {
  const data = await fetchJson(PNJ_API_URL, 'PNJ API') as { data?: Record<string, unknown>[]; updateDate?: string };
  const rawItems = data?.data || [];
  const updatedAt: string = data?.updateDate || '';
  const timestamp = updatedAt ? parseVNDate(updatedAt) : Date.now();

  const items: GoldPriceItem[] = [];
  const seenKeys = new Set<string>();

  for (const raw of rawItems as { tensp?: string; giamua?: unknown; giaban?: unknown }[]) {
    const name = (raw?.tensp || '').trim();
    if (!name || seenKeys.has(name)) continue;
    seenKeys.add(name);

    const buyPrice = Math.round((Number(raw?.giamua) || 0) * 1000);
    const sellPrice = Math.round((Number(raw?.giaban) || 0) * 1000);
    if (buyPrice === 0 && sellPrice === 0) continue;

    items.push({
      name,
      brand: 'PNJ',
      type: classifyGoldType(name),
      karat: '',
      purity: '',
      buyPrice,
      sellPrice,
      worldPrice,
      updatedAt,
      timestamp,
    });
  }

  return items;
}

/**
 * Fetch gold prices từ cả BTMC và PNJ.
 * Một nguồn lỗi không làm hỏng nguồn còn lại.
 */
export async function fetchGoldPrices(): Promise<GoldPriceSnapshot> {
  console.log('🥇 Fetching gold prices from BTMC + PNJ...');

  const sourceErrors: string[] = [];
  const note = (src: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${src} fetch failed: ${msg}`);
    sourceErrors.push(`${src}: ${msg}`);
  };

  const usdVnd = await fetchUsdVndRate();

  let btmc = await fetchBtmcPrices().catch(err => {
    note('BTMC', err);
    return { items: [] as GoldPriceItem[], worldPrice: '0' };
  });

  // BTMC khong goi duoc (thuong la khi chay ngoai Viet Nam) -> lay bu tu 24h.com.vn
  if (btmc.items.length === 0) {
    try {
      const items = await fetch24hGoldPrices();
      console.log(`   ↪️ Dùng nguồn dự phòng 24h.com.vn: ${items.length} mặt hàng (${items.map(i => i.brand).join(', ')}).`);
      sourceErrors.push(`BTMC: đã bù bằng 24h.com.vn (${items.length} mặt hàng)`);
      btmc = { items, worldPrice: '0' };
    } catch (err) {
      note('24h.com.vn', err);
    }
  }

  const pnj = await fetchPnjPrices(btmc.worldPrice).catch(err => {
    note('PNJ', err);
    return [] as GoldPriceItem[];
  });

  // Gia the gioi uu tien nguon doc lap; BTMC chi la du phong
  let worldPrice = btmc.worldPrice;
  try {
    worldPrice = String(await fetchWorldGoldUsd());
  } catch (err) {
    note('WorldGold', err);
    if (worldPrice === '0') console.warn('⚠️ Không có giá thế giới từ cả hai nguồn');
  }
  if (worldPrice !== btmc.worldPrice) {
    btmc.items.forEach(i => { i.worldPrice = worldPrice; });
  }
  pnj.forEach(i => { i.worldPrice = worldPrice; });

  // Mot nguon im lang van la su co. Truoc day BTMC chet tu 19/9 ma khong ai
  // biet vi PNJ van tra du lieu nen tong so item > 0.
  const dead = [
    btmc.items.length === 0 ? 'BTMC' : null,
    pnj.length === 0 ? 'PNJ' : null,
  ].filter(Boolean) as string[];
  if (dead.length > 0) {
    console.error(`❌ NGUỒN GIÁ VÀNG KHÔNG TRẢ DỮ LIỆU: ${dead.join(', ')}`);
    dead.forEach(d => {
      if (!sourceErrors.some(e => e.startsWith(d))) sourceErrors.push(`${d}: trả về 0 mặt hàng`);
    });
  }

  const items = [...btmc.items, ...pnj];
  const byType = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`🥇 BTMC: ${btmc.items.length} | PNJ: ${pnj.length} | tổng ${items.length} mặt hàng. World: $${worldPrice}/oz`);
  console.log(`🥇 Theo loại: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  if (worldPrice !== '0') {
    const vnd = worldToVndPerChi(parseFloat(worldPrice), usdVnd);
    console.log(`🌍 Giá thế giới $${worldPrice}/oz ≈ ${vnd.toLocaleString('en-US')} VNĐ/chỉ`);
  }

  return {
    items,
    fetchedAt: new Date().toISOString(),
    worldPriceUsd: worldPrice,
    usdVnd,
    sourceErrors,
  };
}

/** Danh sach nguon khong tra du lieu trong snapshot - dung de bao loi o sync */
/**
 * Nguon BAT BUOC: thieu la coi nhu luot sync hong, workflow phai bao do.
 * Nguon TUY CHON: ghi nhan va canh bao, nhung khong lam hong luot chay.
 *
 * BTMC nam o nhom tuy chon vi `api.btmc.vn` KHONG ket noi duoc tu runner
 * GitHub Actions - ConnectTimeoutError o ca cong 80 lan 443, va ba dich vu
 * proxy nuoc ngoai cung khong cham toi. Trong khi do PNJ, api.gold-api.com
 * va ca Vietcombank (cung la site Viet Nam) deu goi duoc binh thuong, nen
 * day la van de rieng cua host do chu khong phai chan dien rong.
 * De BTMC o nhom bat buoc thi moi luot CI deu do -> mat luon tac dung canh bao.
 */
const REQUIRED_SOURCES = ['PNJ'] as const;
const OPTIONAL_SOURCES = ['BTMC'] as const;

function missingSources(snapshot: GoldPriceSnapshot, list: readonly string[]): string[] {
  const brands = new Set(snapshot.items.map(i => i.brand));
  return list.filter(src =>
    src === 'BTMC' ? !brands.has('BTMC') && !brands.has('SJC') : !brands.has(src)
  );
}

/** Nguồn bắt buộc bị thiếu - làm hỏng lượt sync */
export function deadSources(snapshot: GoldPriceSnapshot): string[] {
  return missingSources(snapshot, REQUIRED_SOURCES);
}

/** Nguồn tuỳ chọn bị thiếu - chỉ cảnh báo */
export function degradedSources(snapshot: GoldPriceSnapshot): string[] {
  return missingSources(snapshot, OPTIONAL_SOURCES);
}
