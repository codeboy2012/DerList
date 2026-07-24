/**
 * Product Health Score — calculates how complete and reliable a product's data is.
 *
 * Score 0-100 based on:
 * - Image exists (20 points)
 * - Title verified / not generic (15 points)
 * - Price exists (25 points)
 * - Brand identified (10 points)
 * - Retailer identified (5 points)
 * - Identifiers (SKU/ASIN/GTIN/MPN) (10 points)
 * - Active tracking (has recent PriceHistory) (10 points)
 * - Stock status known (5 points)
 */

export interface ProductHealthData {
  image: string | null;
  title: string | null;
  currentPrice: unknown;
  brand: string | null;
  retailer: string | null;
  sku: string | null;
  gtin: string | null;
  mpn: string | null;
  inStock: boolean | null;
  lastFetchedAt: Date | null;
}

export interface HealthResult {
  score: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  breakdown: { category: string; points: number; maxPoints: number }[];
}

export function calculateProductHealth(product: ProductHealthData): HealthResult {
  const breakdown: HealthResult['breakdown'] = [];
  let total = 0;

  // Image (20 points)
  const imagePoints = product.image ? 20 : 0;
  breakdown.push({ category: 'Product Image', points: imagePoints, maxPoints: 20 });
  total += imagePoints;

  // Title (15 points) — deduct if it looks generic
  let titlePoints = 0;
  if (product.title) {
    titlePoints = 15;
    // Reduce if title is very short or looks like a URL
    if (product.title.length < 10 || product.title.startsWith('http')) titlePoints = 5;
  }
  breakdown.push({ category: 'Product Title', points: titlePoints, maxPoints: 15 });
  total += titlePoints;

  // Price (25 points)
  const pricePoints = product.currentPrice != null ? 25 : 0;
  breakdown.push({ category: 'Price Data', points: pricePoints, maxPoints: 25 });
  total += pricePoints;

  // Brand (10 points)
  const brandPoints = product.brand ? 10 : 0;
  breakdown.push({ category: 'Brand', points: brandPoints, maxPoints: 10 });
  total += brandPoints;

  // Retailer (5 points)
  const retailerPoints = product.retailer ? 5 : 0;
  breakdown.push({ category: 'Retailer', points: retailerPoints, maxPoints: 5 });
  total += retailerPoints;

  // Identifiers (10 points — any one of SKU/GTIN/MPN)
  const hasIdentifier = !!(product.sku || product.gtin || product.mpn);
  const idPoints = hasIdentifier ? 10 : 0;
  breakdown.push({ category: 'Identifiers', points: idPoints, maxPoints: 10 });
  total += idPoints;

  // Active tracking (10 points — fetched within last 48 hours)
  let trackingPoints = 0;
  if (product.lastFetchedAt) {
    const ageMs = Date.now() - new Date(product.lastFetchedAt).getTime();
    if (ageMs < 48 * 60 * 60 * 1000) trackingPoints = 10;
    else if (ageMs < 7 * 24 * 60 * 60 * 1000) trackingPoints = 5;
  }
  breakdown.push({ category: 'Active Tracking', points: trackingPoints, maxPoints: 10 });
  total += trackingPoints;

  // Stock status (5 points)
  const stockPoints = product.inStock !== null ? 5 : 0;
  breakdown.push({ category: 'Stock Status', points: stockPoints, maxPoints: 5 });
  total += stockPoints;

  // Label
  const label: HealthResult['label'] =
    total >= 90 ? 'Excellent' :
    total >= 70 ? 'Good' :
    total >= 50 ? 'Fair' : 'Poor';

  return { score: total, label, breakdown };
}
