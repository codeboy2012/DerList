/**
 * LIVE End-to-End Product Identification Test
 *
 * Tests the full pipeline WITH configured providers (SerpAPI, Brave, Vertex AI).
 * Uses the real admin user ID to access provider credentials.
 *
 * This test verifies that the pipeline can ACTUALLY identify:
 * https://www.amazon.com/dp/B0GSS4SGZR
 */
import { identifyProduct } from '../src/lib/products/identification';
import type { IdentificationInput } from '../src/lib/products/identification';
import { extractAsinFromUrl } from '../src/lib/importers/amazon';
import { normalizeUrl } from '../src/lib/products/normalize';

// The real user ID from the database
const ADMIN_USER_ID = 'cmsp32pc700003aoeekzuw1bn';

const TEST_URL = 'https://www.amazon.com/dp/B0GSS4SGZR?ref_=cm_sw_r_cp_ud_dp_ARN85V7HGQ7BRN1Z8RM1';

async function runLiveTest() {
  console.log('================================================================');
  console.log('  LIVE E2E TEST — WITH REAL PROVIDERS');
  console.log('  URL:', TEST_URL);
  console.log('  User:', ADMIN_USER_ID);
  console.log('================================================================');
  console.log('');

  const asin = extractAsinFromUrl(TEST_URL);
  const canonicalUrl = normalizeUrl(TEST_URL);

  console.log('ASIN:', asin);
  console.log('Canonical URL:', canonicalUrl);
  console.log('');

  const input: IdentificationInput = {
    rawInput: TEST_URL,
    inputType: 'url',
    url: canonicalUrl ?? undefined,
    asin: asin ?? undefined,
    retailer: 'Amazon',
    country: 'us',
    userId: ADMIN_USER_ID,
    directExtractionFailed: true,
    failureReason: 'Amazon returned CAPTCHA page',
  };

  console.log('Running identification pipeline with REAL providers...');
  console.log('  Search providers: SerpAPI, Brave Search');
  console.log('  AI provider: Google Vertex AI - DerList');
  console.log('');

  try {
    const result = await identifyProduct(input);

    console.log('================================================================');
    console.log('  PIPELINE RESULT');
    console.log('================================================================');
    console.log('');
    console.log('Success:', result.success);
    console.log('Needs review:', result.needsReview);
    console.log('Status message:', result.statusMessage);
    console.log('Duration:', result.durationMs, 'ms');
    console.log('');

    console.log('Providers attempted:');
    for (const attempt of result.providersAttempted) {
      const icon = attempt.success ? '✓' : '✗';
      console.log(`  ${icon} ${attempt.provider}: confidence=${attempt.confidence}, ${attempt.durationMs}ms`);
      if (attempt.error) console.log(`    Error: ${attempt.error}`);
    }
    console.log('');

    if (result.product) {
      console.log('================================================================');
      console.log('  IDENTIFIED PRODUCT');
      console.log('================================================================');
      console.log('');
      console.log('Title:       ', result.product.title);
      console.log('Brand:       ', result.product.brand ?? '(none)');
      console.log('Price:       ', result.product.price != null ? `$${result.product.price}` : 'null (unavailable)');
      console.log('Currency:    ', result.product.currency);
      console.log('Retailer:    ', result.product.retailer);
      console.log('Image:       ', result.product.imageUrl ? result.product.imageUrl.substring(0, 100) + '...' : 'null');
      console.log('Category:    ', result.product.category ?? '(none)');
      console.log('ASIN:        ', result.product.asin);
      console.log('URL:         ', result.product.url);
      console.log('Confidence:  ', result.product.confidence);
      console.log('Completeness:', result.completeness + '%');
      console.log('Source:      ', result.product.source);
      console.log('Description: ', result.product.description ? result.product.description.substring(0, 100) + '...' : '(none)');
      console.log('');
      console.log('Evidence:');
      for (const ev of result.product.evidence) {
        console.log(`  - ${ev}`);
      }
      console.log('');

      // Field sources
      if (result.product.fieldSources) {
        console.log('Field Sources:');
        const fs = result.product.fieldSources;
        if (fs.titleSource) console.log(`  title:       ${fs.titleSource}`);
        if (fs.brandSource) console.log(`  brand:       ${fs.brandSource}`);
        if (fs.priceSource) console.log(`  price:       ${fs.priceSource}`);
        if (fs.imageSource) console.log(`  image:       ${fs.imageSource}`);
        if (fs.categorySource) console.log(`  category:    ${fs.categorySource}`);
        if (fs.urlSource) console.log(`  url:         ${fs.urlSource}`);
        console.log('');
      }

      // Timing
      if (result.timing) {
        console.log('Timing:');
        if (result.timing.searchMs) console.log(`  search:      ${result.timing.searchMs}ms`);
        if (result.timing.aiMs) console.log(`  ai:          ${result.timing.aiMs}ms`);
        if (result.timing.imageMs) console.log(`  image:       ${result.timing.imageMs}ms`);
        console.log(`  total:       ${result.timing.totalMs}ms`);
        console.log('');
      }

      // Import status
      console.log('Import Status:', (result as any).importStatus ?? 'unknown');
      console.log('');

      // Verification checks
      console.log('================================================================');
      console.log('  VERIFICATION');
      console.log('================================================================');
      console.log('');

      const title = result.product.title;
      const badTitles = ['Amazon', 'Amazon.com', 'Product', 'Untitled Product', 'undefined', 'null', ''];
      const titleOk = !badTitles.includes(title) && title.length > 5;
      console.log('Title is NOT garbage:', titleOk ? 'PASS' : 'FAIL');

      const priceOk = result.product.price === null || (result.product.price > 5 && result.product.price !== 10);
      console.log('Price is NOT arbitrary:', priceOk ? 'PASS' : 'FAIL');

      const brandOk = result.product.brand !== 'Amazon' || title.toLowerCase().includes('amazon');
      console.log('Brand is correct:', brandOk ? 'PASS' : 'FAIL');

      const imageOk = !result.product.imageUrl || !result.product.imageUrl.includes('encrypted-tbn');
      console.log('Image is NOT Google thumbnail:', imageOk ? 'PASS' : 'FAIL');

      const urlNotTitle = title !== TEST_URL && !title.startsWith('https://');
      console.log('Title is NOT the URL:', urlNotTitle ? 'PASS' : 'FAIL');

      console.log('');
      console.log('Overall:', titleOk && priceOk && brandOk && imageOk && urlNotTitle ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED');

    } else {
      console.log('No product identified.');
      console.log('');
      console.log('This means all providers failed. Check:');
      console.log('  - Are SerpAPI/Brave credentials valid?');
      console.log('  - Is Google Vertex AI configured?');
      console.log('  - Are providers enabled?');
    }
  } catch (error) {
    console.error('FATAL ERROR:', error);
  }
}

runLiveTest();
