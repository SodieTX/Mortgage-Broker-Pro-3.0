# Contributing to Mortgage Broker Pro

> "The people who are crazy enough to think they can change the world are the ones who do." - Steve Jobs

Welcome to Mortgage Broker Pro. We believe in crafting software with the same attention to detail that goes into designing a product at Apple. Every line of code, every commit message, every pull request should reflect our commitment to excellence.

## Our Philosophy

Before you contribute, understand what drives us:

1. **Simplicity is the ultimate sophistication** - If it's complex, we've failed
2. **Details matter** - The difference between good and great is in the details
3. **User experience is everything** - Code is for humans first, computers second
4. **Quality over quantity** - One perfect feature beats ten mediocre ones

## Getting Started

### Prerequisites

```bash
# Required tools - each chosen for excellence
node >= 18.0.0    # Latest LTS for stability
npm >= 9.0.0      # Modern package management
postgresql >= 15  # Advanced features we actually use
redis >= 7.0      # Performance that matters
docker >= 20.10   # Consistency across environments
```

### Setting Up Your Development Environment

```bash
# 1. Fork and clone with purpose
git clone https://github.com/YOUR_USERNAME/mortgage-broker-pro.git
cd mortgage-broker-pro

# 2. Install dependencies elegantly
npm ci  # Ensures exact versions from lock file

# 3. Set up your environment
cp .env.example .env
# Edit .env with your local settings

# 4. Initialize the database
docker-compose up -d postgres redis
npm run db:migrate
npm run db:seed

# 5. Start developing
npm run dev
```

## Code Standards

### The Mortgage Broker Pro Way

```typescript
// ❌ Bad: Complex, unclear, no soul
function calc(a, b, c) {
  if (a > 0 && b > 0) {
    return a / b * 100 > c ? true : false;
  }
  return false;
}

// ✅ Beautiful: Clear, purposeful, elegant
function isLoanToValueAcceptable(
  loanAmount: Money,
  propertyValue: Money,
  maxLTV: Percentage
): boolean {
  if (loanAmount.isNegative() || propertyValue.isZeroOrNegative()) {
    return false;
  }
  
  const ltv = calculateLTV(loanAmount, propertyValue);
  return ltv.isLessThanOrEqual(maxLTV);
}
```

### TypeScript Excellence

```typescript
// Every type tells a story
interface LenderMatch {
  lender: Lender;
  confidence: Percentage;
  programs: MatchedProgram[];
  reasoning: MatchReasoning;
}

// Enums that make sense
enum ScenarioStatus {
  Draft = 'DRAFT',
  Matching = 'MATCHING',
  Shopping = 'SHOPPING',
  OffersReceived = 'OFFERS_RECEIVED',
  Presented = 'PRESENTED',
  Won = 'WON',
  Lost = 'LOST'
}

// Utility types that enhance clarity
type Money = {
  amount: number;
  currency: Currency;
  isNegative(): boolean;
  isZeroOrNegative(): boolean;
  format(): string;
};
```

### SQL Craftsmanship

```sql
-- ❌ Bad: Unreadable mess
SELECT * FROM scenarios s JOIN offers o ON s.id = o.scenario_id JOIN lenders l ON o.lender_id = l.id WHERE s.status = 'ACTIVE' AND o.created_at > NOW() - INTERVAL '7 days';

-- ✅ Beautiful: Structured like poetry
WITH recent_scenarios AS (
  SELECT 
    s.scenario_id,
    s.status,
    s.confidence_score,
    COUNT(o.offer_id) as offer_count
  FROM scenarios s
  LEFT JOIN offers o ON o.scenario_id = s.scenario_id
  WHERE s.status = 'SHOPPING'
    AND s.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
  GROUP BY s.scenario_id
),
lender_performance AS (
  SELECT 
    l.lender_id,
    l.name as lender_name,
    AVG(o.response_time_hours) as avg_response_time,
    COUNT(DISTINCT o.scenario_id) as scenarios_quoted
  FROM lenders l
  JOIN offers o ON o.lender_id = l.lender_id
  WHERE o.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
  GROUP BY l.lender_id, l.name
)
SELECT 
  rs.*,
  json_agg(
    json_build_object(
      'lender', lp.lender_name,
      'response_time', lp.avg_response_time
    ) ORDER BY lp.avg_response_time
  ) as lender_metrics
FROM recent_scenarios rs
CROSS JOIN lender_performance lp
GROUP BY rs.scenario_id, rs.status, rs.confidence_score, rs.offer_count;
```

## Commit Guidelines

### Commit Messages That Tell a Story

```bash
# ❌ Bad
git commit -m "fix stuff"
git commit -m "update code"
git commit -m "changes"

# ✅ Beautiful
git commit -m "fix: prevent race condition in offer processing

When multiple offers arrived simultaneously, the system would occasionally 
duplicate entries due to missing transaction isolation. This change wraps 
the offer creation in a proper transaction with SERIALIZABLE isolation.

Fixes #234"
```

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature that users will notice
- `fix`: Bug fix that users will appreciate
- `perf`: Performance improvement that users will feel
- `refactor`: Code improvement that maintains behavior
- `test`: Test addition or improvement
- `docs`: Documentation that helps others
- `style`: Code formatting (rare, we use formatters)
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(matching): add intelligent fallback for partial matches

Previously, scenarios with minor criteria mismatches would return no results.
Now the system intelligently suggests lenders that meet critical criteria
even if secondary criteria don't match perfectly.

This improves match rates by approximately 23% based on historical data.

