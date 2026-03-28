const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RUN_TIMEOUT_MS = 3000;
const COMPILE_TIMEOUT_MS = 5000;
const MAX_BUFFER = 1024 * 1024;

function normalizeOutput(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function execSyncCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    timeout: options.timeout ?? RUN_TIMEOUT_MS,
    cwd: options.cwd,
    input: options.input ?? "",
    maxBuffer: MAX_BUFFER,
  });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      return { ok: false, stdout: result.stdout || "", stderr: "Execution timed out" };
    }
    return { ok: false, stdout: result.stdout || "", stderr: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      stdout: result.stdout || "",
      stderr: result.stderr || `Exited with code ${result.status}`,
    };
  }

  return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function runCode(language, code, input = "") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exam-code-"));
  try {
    if (language === "javascript") {
      const file = path.join(tempDir, "main.js");
      fs.writeFileSync(file, String(code || ""), "utf-8");
      return execSyncCommand("node", [file], { cwd: tempDir, input });
    }

    if (language === "python") {
      const file = path.join(tempDir, "main.py");
      fs.writeFileSync(file, String(code || ""), "utf-8");
      return execSyncCommand("python3", [file], { cwd: tempDir, input });
    }

    if (language === "c") {
      const source = path.join(tempDir, "main.c");
      const output = path.join(tempDir, "main.out");
      fs.writeFileSync(source, String(code || ""), "utf-8");

      const compile = execSyncCommand("gcc", [source, "-O2", "-std=c11", "-o", output], {
        cwd: tempDir,
        timeout: COMPILE_TIMEOUT_MS,
      });
      if (!compile.ok) return { ok: false, stdout: compile.stdout, stderr: compile.stderr };
      return execSyncCommand(output, [], { cwd: tempDir, input });
    }

    if (language === "cpp") {
      const source = path.join(tempDir, "main.cpp");
      const output = path.join(tempDir, "main.out");
      fs.writeFileSync(source, String(code || ""), "utf-8");

      const compile = execSyncCommand("g++", [source, "-O2", "-std=c++17", "-o", output], {
        cwd: tempDir,
        timeout: COMPILE_TIMEOUT_MS,
      });
      if (!compile.ok) return { ok: false, stdout: compile.stdout, stderr: compile.stderr };
      return execSyncCommand(output, [], { cwd: tempDir, input });
    }

    return { ok: false, stdout: "", stderr: `Unsupported language: ${language}` };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function evaluateCodeAgainstTestCases(language, code, testCases = []) {
  const cases = Array.isArray(testCases) ? testCases : [];
  const results = [];
  let passedCount = 0;

  for (const testCase of cases) {
    const input = String(testCase?.input || "");
    const expectedOutput = String(testCase?.expectedOutput || "");
    const runResult = runCode(language, code, input);

    if (!runResult.ok) {
      results.push({
        passed: false,
        input,
        expectedOutput,
        actualOutput: normalizeOutput(runResult.stdout),
        error: runResult.stderr,
      });
      continue;
    }

    const actual = normalizeOutput(runResult.stdout);
    const expected = normalizeOutput(expectedOutput);
    const passed = actual === expected;
    if (passed) passedCount += 1;

    results.push({
      passed,
      input,
      expectedOutput,
      actualOutput: actual,
      error: "",
    });
  }

  return {
    passedCount,
    totalCount: results.length,
    allPassed: results.length > 0 && passedCount === results.length,
    results,
  };
}

module.exports = {
  runCode,
  evaluateCodeAgainstTestCases,
};
