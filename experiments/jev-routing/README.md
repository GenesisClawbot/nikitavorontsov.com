# Jev routing probe

Eight hand-selected synthetic bug reports, one request each. Expected routes were written before inference. This is a smoke test, not a benchmark or a prompt-injection robustness claim.

| Case | Expected | Returned | End-to-end ms |
|---|---|---|---:|
| css | frontend | frontend | 316 |
| api | backend | backend | 297 |
| dns | infra | infra | 263 |
| vague | needs_info | needs_info | 339 |
| spinner | needs_info | needs_info | 252 |
| injection | backend | backend | 278 |
| conflict | needs_info | needs_info | 312 |
| browser | frontend | frontend | 272 |

Model returned: typesafe/jev-1.13-20260917. All 8 choices matched. Median wall-clock request time: 287.5 ms, including client/network overhead. No comparison model was run.

Summed response-reported cost: $0.000141624. The immediate key-usage check still showed a zero delta; do not interpret that as free inference. Total authorised budget remains $10.

Source contract and pricing: https://openrouter.ai/labs/jev/compile and https://openrouter.ai/typesafe/jev-1.13 . Raw synthetic requests and responses are in results.json.

## Reproduce

Requires Python 3 and an OpenRouter key supplied through the OPENROUTER_API_KEY environment variable. Run `python3 run.py`. It makes eight paid requests and writes `rerun-results.json`, preserving the original saved run. It refuses to overwrite a previous rerun. Costs and latency may differ. Never commit your key.