perf(database): optimize scenario query with strategic indexes

Reduced p95 query time from 450ms to 12ms by adding a composite index
on (status, created_at) with INCLUDE clause for commonly accessed fields.

This change makes the scenario list page feel instant.
```

## Pull Request Process

### Creating a Perfect Pull Request

1. **Branch with Purpose**
   ```bash
   git checkout -b feat/smart-lender-matching
   git checkout -b fix/offer-duplication-edge-case
   git checkout -b perf/scenario-list-optimization
   ```

2. **Develop with Intention**
   - Write code that you'd be proud to show Steve Jobs
   - Test everything - automated and manual
   - Document why, not just what

3. **Self-Review Like a Critic**
   ```bash
   # Before opening PR, ask yourself:
   - Would I want to maintain this code?
   - Is this the simplest solution that works?
   - Have I considered edge cases?
   - Will this delight users?
   ```

4. **Open PR with Excellence**

### PR Template

```markdown
## What This Changes

Brief description of what this PR accomplishes and why it matters to users.

## The Journey

Describe the problem you're solving and your approach. Include:
- What wasn't working before
- Why you chose this solution
- Alternative approaches considered

## Visual Proof

Include screenshots, GIFs, or videos showing:
- Before and after states
- Performance improvements
- User experience enhancements

## Testing Performed

- [ ] Unit tests pass with 100% coverage of new code
- [ ] Integration tests cover happy and unhappy paths  
- [ ] Manual testing in development environment
- [ ] Performance impact measured and acceptable
- [ ] Accessibility standards maintained

## Checklist

- [ ] Code follows our style guide
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No commented-out code
- [ ] No console.logs or debug statements
- [ ] Database migrations are reversible
- [ ] API changes are backward compatible

## Breaking Changes

List any breaking changes and migration steps required.
```

## Code Review Philosophy

### As a Reviewer

- **Look for simplicity** - Can this be simpler?
- **Consider the user** - How does this improve their experience?
- **Appreciate craftsmanship** - Acknowledge beautiful code
- **Suggest, don't demand** - "Have you considered..." vs "You must..."
- **Test the change** - Pull it locally, feel it yourself

### As a Reviewee

- **Welcome feedback** - Every comment makes the code better
- **Explain your thinking** - Share the why behind decisions
- **Be responsive** - Address feedback promptly
- **Iterate to perfection** - Don't settle for "good enough"

## Testing Standards

### Test Like You're Shipping to Millions

```typescript
// ❌ Bad: Testing implementation
it('should call database', () => {
  const spy = jest.spyOn(db, 'query');
  service.findLenders();
  expect(spy).toHaveBeenCalled();
});

// ✅ Beautiful: Testing behavior
describe('LenderMatchingService', () => {
  describe('when finding lenders for a DSCR loan', () => {
    it('should return lenders ordered by match confidence', async () => {
      const scenario = createScenario({
        loanAmount: Money.USD(750_000),
        propertyValue: Money.USD(1_000_000),
        propertyType: PropertyType.SingleFamily,
        state: 'TX'
      });

      const matches = await service.findMatches(scenario);

      expect(matches).toHaveLength(3);
      expect(matches[0].confidence).toBeGreaterThan(90);
      expect(matches).toBeSortedBy('confidence', { descending: true });
    });

    it('should handle edge case of no matching lenders gracefully', async () => {
      const scenario = createScenario({
        loanAmount: Money.USD(50_000), // Below all minimums
        state: 'AK' // Limited coverage
      });

      const matches = await service.findMatches(scenario);

      expect(matches).toHaveLength(0);
      expect(scenario.status).toBe(ScenarioStatus.NoMatches);
    });
  });
});
```

## Documentation

### Document with Purpose

```typescript
/**
 * Matches lenders to a loan scenario using our proprietary algorithm.
 * 
 * The matching process considers:
 * - Hard criteria (must match exactly)
 * - Soft criteria (preferred but not required)
 * - Lender preferences and historical performance
 * - Current market conditions
 * 
 * @example
 * const matches = await matchLenders(scenario);
 * // Returns lenders sorted by confidence, highest first
 * 
 * @param scenario - The loan scenario to match
 * @returns Promise resolving to matched lenders with confidence scores
 * @throws {InvalidScenarioError} If scenario is missing required fields
 */
async function matchLenders(scenario: Scenario): Promise<LenderMatch[]> {
  // Implementation
}
```

## Release Process

### Ship It Like Apple

1. **Feature Freeze** - Stop adding, start polishing
2. **Release Candidate** - Test like your reputation depends on it
3. **Release Notes** - Tell the story of what's new
4. **Deploy** - With confidence and rollback plan
5. **Monitor** - Watch metrics like a hawk
6. **Celebrate** - Great work deserves recognition

## Community

### Be the Community You Want to See

- **Help others** - Answer questions with patience
- **Share knowledge** - Blog about your contributions
- **Stay positive** - Encourage and uplift
- **Think long-term** - Build for the future

## Recognition

We believe in recognizing excellence:

- 🌟 **Contributors** - First PR merged
- 🚀 **Core Contributors** - 10+ PRs merged  
- 🏆 **Maintainers** - Demonstrated excellence over time
- 💎 **Lifetime Contributors** - Transformational impact

## Final Thoughts

> "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work." - Steve Jobs

Every contribution to Mortgage Broker Pro is an opportunity to do great work. Make it count.

---

**Questions?** Open an issue with the `question` label.  
**Ideas?** Open an issue with the `enhancement` label.  
**Ready to contribute?** We can't wait to see what you build.
