/**
 * Consensus Engine — merges extraction results using confidence-weighted voting.
 *
 * Algorithm:
 * 1. Group prices within 5% tolerance
 * 2. Largest group wins (most extractors agree)
 * 3. Within winning group, highest-confidence candidate is selected
 * 4. Non-price fields: take from highest-confidence extractor
 * 5. If no clear majority, flag needsReview
 */

import type { ConsensusResult, PriceCandidateInfo, VotableResult } from './types';

/**
 * Build consensus from multiple extraction results.
 */
export function buildConsensus(results: VotableResult[]): ConsensusResult {
  const defaultResult: ConsensusResult = {
    price: null, currency: null, title: null, image: null, brand: null,
    overallConfidence: 0, priceSource: 'none', agreement: 0, needsReview: true,
    priceCandidates: [],
  };

  if (results.length === 0) return defaultResult;

  // ── Collect all price candidates for debugging ──
  const priceCandidates: PriceCandidateInfo[] = results
    .filter((r) => r.price != null && r.price > 0)
    .map((r) => ({
      method: r.source,
      price: r.price!,
      currency: r.currency,
      confidence: r.confidence,
      reason: `Extracted by ${r.source} with confidence ${r.confidence}`,
    }));

  // ── Price Voting ──
  const priceResults = results.filter((r) => r.price != null && r.price > 0);
  let winningPrice: number | null = null;
  let winningCurrency: string | null = null;
  let priceSource = 'none';
  let agreement = 0;

  if (priceResults.length === 1) {
    // Single price — trust it
    winningPrice = priceResults[0].price;
    winningCurrency = priceResults[0].currency;
    priceSource = priceResults[0].source;
    agreement = 1;
  } else if (priceResults.length > 1) {
    // Group prices within 5% tolerance
    const groups = groupByTolerance(priceResults, 0.05);
    // Sort groups: largest first, then by highest avg confidence
    groups.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      const avgA = a.reduce((s, r) => s + r.confidence, 0) / a.length;
      const avgB = b.reduce((s, r) => s + r.confidence, 0) / b.length;
      return avgB - avgA;
    });

    const winningGroup = groups[0];
    agreement = winningGroup.length / priceResults.length;

    // Pick highest-confidence from winning group
    const best = winningGroup.sort((a, b) => b.confidence - a.confidence)[0];
    winningPrice = best.price;
    winningCurrency = best.currency;
    priceSource = best.source;
  }

  // ── Non-price fields: take from highest-confidence source ──
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  const title = sorted.find((r) => r.title)?.title ?? null;
  const image = sorted.find((r) => r.image)?.image ?? null;
  const brand = sorted.find((r) => r.brand)?.brand ?? null;
  const currency = winningCurrency ?? sorted.find((r) => r.currency)?.currency ?? null;

  // ── Smart Confidence Scoring ──
  const maxConf = Math.max(...results.map((r) => r.confidence));
  const priceConf = priceResults.length > 0 ? Math.max(...priceResults.map((r) => r.confidence)) : 0;
  
  let baseConfidence = Math.round(maxConf * 0.35 + priceConf * 0.35 + agreement * 100 * 0.3);
  
  // Boost: multiple extractors agree
  if (priceResults.length >= 3 && agreement >= 0.8) baseConfidence += 5;
  // Boost: retailer-specific parser found price
  if (priceResults.some((r) => r.source.includes('parser'))) baseConfidence += 3;
  
  // Reduce: possible financing/coupon noise
  const hasSuspiciousLowPrice = priceResults.some((r) => r.price != null && r.price < 10 && r.confidence < 50);
  if (hasSuspiciousLowPrice) baseConfidence -= 5;
  
  // Reduce: wide price disagreement (prices differ by >50%)
  if (priceResults.length >= 2) {
    const allPrices = priceResults.map((r) => r.price!);
    const maxP = Math.max(...allPrices);
    const minP = Math.min(...allPrices);
    if (maxP > 0 && (maxP - minP) / maxP > 0.5) baseConfidence -= 10;
  }
  
  const overallConfidence = Math.min(Math.max(baseConfidence, 0), 100);

  const needsReview = overallConfidence < 60 || (priceResults.length > 1 && agreement < 0.5);

  return {
    price: winningPrice,
    currency,
    title,
    image,
    brand,
    overallConfidence,
    priceSource,
    agreement,
    needsReview,
    priceCandidates,
  };
}

/**
 * Group results by price within a tolerance percentage.
 */
function groupByTolerance(results: VotableResult[], tolerance: number): VotableResult[][] {
  const groups: VotableResult[][] = [];

  for (const result of results) {
    if (result.price == null) continue;
    let placed = false;

    for (const group of groups) {
      const representative = group[0].price!;
      const diff = Math.abs(result.price - representative);
      const avg = (result.price + representative) / 2;
      if (diff / avg <= tolerance) {
        group.push(result);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([result]);
    }
  }

  return groups;
}
