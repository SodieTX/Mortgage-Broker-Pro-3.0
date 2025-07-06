# Internationalization Guide

> "Think different" transcends language. Excellence is universal.

This guide ensures Mortgage Broker Pro delivers a world-class experience to users everywhere, respecting their language, culture, and regional requirements.

## Design Principles

### 1. Universal First, Local Second

Design for the world, then adapt locally. Like Apple products that work beautifully everywhere.

```typescript
// ❌ Bad: US-centric assumptions
interface Address {
  street: string;
  city: string;
  state: string;  // Not all countries have states
  zip: string;     // Called postal code elsewhere
}

// ✅ Beautiful: Universal design
interface Address {
  lines: string[];        // Flexible for any format
  locality: string;       // City/Town/Village
  region?: string;        // State/Province/Prefecture
  postalCode?: string;    // Optional, not all countries use
  countryCode: string;    // ISO 3166-1 alpha-2
}
```

### 2. Content Architecture

```typescript
// Structured for clarity across languages
interface I18nContent {
  // Identifiers never change
  key: string;
  
  // Translations organized by purpose
  translations: {
    [locale: string]: {
      text: string;
      context?: string;        // For translators
      maxLength?: number;      // UI constraints
      placeholders?: Record<string, string>;
    };
  };
  
  // Metadata for quality
  lastReviewed?: Date;
  reviewer?: string;
  approved?: boolean;
}
```

## Implementation Patterns

### 1. Message Formatting

```typescript
// Beautiful message system that respects linguistic differences
class MessageFormatter {
  // Numbers formatted correctly everywhere
  formatCurrency(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  
  // Dates that make sense locally
  formatDate(date: Date, locale: string, style: 'short' | 'long' = 'short'): string {
    const options: Intl.DateTimeFormatOptions = {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    }[style];
    
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
  
  // Pluralization that works in all languages
  formatPlural(key: string, count: number, locale: string): string {
    const rules = new Intl.PluralRules(locale);
    const rule = rules.select(count);
    
    // Keys like: scenarios_zero, scenarios_one, scenarios_other
    const pluralKey = `${key}_${rule}`;
    return this.getMessage(pluralKey, { count });
  }
}

// Usage
formatter.formatCurrency(750000, 'USD', 'en-US');  // $750,000
formatter.formatCurrency(750000, 'EUR', 'fr-FR');  // 750 000 €
formatter.formatCurrency(750000, 'JPY', 'ja-JP');  // ¥750,000
```

### 2. Component Internationalization

```tsx
// React components that adapt beautifully
import { useI18n } from './i18n-context';

interface LoanSummaryProps {
  loan: Loan;
}

export function LoanSummary({ loan }: LoanSummaryProps) {
  const { t, locale, formatCurrency, formatPercent } = useI18n();
  
  return (
    <Card>
      <CardHeader>
        <Title>{t('loan.summary.title')}</Title>
      </CardHeader>
      <CardBody>
        <Metric
          label={t('loan.amount')}
          value={formatCurrency(loan.amount)}
          direction={locale === 'ar' ? 'rtl' : 'ltr'}
        />
        <Metric
          label={t('loan.rate')}
          value={formatPercent(loan.rate)}
        />
        <Metric
          label={t('loan.term')}
          value={t('loan.term.months', { count: loan.termMonths })}
        />
      </CardBody>
    </Card>
  );
}

// Metric component that handles RTL languages elegantly
function Metric({ label, value, direction = 'ltr' }) {
  return (
    <div className={`metric metric--${direction}`}>
      <span className="metric__label">{label}</span>
      <span className="metric__value">{value}</span>
    </div>
  );
}
```

### 3. Database Design for Multi-Language

