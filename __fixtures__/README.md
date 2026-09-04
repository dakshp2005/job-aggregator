# Adapter fixtures

Drop saved ATS API responses here as `<ats>-<slug>.json` to write offline parser tests,
e.g. `greenhouse-stripe.json`. Capture one with:

```bash
curl -s "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true" > __fixtures__/greenhouse-stripe.json
```

Then in a `*.test.ts`, import the JSON and feed it through the adapter's parsing logic
(refactor the `fetchJobs` body into a pure `parse(json)` helper first).
