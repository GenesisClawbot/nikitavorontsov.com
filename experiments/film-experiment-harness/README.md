# Film experiment harness

An OpenRouter model can work on a film over many turns. It writes or appends
source in a project folder, reads its work back, runs Blender after source
review, inspects rendered PNGs, and revises the source. Tool results and model
reasoning metadata stay in the conversation. The default leaves the provider's
per-response token setting alone. Use `--max-tokens` for an explicit per-turn
limit and `--turns` to limit the number of model requests. Model context windows
and provider limits still apply.

This is a local rebuild of the workflow used in October 2026. The old
`outputs/experiments/point-of-life-harness-2026-10-06` runner and its
`opus-ai-purpose-2026-10-11` derivative were identified in archived run records.
This project implements the reusable loop. It does not restore those projects'
original scenes, receipts, or specific media adapters for HyperFrames and
ElevenLabs. Blender scripts can produce stills or animations.

## How a run works

1. Initialise a run from a brief and choose an OpenRouter model. The harness sends
   the brief, conversation history, and available tools on each turn.
2. The model writes scene code in chunks. When it requests a render, the harness
   pauses and gives the operator the script path and a review digest.
3. Once approved, Blender runs locally. The model can inspect the PNG, revise its
   code, and request another render in the same conversation.
4. The model returns an artifact path with `finish`. The run folder holds the
   source, output, and checkpoint history for inspection.

The finished October films are available in the [Meaning of Life lab](https://nikitavorontsov.com/lab/meaning-of-life/)
and the [Paper-Knife lab](https://nikitavorontsov.com/lab/ai-purpose/).

## Run a new project

Requires Python 3.10+ and Blender. On macOS the standard Blender app location
is detected. Set `BLENDER_BIN` when Blender is elsewhere. Supply an existing
`OPENROUTER_API_KEY` in your environment. Use a model that supports tool calls
and image inputs, and choose a provider key with a suitable spend limit.
The live command makes billable model requests and sends the brief, tool
results, and selected PNG previews to OpenRouter.

```sh
python3 harness.py init runs/demo --brief examples/brief.md \
  --model YOUR_OPENROUTER_MODEL --turns 20
python3 harness.py run runs/demo
```

At `source_review`, inspect the pending script and project sources using
`python3 harness.py status runs/demo`. Resume with
`python3 harness.py run runs/demo --approve DIGEST`, using the reported digest
after reviewing the files. A change to the project invalidates that digest.
Python run through Blender has the operating-system permissions of the Blender
process. The harness restricts its file tools to the project, but Blender is
not an OS sandbox. Review generated code and dependencies before approval.

The project lives under `runs/demo/project`. Keep `state.json` and the
numbered request and response files private. A settled pause can be resumed
with the same conversation. If a process died during an in-flight operation,
inspect the retained records. The runner stops instead of automatically
resending an uncertain provider request or rerunning a tool.

`finished` means the model called `finish` with an existing nonempty file.
`model_finished` means it returned text without delivering an artifact.
Check the finished media before using or publishing it.

## Offline check

`python3 examples/smoke.py` uses a scripted provider and runs real Blender.
It exercises source writes, review and resume, image feedback, source revision,
a second render, and delivery without contacting OpenRouter.