```sql
-- Beautiful schema that scales globally

-- Currencies with proper metadata
CREATE TABLE currencies (
    code CHAR(3) PRIMARY KEY,  -- ISO 4217
    symbol TEXT NOT NULL,
    decimal_places INT NOT NULL DEFAULT 2,
    -- Localized names
    names JSONB NOT NULL  -- {"en": "US Dollar", "es": "Dólar estadounidense"}
);

-- Countries with rich data
CREATE TABLE countries (
    code CHAR(2) PRIMARY KEY,  -- ISO 3166-1 alpha-2
    code3 CHAR(3) NOT NULL,    -- ISO 3166-1 alpha-3
    numeric_code CHAR(3),       -- ISO 3166-1 numeric
    names JSONB NOT NULL,       -- Localized country names
    currencies TEXT[],          -- Accepted currencies
    languages TEXT[],           -- Official languages
    phone_prefix TEXT,
    address_format JSONB        -- Country-specific address rules
);

-- Flexible address storage
CREATE TABLE addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Universal fields
    country_code CHAR(2) NOT NULL REFERENCES countries(code),
    postal_code TEXT,
    
    -- Flexible localized fields
    components JSONB NOT NULL,
    /*
    Examples:
    US: {
      "street": "123 Main St",
      "city": "Dallas",
      "state": "TX",
      "zip": "75201"
    }
    JP: {
      "postal_code": "100-0001",
      "prefecture": "東京都",
      "city": "千代田区",
      "address": "千代田1-1"
    }
    */
    
    -- Geocoding (universal)
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    
    -- Display
    formatted_address TEXT,  -- Pre-formatted for display
    locale TEXT NOT NULL     -- Locale used for formatting
);

-- Translated content
CREATE TABLE translations (
    translation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    locale TEXT NOT NULL,
    value TEXT NOT NULL,
    context TEXT,  -- Context for translators
    max_length INT,  -- UI constraints
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    UNIQUE(key, locale)
);

-- Audit for translation changes
CREATE TABLE translation_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    translation_id UUID REFERENCES translations(translation_id),
    old_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT
);
```

## Locale-Specific Features

### 1. Smart Defaults

```typescript
// Intelligent defaults based on user context
class LocaleDetector {
  static async detectOptimalLocale(request: Request): Promise<LocaleConfig> {
    // 1. Check user preference (if logged in)
    const userLocale = await this.getUserPreference(request);
    if (userLocale) return userLocale;
    
    // 2. Check browser/app settings
    const acceptLanguage = request.headers.get('accept-language');
    const browserLocale = this.parseAcceptLanguage(acceptLanguage);
    
    // 3. Geo-detection (respectfully)
    const geoData = await this.getGeoData(request.ip);
    
    // 4. Smart combination
    return {
      language: browserLocale.language || 'en',
      region: geoData.countryCode || 'US',
      currency: geoData.currency || 'USD',
      timezone: geoData.timezone || 'UTC',
      measurementSystem: this.getMeasurementSystem(geoData.countryCode),
      dateFormat: this.getDateFormat(browserLocale.language, geoData.countryCode),
    };
  }
  
  private static getMeasurementSystem(countryCode: string): 'metric' | 'imperial' {
    // Only US, Liberia, and Myanmar use imperial
    return ['US', 'LR', 'MM'].includes(countryCode) ? 'imperial' : 'metric';
  }
}
```

### 2. Regional Business Logic

```typescript
// Business rules that adapt to local regulations
class RegionalCompliance {
  // Different regions have different requirements
  static getRequiredDocuments(locale: LocaleConfig, loanType: string): Document[] {
    const baseDocuments = [
      { key: 'proof_of_income', required: true },
      { key: 'property_appraisal', required: true },
    ];
    
    // Region-specific requirements
    switch (locale.region) {
      case 'US':
        return [
          ...baseDocuments,
          { key: 'credit_report', required: true },
          { key: 'tax_returns', required: true, years: 2 },
        ];
        
      case 'CA':
        return [
          ...baseDocuments,
          { key: 'notice_of_assessment', required: true },
          { key: 'mortgage_stress_test', required: true },
        ];
        
      case 'GB':
        return [
          ...baseDocuments,
          { key: 'proof_of_deposit', required: true },
          { key: 'solicitor_details', required: true },
        ];
        
      default:
        return baseDocuments;
    }
  }
  
  // Interest calculation varies by region
  static calculateInterest(
    principal: number,
    rate: number,
    termMonths: number,
    locale: LocaleConfig
  ): InterestCalculation {
    switch (locale.region) {
      case 'US':
        // US uses APR
        return this.calculateAPR(principal, rate, termMonths);
        
      case 'GB':
        // UK uses APR but displays AER
        return this.calculateAER(principal, rate, termMonths);
        
      case 'CA':
        // Canada compounds semi-annually
        return this.calculateCanadianMortgage(principal, rate, termMonths);
        
      default:
        return this.calculateSimpleInterest(principal, rate, termMonths);
    }
  }
}
```

## Testing for Global Excellence

### 1. Automated I18n Testing

