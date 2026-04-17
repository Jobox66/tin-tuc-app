/**
 * Gold Price Crawler - Fetches gold prices from BTMC API
 * BTMC API includes both BTMC (Bảo Tín Minh Châu) and SJC gold prices
 */

export interface GoldPriceItem {
  name: string;        // Product name
  brand: string;       // SJC | BTMC | Other
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

const BTMC_API_URL = 'http://api.btmc.vn/api/BTMCAPI/getpricebtmc?key=3kd8ub1llcg9t45ez6v7';

/**
 * Classify brand from product name
 */
function classifyBrand(name: string): string {
  if (name.includes('SJC')) return 'SJC';
  if (name.includes('RỒNG THĂNG LONG') || name.includes('VRTL') || name.includes('BTMC')) return 'BTMC';
  if (name.includes('ĐẮC LỘC')) return 'BTMC';
  if (name.includes('NHẪN TRÒN TRƠN')) return 'BTMC';
  if (name.includes('QUÀ MỪNG')) return 'BTMC';
  if (name.includes('NGUYÊN LIỆU')) return 'Nguyên liệu';
  if (name.includes('THƯƠNG HIỆU KHÁC') || name.includes('ĐỐI TÁC')) return 'Khác';
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
 * Fetch gold prices from BTMC API
 * Only returns GOLD items (not silver/bac)
 */
export async function fetchGoldPrices(): Promise<GoldPriceSnapshot> {
  console.log('🥇 Fetching gold prices from BTMC API...');

  const response = await fetch(BTMC_API_URL, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`BTMC API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawItems = data?.DataList?.Data || [];

  if (rawItems.length === 0) {
    console.warn('⚠️ BTMC API returned no data');
    return { items: [], fetchedAt: new Date().toISOString(), worldPriceUsd: '0' };
  }

  // Parse and filter for GOLD items only (have karat value like "24k")
  const goldItems: GoldPriceItem[] = [];
  const seenKeys = new Set<string>(); // Deduplicate by name+time
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

    // Only gold items (have karat value)
    if (!karat || !name.includes('VÀNG')) continue;

    // Deduplicate - keep only the LATEST entry per product name
    const key = name;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Track world price
    if (worldStr && worldStr !== '0') {
      worldPrice = worldStr;
    }

    const buyPrice = parseInt(buyStr, 10) || 0;
    const sellPrice = parseInt(sellStr, 10) || 0;

    goldItems.push({
      name,
      brand: classifyBrand(name),
      karat,
      purity,
      buyPrice,
      sellPrice,
      worldPrice: worldStr,
      updatedAt: dateStr,
      timestamp: parseVNDate(dateStr),
    });
  }

  console.log(`🥇 Fetched ${goldItems.length} gold price items. World price: $${worldPrice}/oz`);

  return {
    items: goldItems,
    fetchedAt: new Date().toISOString(),
    worldPriceUsd: worldPrice,
  };
}

/**
 * Format price to Vietnamese format (e.g. 16,750,000)
 */
export function formatVND(price: number): string {
  if (price === 0) return '—';
  return price.toLocaleString('vi-VN');
}

/**
 * Format price in millions (e.g. "167.5 tr")
 */
export function formatMillions(price: number): string {
  if (price === 0) return '—';
  const millions = price / 100000;
  return `${millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}`;
}
