# Runbook UI comparison — what was run

23 September 2026. Six coding agents each produced one completed build of the same small React app. [Open the interactive pages](./). An earlier MiMo request timed out before producing a usable implementation; its completed run was a fresh attempt. This is a visual and functional comparison of six particular outputs, not a model ranking.

## Brief

MiMo received:

> Make a clean dashboard for Runbook.
>
> It is a small app page for a team reviewing short software experiments, not a landing page. Look through the project and tests, choose your approach and any packages you think will help, then build the page. Run the UI tests and production build. Fix what you find and tell me when you are done, or what you could not complete.
>
> The data is synthetic. Do not edit the shared tests, fixtures, or harness configuration.

The other five received the same brief with this sentence added before the test/build instruction: “The base packages are installed from the shared lockfile; only install additional packages if you think they help.” MiMo started without installed dependencies and installed them itself; this is a real setup difference.

The shared system prompt was:

> You are an experienced product designer and React engineer. Use the brief and the files in the project as the source of truth. Make a considered interface that feels authored, specific to its content and easy to understand. Build a strong visual hierarchy with purposeful detail; keep the task clear and avoid generic template choices or decorative elements that do not help the user.
>
> Design guidance: aim for authored work, real content, and visual confidence without letting spectacle hide the task. For this utility dashboard, take the restrained, clear approach used by strong product tools. Use actual interface content to create interest. Do not force imagery, metaphors, or decoration where they do not help. Choose the layout, palette, type and component treatment yourself.
>
> Follow the output format requested in the current workflow stage. Do not add claims, remote assets or network requests.

The models could inspect the starter and shared tests, write files in their candidate `src/`, install approved npm packages, and run the tests/build in disposable containers. No equal token cap was imposed. The [shared tests](./source/shared-tests/App.test.jsx) and [individual source trees](./source/) are included here. Browser captures used Chromium at 1440×1000 and 390×844.

## Results

| Model | Shared UI checks | Production build | Elapsed | OpenRouter reported cost |
| --- | ---: | --- | ---: | ---: |
| MiMo V2.6 Pro | 5/5 | Passed | 17m 55s | $0.070065594 |
| DeepSeek V4.1 Flash | 5/5 | Passed | 8m 33s | $0.086431304 |
| Claude Opus 5.5 | 5/5 | Passed | 2m 52s | $0.757856000 |
| GPT-6 Sol | 5/5 | Passed | 2m 45s | $0.262981400 |
| GPT-6 Luna | 5/5 | Passed | 3m 04s | $0.015519070 |
| GPT-5.6 Luna | 4/5 | Passed | 1m 49s | $0.021980520 |

The sixth page's failed assertion asked for a named `region`; its implementation used a labelled `<aside>` (a complementary landmark). This is a mismatch with the fixture, not by itself proof of an accessibility defect. The automated accessibility check also disabled its colour-contrast rule. The browser captures showed that each page rendered without errors or horizontal overflow at both sizes, but those captures only opened the default state. The shared UI tests exercised selected controls; hands-on review is still useful.

Completed agent runs cost $1.214833888 in response-reported charges. An earlier one-shot baseline and incomplete retry bring the conservatively accounted experiment total to $1.523752957. Prices and elapsed times are observations from these runs, not promises for later ones.
