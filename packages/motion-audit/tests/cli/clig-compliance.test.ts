import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const BIN_PATH = path.resolve(import.meta.dir, "../../bin/motion-audit.js");
const RUNTIME_BIN = process.platform === "win32" ? process.execPath : "node";

describe("clig.dev Standards Compliance Verification", () => {
  it("exits with code 2 and prints usage when no URL is provided", () => {
    const res = spawnSync(RUNTIME_BIN, [BIN_PATH], { encoding: "utf-8" });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("Target URL is required");
    expect(res.stdout).toContain("Usage:");
  });

  it("exits with code 2 when an invalid URL is provided", () => {
    const res = spawnSync(RUNTIME_BIN, [BIN_PATH, "invalid:::url"], {
      encoding: "utf-8",
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("not a valid URL");
  });

  it("exits with code 0 on -h and --help", () => {
    const resH = spawnSync(RUNTIME_BIN, [BIN_PATH, "-h"], {
      encoding: "utf-8",
    });
    expect(resH.status).toBe(0);
    expect(resH.stdout).toContain(
      "Independent Web Animation & Motion Performance Auditor"
    );

    const resHelp = spawnSync(RUNTIME_BIN, [BIN_PATH, "--help"], {
      encoding: "utf-8",
    });
    expect(resHelp.status).toBe(0);
    expect(resHelp.stdout).toContain("Usage:");
  });

  it("exits with code 0 on -v and --version", () => {
    const resV = spawnSync(RUNTIME_BIN, [BIN_PATH, "-v"], {
      encoding: "utf-8",
    });
    expect(resV.status).toBe(0);
    expect(resV.stdout.trim()).toBe("0.1.0");

    const resVer = spawnSync(RUNTIME_BIN, [BIN_PATH, "--version"], {
      encoding: "utf-8",
    });
    expect(resVer.status).toBe(0);
    expect(resVer.stdout.trim()).toBe("0.1.0");
  });

  it("maintains strict stream isolation with --json (stdout is 100% valid JSON, stderr has 0 bytes)", () => {
    const res = spawnSync(
      RUNTIME_BIN,
      [BIN_PATH, "https://motion.soralabs.studio/", "--desktop-only", "--json"],
      {
        encoding: "utf-8",
      }
    );
    expect(res.status).toBe(0);
    expect(res.stderr.length).toBe(0);

    const parsed = JSON.parse(res.stdout);
    expect(parsed).toHaveProperty("url");
    expect(parsed).toHaveProperty("overallScore");
    expect(parsed).toHaveProperty("overallTier");
    expect(Number.isFinite(parsed.overallScore)).toBe(true);
  }, 35_000);

  it("maintains clean stdout in --ai mode and routes progress messages strictly to stderr", () => {
    const res = spawnSync(
      RUNTIME_BIN,
      [BIN_PATH, "https://motion.soralabs.studio/", "--desktop-only", "--ai"],
      {
        encoding: "utf-8",
      }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      "# SoraLabs Motion Audit AI Refactoring Report"
    );
    expect(res.stdout).toContain("**Overall Grade:**");
    // No cursor escape sequence in stdout
    expect(res.stdout).not.toContain("\u001B[?25l");
  }, 35_000);

  it("emits clean non-TTY progress lines to stderr without ANSI cursor control sequences in non-TTY environments", () => {
    const res = spawnSync(
      RUNTIME_BIN,
      [BIN_PATH, "https://motion.soralabs.studio/", "--desktop-only"],
      {
        encoding: "utf-8",
      }
    );
    expect(res.status).toBe(0);
    // Non-TTY stderr should not have \u001b[?25l (hide cursor) or \u001b[1G\u001b[J (spinner redraws)
    expect(res.stderr).not.toContain("\u001B[?25l");
    expect(res.stderr).not.toContain("\u001B[1G");
    expect(res.stderr).toContain("[motion-audit]");
  }, 35_000);

  it("enforces exit code 2 on connection failure", () => {
    const res = spawnSync(
      RUNTIME_BIN,
      [BIN_PATH, "http://127.0.0.1:59999", "--threshold", "S"],
      {
        encoding: "utf-8",
      }
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("Audit Error:");
  }, 35_000);
});
