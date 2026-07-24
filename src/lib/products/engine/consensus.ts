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

import type { ConsensusResult, VotableResult } from './types';

/**
 * Build consensus from multiple extraction results.
 */
export function buildConsensus(results: VotableResult[]): ConsensusResult {
  const defaultResult: ConsensusResult = {
    price: null, currency: null, title: null, image: null, brand: null,
    overallConfidence: 0, priceSource: 'none', agreement: 0, needsReview: true,
  };

  if (results.length === 0) return defaultResult;

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

  // ── Overall confidence ──
  const maxConf = Math.max(...results.map((r) => r.confidence));
  const priceConf = priceResults.length > 0 ? Math.max(...priceResults.map((r) => r.confidence)) : 0;
  const overallConfidence = Math.round((maxConf * 0.4 + priceConf * 0.4 + agreement * 100 * 0.2));

  const needsReview = overallConfidence < 60 || (priceResults.length > 1 && agreement < 0.5);

  return {
    price: winningPrice,
    currency,
    title,
    image,
    brand,
    overallConfidence: Math.min(overallConfidence, 100),
    priceSource,
    agreement,
    needsReview,
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
