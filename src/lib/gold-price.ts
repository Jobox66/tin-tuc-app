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
  buyPrice: number;    // Giá mua (VND per lượng)
  sellPrice: number;   // Giá bán (VND per lượng)
  worldPrice: string;  // Giá thế giới (USD/oz)
  updatedAt: string;   // e.g. "17/04/2026 12:04"
  timestamp: number;   // Unix timestamp
}

export interface GoldPriceSnapshot {
  items: GoldPriceItem[];
  fetchedAt: string;
  worldPriceUsd: string;
}

// Key public của BTMC. Cho phép override qua env để không phải sửa code khi BTMC đổi key.
const BTMC_API_KEY = process.env.BTMC_API_KEY || '3kd8ub1llcg9t45ez6v7';
const BTMC_API_URL = `https://api.btmc.vn/api/BTMCAPI/getpricebtmc?key=${BTMC_API_KEY}`;
const PNJ_API_URL = 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price';

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
  const response = await fetch(BTMC_API_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`BTMC API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
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
  const response = await fetch(PNJ_API_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`PNJ API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawItems = data?.data || [];
  const updatedAt: string = data?.updateDate || '';
  const timestamp = updatedAt ? parseVNDate(updatedAt) : Date.now();

  const items: GoldPriceItem[] = [];
  const seenKeys = new Set<string>();

  for (const raw of rawItems) {
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

  const btmc = await fetchBtmcPrices().catch(err => {
    console.error('❌ BTMC fetch failed:', err instanceof Error ? err.message : err);
    return { items: [] as GoldPriceItem[], worldPrice: '0' };
  });

  const pnj = await fetchPnjPrices(btmc.worldPrice).catch(err => {
    console.error('❌ PNJ fetch failed:', err instanceof Error ? err.message : err);
    return [] as GoldPriceItem[];
  });

  const items = [...btmc.items, ...pnj];
  const byType = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`🥇 BTMC: ${btmc.items.length} | PNJ: ${pnj.length} | tổng ${items.length} mặt hàng. World: $${btmc.worldPrice}/oz`);
  console.log(`🥇 Theo loại: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  return {
    items,
    fetchedAt: new Date().toISOString(),
    worldPriceUsd: btmc.worldPrice,
  };
}
