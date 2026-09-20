# Date-only values across time zones

This zero-dependency Node.js experiment compares three ways to handle a calendar date that has no time or timezone:

1. `new Date(year, month - 1, day).toISOString().slice(0, 10)`
2. `new Date('YYYY-MM-DD')`, followed by local date getters
3. Keeping the validated `YYYY-MM-DD` string as a date-only value

It uses a small, explicitly chosen set of edge cases: winter (`2024-01-15`), summer (`2024-07-15`), and leap day (`2024-02-29`), each in UTC, Europe/London, America/Los_Angeles, Asia/Kolkata, and Pacific/Kiritimati. This is an illustrative fixture set, not a statistical sample and not a population error rate.

## Run

From this directory, run:

```sh
node run.mjs
```

The script uses only Node.js built-ins. It launches a separate Node process for each timezone with that process's `TZ` environment variable set, asserts selected known outcomes, rejects malformed and impossible calendar dates, and rewrites [`raw-rows.json`](raw-rows.json) with the exact result rows plus runtime provenance. No packages or network access are needed.

## Reading the result

The first two methods interpret the value as an instant or construct a local midnight, so converting or reading it in another timezone can move the calendar day. For example, the Los Angeles local getters for `2024-01-15` after parsing the date-only string show `2024-01-14`; in Kolkata, converting local midnight to ISO produces `2024-01-14`. London also shows the seasonal offset: local midnight in summer converts to the previous UTC date, while winter midnight does not.

The third method validates the exact `YYYY-MM-DD` shape and round-trips its numeric components through UTC calendar construction, then preserves the original string. Each output row carries all three results. The JSON records Node, V8, ICU, the requested `TZ`, and the runtime's resolved timezone. Timezone databases can change; the assertions cover only these named dates and environments.
