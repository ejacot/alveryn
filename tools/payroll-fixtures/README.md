# Synthetic payroll benchmark

This generator creates fictional payroll documents and exact ground truth. It never uses real
employee data. Generated files belong in a temporary directory and are intentionally not committed.

```bash
node tools/payroll-fixtures/generate.mjs /tmp/alveryn-payroll-fixtures 100
```

The default produces 1,600 images: 100 cases for Germany, Romania, the United Kingdom and France,
each as a clean page, rotated photo, dim/blurred photo and cropped fragment. `manifest.json` contains
the expected values for automated evaluation.

Run a bounded benchmark against a local or staging backend with a dedicated test account:

```bash
ALVERYN_BENCHMARK_TOKEN=... ALVERYN_BENCHMARK_LIMIT=20 \
  node tools/payroll-fixtures/benchmark.mjs /tmp/alveryn-payroll-fixtures
```

The command writes `benchmark-report.json` and fails when any tested document differs from its
ground truth. Never point this tool at a production account.

To exercise the backend's real vision-provider integration without an account or database, expose
the provider key only to the test process and run the opt-in synthetic benchmark:

```bash
GROQ_API_KEY=... ./mvnw -Dtest=PayrollVisionFixtureBenchmarkTest \
  -DpayrollVisionFixtureDir=/tmp/alveryn-payroll-fixtures test
```

The live benchmark sends only generated test documents to the configured provider. It is skipped
during the normal test suite and never sends a real payslip. On a provider's free tier, use
`-DpayrollVisionCountry=DE` (or `RO`, `GB`, `FR`) to run one country per rate-limit window.
