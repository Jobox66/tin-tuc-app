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
  usdVnd: number;       // Ty gia USD/VND luc chup snapshot
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
const BTMC_API_URL = `https://api.btmc.vn/api/BTMCAPI/getpricebtmc?key=${BTMC_API_KEY}`;
const PNJ_API_URL = 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price';
const VCB_FX_URL = 'https://www.vietcombank.com.vn/api/exchangerates?date=now';
const FALLBACK_FX_URL = 'https://open.er-api.com/v6/latest/USD';

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
  throw new Error(`${label} thất bại sau ${attempts} lần: ${lastError instanceof Error ? lastError.message : lastError}`);
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
 * BTMC: trả về ~1000 dòng gồm cả BẠC. Chỉ dòng vàng mới có karat ("24k").
 */
async function fetchBtmcPrices(): Promise<{ items: GoldPriceItem[]; worldPrice: string }> {
  const data = await fetchJson(BTMC_API_URL, 'BTMC API') as { DataList?: { Data?: Record<string, string>[] } };
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

  const usdVnd = await fetchUsdVndRate();

  const btmc = await fetchBtmcPrices().catch(err => {
    console.error('❌ BTMC fetch failed:', err instanceof Error ? err.message : err);
    return { items: [] as GoldPriceItem[], worldPrice: '0' };
  });

  const pnj = await fetchPnjPrices(btmc.worldPrice).catch(err => {
    console.error('❌ PNJ fetch failed:', err instanceof Error ? err.message : err);
    return [] as GoldPriceItem[];
  });

  // Mot nguon im lang van la su co. Truoc day BTMC chet tu 19/9 ma khong ai
  // biet vi PNJ van tra du lieu nen tong so item > 0.
  const dead = [
    btmc.items.length === 0 ? 'BTMC' : null,
    pnj.length === 0 ? 'PNJ' : null,
  ].filter(Boolean);
  if (dead.length > 0) {
    console.error(`❌ NGUỒN GIÁ VÀNG KHÔNG TRẢ DỮ LIỆU: ${dead.join(', ')}`);
  }

  const items = [...btmc.items, ...pnj];
  const byType = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`🥇 BTMC: ${btmc.items.length} | PNJ: ${pnj.length} | tổng ${items.length} mặt hàng. World: $${btmc.worldPrice}/oz`);
  console.log(`🥇 Theo loại: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  if (btmc.worldPrice !== '0') {
    const vnd = worldToVndPerChi(parseFloat(btmc.worldPrice), usdVnd);
    console.log(`🌍 Giá thế giới $${btmc.worldPrice}/oz ≈ ${vnd.toLocaleString('en-US')} VNĐ/chỉ`);
  }

  return {
    items,
    fetchedAt: new Date().toISOString(),
    worldPriceUsd: btmc.worldPrice,
    usdVnd,
  };
}

/** Danh sach nguon khong tra du lieu trong snapshot - dung de bao loi o sync */
export function deadSources(snapshot: GoldPriceSnapshot): string[] {
  const brands = new Set(snapshot.items.map(i => i.brand));
  const dead: string[] = [];
  if (!brands.has('BTMC') && !brands.has('SJC')) dead.push('BTMC');
  if (!brands.has('PNJ')) dead.push('PNJ');
  return dead;
}
