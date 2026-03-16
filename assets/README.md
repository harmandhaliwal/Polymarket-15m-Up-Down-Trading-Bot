# Diagram assets for README

Place these images here so the main README can display them:

| File | Description |
|------|-------------|
| `docs-trading-loop.png` | Flowchart: WebSocket → price → cycle check → predictor → trade gate → first-side and second-side orders |
| `docs-predictor-pipeline.png` | Flowchart: Price → noise filter → pole detection → features → model → direction/confidence/signal |
| `docs-two-sided-orders.png` | Diagram: First-side at ask+0.01, second-side at 0.98 − firstSidePrice |

If these files are missing, the strategy section in the main README still documents the logic in text.
