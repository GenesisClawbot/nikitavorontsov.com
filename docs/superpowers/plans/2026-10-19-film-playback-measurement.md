# Film playback measurement

Local candidate, 19 October 2026. Owner is the root social-work session.

The existing site-wide tracker records page views, but the four public full films
do not send playback events. A controlled check of the current player reached
`ended = true` after only 3.715805 seconds had played. Reaching the end is therefore
not a useful measure of how much played.

## Definition

Keep one shared configuration in `/analytics.js`. The four full films opt in with
static `data-analytics-film` labels. Emit `Film started - <film>` once any positive amount
has played and `Film 90 percent played - <film>` once the union of played timeline ranges
reaches 90% of the duration. Each event is attempted once per film element per
page load. Pause, resume and replay do not add duplicate events. Reloading the
page starts a new measurement.

This is timeline coverage, not a count of attentive viewers, real-time listening,
or a literal full-film completion. Background or fast playback still counts.
Direct MP4 downloads, native social players, blocked scripts and offline views
are outside this measurement. No viewer identifiers or film URLs are added to
event properties. The existing book callback URL exclusion stays in place.

No player behaviour, visible layout, film bytes, captions or dependencies change.
Register the eight matching event goals on the existing account. The pending
follow-link design is separate.

## Account preflight correction, 20 October 2026

The approved GPT-6 Astra review passed the original seven-file candidate. After
the user signed in, the account showed Growth, which supports custom event goals
but not custom properties. The only runtime correction puts each static film
label into its event name instead of a `film` property. This preserves a maximum
of two events per film per page load and permits comparison without a Business
upgrade. The four identifiers are `meaning-of-life-sol`,
`meaning-of-life-astra`, `meaning-of-life-opus`, and `ai-purpose-opus`.
This correction needs scoped re-review before push.

The account displayed 137,735 billable pageviews against a 100,000 monthly tier
for 28 September–27 October, following two over-limit cycles. Its dashboard and
goal settings remained accessible, with an upgrade warning. Plausible documents
no automatic overage charge, but may lock dashboards after sustained excess
usage. No plan change or purchase is authorised or made here. These new events
add to billable usage; the pre-existing account warning is reported separately.

## Validation on the local candidate

- 24 focused tests passed, including the captured skip case, exact threshold,
  repeat playback, separate films, queued events and book privacy checks.
- The complete existing test command passed 265 tests. The site build passed.
- The build moved the shared tracker tag in four unrelated book pages. Those
  generated placement changes were removed; the privacy tests passed again.
- Inline diff review found no additional code issue. This does not replace the
  prescribed review by Opus 5.5, which is unavailable in this session.
- A browser verification script exists in the social workspace. It fulfils all
  site requests from the local checkout and substitutes an in-memory Plausible
  receiver. That separate-browser flow did not run successfully. The bundled test browser is missing;
  the installed Chrome then exited during sandboxed launch. The flow was stopped
  after those two failures. No test event was sent to Plausible.
- On 19 October at 21:25 UTC, the existing in-app browser passed a local check
  on the real film page and accepted Opus media. The exact candidate analytics
  source ran inside a test-only host/document wrapper with an in-memory receiver.
  Its external loader was captured rather than inserted, and the local server's
  CSP restricted resources to the local origin. Full playback covered 60 seconds
  and emitted the two expected events. Seeking to the end covered 3.060111 seconds
  and emitted only the start. Three plays of the opening covered 3.060292 seconds;
  replay after full playback did not duplicate either event. No media or console
  errors were observed. This checks native media ranges and the candidate callback,
  not production hostname gating, provider ingestion, attentive viewing or audio
  quality. The existing unit tests cover hostname and book callback exclusions.

Evidence is in `outputs/social-session-2026-10-19-2058/` of the social workspace.
The native-browser results and isolated local server are in
`outputs/social-session-2026-10-19-2129/`. The allowance preflight in
`outputs/social-session-2026-10-19-2118/` reached Plausible sign-in, so the current
account allowance and goals remain unknown. No account setting was changed.

## Release checklist, 19 October 2026

1. Root must obtain the required Opus review, or an explicit change to the review
   rule. Do not label the inline review as an independent review or push before
   the required review passes.
2. The isolated native-browser check is complete for analytics source SHA-256
   `25ff2193d3ef1a61c088d61f4e45b5f3ed846f38f4832b6393ad51fea3ace0c8`.
   Repeat only if the source or relevant player behaviour changes. Do not retry
   the failed separate browser launch. Remote deployment still needs its own check.
3. The 20 October account check above confirms allowance and standard event-goal
   support. These events count towards billable usage, with at most two per
   film per page load. Do not buy or upgrade a plan. Add the eight exactly named
   goals within the existing authorised account only when release is selected.
4. After review and release, verify the deployed script and four labels, then
   separately verify event receipt in Plausible. Mark any deliberate test views
   in the measurement log. A queued event or successful page load is not proof
   of provider ingestion. Do not claim historical film completion figures.

## Sources

- [Plausible custom events](https://plausible.io/docs/custom-event-goals)
- [Plausible custom event properties](https://plausible.io/docs/custom-props/for-custom-events)
- [HTMLMediaElement played ranges](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/played)
