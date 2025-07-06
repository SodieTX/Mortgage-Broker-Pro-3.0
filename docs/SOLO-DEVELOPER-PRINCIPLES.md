# Solo Developer Guiding Principles

## Our North Star
Build software that one person can confidently maintain, evolve, and troubleshoot at 2 AM.

## Core Principles

### 1. Simplicity Over Cleverness
- If you have to think twice to understand it, it's too complex
- Choose boring technology that just works
- Every abstraction must earn its place

### 2. Operational Simplicity
- Everything runs with one command
- Logs tell a clear story
- Errors are self-diagnosing
- Rollback is always possible

### 3. Maintainability First
- Code should read like documentation
- Dependencies should be minimal and stable
- Upgrades should be predictable
- Nothing should be "magic"

### 4. Cost-Conscious Architecture
- Start with what can run on a single server
- Scale only when proven necessary
- Use managed services sparingly
- Monitor costs from day one

### 5. Sustainable Pace
- Build in small, complete increments
- Each feature should be "done done"
- Technical debt is paid immediately
- Documentation happens inline

## What This Means Practically

### We Choose:
- PostgreSQL over multiple databases
- Monolith-first over microservices
- Server-rendered over complex SPAs
- Proven libraries over cutting edge
- SQL over ORMs when it's clearer

### We Avoid:
- Kubernetes (until absolutely necessary)
- Multiple programming languages
- Complex build pipelines
- Anything that requires a team to maintain
- Technologies with steep learning curves

### We Prioritize:
1. It works correctly
2. It's easy to understand
3. It's easy to change
4. It's easy to debug
5. It's easy to deploy

## The "2 AM Test"
Before adding any technology or pattern, ask:
"If this breaks at 2 AM, can I fix it half-asleep?"

If the answer is no, we need a simpler solution.

## Our Development Mantras
- "Make it work, make it right, make it fast" - in that order
- "You aren't gonna need it" (YAGNI)
- "Do the simplest thing that could possibly work"
- "Explicit is better than implicit"
- "Build for the current need, design for tomorrow's change"

## Remember
This software is your path to independence. Every decision should support that goal.
