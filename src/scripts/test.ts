import { fetchGoldPrices } from '../lib/gold-price';
fetchGoldPrices().then(res => console.log(JSON.stringify(res.items.slice(0, 3), null, 2)));
