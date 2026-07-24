/**
 * Retailer Parser Registry
 *
 * Maps domains to specialized parsers. When a URL is imported, the registry
 * determines which parser (if any) should handle extraction for that retailer.
 */

import type { RetailerParser } from '../engine/types';
import { amazonParser } from './amazon';

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All registered retailer parsers.
 * New parsers are added here as they're implemented.
 */
const parsers: RetailerParser[] = [
  amazonParser,
  // bestbuyParser,     // TODO: Task 8
  // neweggParser,      // TODO: Task 8
  // walmartParser,     // TODO: Task 8
  // targetParser,      // TODO: Task 8
  // microcenterParser, // TODO: Task 8
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the appropriate parser for a given domain.
 * Supports subdomains (e.g., "www.amazon.com" matches "amazon.com").
 *
 * @param domain - The bare domain (e.g., "amazon.com", "bestbuy.com")
 * @returns The matching parser, or null if no dedicated parser exists
 */
export function getParserForDomain(domain: string | null): RetailerParser | null {
  if (!domain) return null;

  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  for (const parser of parsers) {
    for (const parserDomain of parser.domains) {
      // Exact match
      if (normalizedDomain === parserDomain) return parser;
      // Subdomain match (e.g., "smile.amazon.com" ends with ".amazon.com")
      if (normalizedDomain.endsWith(`.${parserDomain}`)) return parser;
    }
  }

  return null;
}

/**
 * Get all registered parsers (for admin/debug display).
 */
export function getAllParsers(): RetailerParser[] {
  return [...parsers];
}

/**
 * Check if a domain has a dedicated parser.
 */
export function hasDedicatedParser(domain: string | null): boolean {
  return getParserForDomain(domain) !== null;
}