```typescript
// Test every locale like it's your primary market
describe('Internationalization', () => {
  const locales = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'ar-SA'];
  
  locales.forEach(locale => {
    describe(`Locale: ${locale}`, () => {
      it('should format currency correctly', () => {
        const amount = 1234567.89;
        const formatted = formatter.formatCurrency(amount, locale);
        
        // Verify it matches expected format for locale
        expect(formatted).toMatchSnapshot(`currency-${locale}`);
        
        // Ensure no data loss
        const parsed = formatter.parseCurrency(formatted, locale);
        expect(parsed).toBeCloseTo(amount, 2);
      });
      
      it('should handle text expansion gracefully', () => {
        // German text is often 30% longer than English
        const englishText = 'Submit Application';
        const germanText = t('submit_application', 'de-DE');
        
        // UI should accommodate expansion
        expect(germanText.length).toBeLessThan(englishText.length * 1.5);
      });
      
      it('should respect RTL languages', () => {
        if (['ar', 'he', 'fa', 'ur'].includes(locale.split('-')[0])) {
          const element = render(<App locale={locale} />);
          expect(element.dir).toBe('rtl');
          expect(element.style.textAlign).toBe('right');
        }
      });
    });
  });
});
```

### 2. Visual Regression Testing

```typescript
// Ensure UI beauty in every language
class VisualI18nTester {
  static async testAllLocales(component: Component) {
    for (const locale of this.getTestLocales()) {
      // Render with locale
      const rendered = await render(component, { locale });
      
      // Test different viewport sizes
      for (const viewport of this.getViewports()) {
        await page.setViewport(viewport);
        
        // Capture screenshot
        const screenshot = await page.screenshot({
          fullPage: true,
          path: `screenshots/${component.name}-${locale}-${viewport.name}.png`
        });
        
        // Compare with baseline
        const diff = await compareImages(screenshot, baseline);
        expect(diff.percentage).toBeLessThan(0.1); // 0.1% tolerance
      }
      
      // Test with high contrast mode
      await page.emulateMediaFeatures([
        { name: 'prefers-contrast', value: 'high' }
      ]);
      
      // Test with reduced motion
      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' }
      ]);
    }
  }
}
```

## Performance Optimization

### 1. Lazy Loading Translations

```typescript
// Load only what's needed, when it's needed
class TranslationLoader {
  private static cache = new Map<string, Translations>();
  
  static async loadForRoute(route: string, locale: string): Promise<Translations> {
    const cacheKey = `${route}:${locale}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Load common translations
    const common = await import(`./locales/${locale}/common.json`);
    
    // Load route-specific translations
    const routeTranslations = await import(`./locales/${locale}/${route}.json`);
    
    const merged = { ...common, ...routeTranslations };
    this.cache.set(cacheKey, merged);
    
    return merged;
  }
  
  // Preload for smooth transitions
  static preloadForLocale(locale: string, routes: string[]) {
    routes.forEach(route => {
      requestIdleCallback(() => {
        this.loadForRoute(route, locale);
      });
    });
  }
}
```

### 2. Efficient Storage

```typescript
// Store translations efficiently
class TranslationStorage {
  // Use IndexedDB for offline support
  private static async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('translations', 1);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('translations')) {
          const store = db.createObjectStore('translations', {
            keyPath: ['locale', 'key']
          });
          store.createIndex('locale', 'locale');
          store.createIndex('lastUsed', 'lastUsed');
        }
      };
    });
  }
  
  // Intelligent caching with LRU eviction
  static async get(locale: string, key: string): Promise<string | null> {
    const db = await this.getDB();
    const tx = db.transaction(['translations'], 'readwrite');
    const store = tx.objectStore('translations');
    
    const result = await store.get([locale, key]);
    
    if (result) {
      // Update last used timestamp
      result.lastUsed = Date.now();
      await store.put(result);
      return result.value;
    }
    
    return null;
  }
}
```

## Checklist for Global Excellence

Before each release, ensure:

- [ ] All text is externalized (no hardcoded strings)
- [ ] UI accommodates 30% text expansion
- [ ] RTL languages display correctly
- [ ] Date/time/number formats respect locale
- [ ] Currency calculations are precise
- [ ] Address forms adapt to country
- [ ] Legal requirements are met per region
- [ ] Translations are reviewed by native speakers
- [ ] Performance is consistent across locales
- [ ] Accessibility works in all languages

## The Global Mindset

> "Simplicity is the ultimate sophistication" - in every language.

Great internationalization is invisible. Users shouldn't think about it—everything should just work beautifully in their language, respecting their culture and expectations.

Like Apple products that feel native everywhere, Mortgage Broker Pro should feel like it was designed specifically for each user's locale, while maintaining the consistency and excellence of the global experience.
