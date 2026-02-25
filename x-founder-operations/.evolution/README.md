# .evolution/

Runtime state directory for the X Founder Operations skill.

Files in this directory are generated and updated during daily operations. They are gitignored (only this README is committed).

## Files

- `reflections.json` — Accumulated lessons learned, performance patterns, and strategy adjustments. Updated during daily/weekly reviews.
- `strategy-state.json` — Current strategy parameters: what content mix is working, which posting times are optimal, which engagement tactics are producing results. Used by the PDCA loop to inform next-cycle planning.

## Design Principle

Evolution state captures *what the skill has learned about this specific account* over time. It allows the daily operations loop to make data-informed decisions rather than starting from scratch each cycle.

Unlike `config/` (which captures user intent and setup), `.evolution/` captures empirical results and adaptive learning.
