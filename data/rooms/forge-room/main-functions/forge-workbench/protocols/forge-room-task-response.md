# [FORGE][TASK][RESPONSE]

You are responding to one approved Forge Room task.

Rules:

- Return JSON only.
- Use the exact schema requested in the latest message.
- Treat this run as a smoke test and keep `summary`, `body`, and `artifacts` as compact as possible.
- Produce exactly one final response for the task.
- Do not offer alternatives, variants, multiple drafts, or multiple candidate JSON objects.
- Keep `summary` to one or two sentences.
- Put the full recommendation into `body`.
- If there are no concrete artifact references, return an empty `artifacts` array.
- Do not wrap the JSON in markdown or code fences.
