#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const fixtureDir = resolve(process.argv[2] ?? "/tmp/alveryn-payroll-fixtures");
const baseUrl = process.env.ALVERYN_BENCHMARK_URL ?? "http://localhost:10000";
const token = process.env.ALVERYN_BENCHMARK_TOKEN;
const limit = Number(process.env.ALVERYN_BENCHMARK_LIMIT ?? 20);
if (!token) throw new Error("Set ALVERYN_BENCHMARK_TOKEN to a test-account access token");
const manifest = JSON.parse(await readFile(join(fixtureDir, "manifest.json"), "utf8"));
const cases = manifest.fixtures.slice(0, limit);
const tolerances = { normalHours: 0.02, normalAmount: 0.02, extraHours: 0.02,
  extraAmount: 0.02, grossAmount: 0.02 };
const results = [];
for (const expected of cases) {
  const form = new FormData();
  const bytes = await readFile(join(fixtureDir, expected.file));
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), basename(expected.file));
  const response = await fetch(`${baseUrl}/api/data-imports/payroll-reconciliation?year=2026&month=${expected.month ?? 1}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form
  });
  const envelope = await response.json().catch(() => ({}));
  const actual = envelope.data ?? envelope;
  const fields = Object.fromEntries(Object.entries(tolerances).map(([field, tolerance]) => {
    const delta = actual[field] == null ? null : Math.abs(Number(actual[field]) - Number(expected[field]));
    return [field, { expected: expected[field], actual: actual[field] ?? null,
      pass: delta != null && delta <= tolerance, delta }];
  }));
  results.push({ id: expected.id, status: response.status, pass: response.ok
    && Object.values(fields).every(field => field.pass), fields });
  process.stdout.write(`${results.at(-1).pass ? "PASS" : "FAIL"} ${expected.id}\n`);
}
const passed = results.filter(result => result.pass).length;
const report = { generatedAt: new Date().toISOString(), baseUrl, total: results.length,
  passed, accuracy: results.length ? passed / results.length : 0, results };
await writeFile(join(fixtureDir, "benchmark-report.json"), JSON.stringify(report, null, 2));
process.stdout.write(`Exact-document accuracy: ${passed}/${results.length} (${(report.accuracy * 100).toFixed(1)}%)\n`);
process.exitCode = passed === results.length ? 0 : 1;
