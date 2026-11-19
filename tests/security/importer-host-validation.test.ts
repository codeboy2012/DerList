import { describe, expect, it } from 'vitest';
import { BestBuyImporter } from '@/lib/importers/bestbuy';
import { NeweggImporter } from '@/lib/importers/newegg';
import { PCPartPickerImporter } from '@/lib/importers/pcpartpicker';

describe('retailer importer host validation', () => {
  it('accepts real retailer hosts and subdomains', () => {
    expect(NeweggImporter.detect('https://www.newegg.com/p/1').match).toBe(true);
    expect(NeweggImporter.detect('https://newegg.ca/p/1').match).toBe(true);
    expect(BestBuyImporter.detect('https://www.bestbuy.com/site/example/6501234.p').match).toBe(
      true
    );
    expect(BestBuyImporter.detect('https://bestbuy.ca/site/example/6501234.p').match).toBe(true);
    expect(PCPartPickerImporter.detect('https://pcpartpicker.com/list/abc123').match).toBe(true);
    expect(PCPartPickerImporter.detect('https://uk.pcpartpicker.com/list/abc123').match).toBe(true);
  });

  it('rejects deceptive suffixes that merely contain the retailer name', () => {
    expect(NeweggImporter.detect('https://newegg.com.evil.test/p/1').match).toBe(false);
    expect(NeweggImporter.detect('https://notnewegg.com/p/1').match).toBe(false);
    expect(BestBuyImporter.detect('https://bestbuy.com.evil.test/site/x/6501234.p').match).toBe(
      false
    );
    expect(PCPartPickerImporter.detect('https://pcpartpicker.com.evil.test/list/abc').match).toBe(
      false
    );
    expect(PCPartPickerImporter.detect('https://notpcpartpicker.com/list/abc').match).toBe(false);
  });

  it('rejects non-HTTP schemes and wrong paths', () => {
    expect(NeweggImporter.detect('javascript:alert(1)').match).toBe(false);
    expect(BestBuyImporter.detect('ftp://bestbuy.com/site/x/6501234.p').match).toBe(false);
    expect(PCPartPickerImporter.detect('https://pcpartpicker.com/random').match).toBe(false);
  });
});
