#!/usr/bin/env node

import chalk from "chalk";
import ora from "ora";
import dotenv from "dotenv";
import { VulnerabilityScanner } from "./scanner.js";
import { disconnectDB } from "./db.js";
import type { ScanReport, Severity } from "./types.js";

// Load env from project root
dotenv.config({ path: "../../.env" });
dotenv.config({ path: ".env" });

// ─── Severity Colors ────────────────────────────────────────────────────────

const severityColors: Record<Severity, (text: string) => string> = {
  CRITICAL: chalk.bgRed.white.bold,
  HIGH: chalk.red.bold,
  MEDIUM: chalk.yellow.bold,
  LOW: chalk.blue,
  UNKNOWN: chalk.gray,
};

const severityIcons: Record<Severity, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🔵",
  UNKNOWN: "⚪",
};

// ─── Report Printer ─────────────────────────────────────────────────────────

function printReport(report: ScanReport): void {
  console.log("\n");
  console.log(chalk.bold.cyan("═══════════════════════════════════════════════"));
  console.log(chalk.bold.cyan("  🛡️  VulnShield — Scan Report"));
  console.log(chalk.bold.cyan("═══════════════════════════════════════════════"));
  console.log();

  console.log(
    chalk.gray("Repository:  ") +
      chalk.white.bold(`${report.repoOwner}/${report.repoName}`)
  );
  console.log(chalk.gray("Scanned at:  ") + chalk.white(report.scannedAt));
  console.log(
    chalk.gray("Total deps:  ") +
      chalk.white.bold(String(report.totalDependencies))
  );
  console.log(
    chalk.gray("Total vulns: ") +
      chalk.white.bold(String(report.totalVulnerabilities))
  );
  console.log();

  // ── Severity Summary ────────────────────────────────────────────────
  console.log(chalk.bold("Severity Breakdown:"));
  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as Severity[]) {
    const count = report.severityCounts[sev];
    if (count > 0) {
      console.log(
        `  ${severityIcons[sev]} ${severityColors[sev](sev.padEnd(10))} ${count}`
      );
    }
  }

  console.log();

  // ── Vulnerable Dependencies ─────────────────────────────────────────
  const vulnerable = report.results.filter(
    (r) => r.vulnerabilities.length > 0
  );

  if (vulnerable.length === 0) {
    console.log(chalk.green.bold("  ✅ No vulnerabilities found! 🎉"));
    return;
  }

  console.log(
    chalk.bold(
      `Vulnerable Dependencies (${vulnerable.length}/${report.totalDependencies}):`
    )
  );
  console.log();

  for (const result of vulnerable) {
    const { dependency: dep, vulnerabilities: vulns } = result;

    // Sort vulnerabilities by severity
    vulns.sort(
      (a, b) =>
        severityOrder(a.severity) - severityOrder(b.severity)
    );

    console.log(
      chalk.white.bold(`  📦 ${dep.name}`) +
        chalk.gray(`@${dep.version}`) +
        chalk.dim(` (${dep.ecosystem}, ${dep.manifestPath})`)
    );

    for (const vuln of vulns) {
      const id = vuln.cveId || vuln.osvId || "N/A";
      const score = vuln.cvssScore !== null ? ` (${vuln.cvssScore})` : "";
      console.log(
        `     ${severityIcons[vuln.severity]} ${severityColors[vuln.severity](
          vuln.severity.padEnd(10)
        )} ${chalk.cyan(id)}${chalk.gray(score)}`
      );
      console.log(chalk.gray(`       ${truncate(vuln.summary, 80)}`));

      if (vuln.fixedVersions.length > 0) {
        console.log(
          chalk.green(`       Fix: upgrade to ${vuln.fixedVersions.join(" or ")}`)
        );
      }
    }

    console.log();
  }

  console.log(chalk.bold.cyan("═══════════════════════════════════════════════"));
}

function severityOrder(s: Severity): number {
  const order: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    UNKNOWN: 4,
  };
  return order[s];
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(chalk.bold.cyan("\n  🛡️  VulnShield — AI-Powered Vulnerability Scanner\n"));
    console.log("  Usage:");
    console.log(
      chalk.white("    npx tsx src/cli.ts scan <github-repo-url> [options]")
    );
    console.log();
    console.log("  Examples:");
    console.log(
      chalk.gray(
        "    npx tsx src/cli.ts scan https://github.com/juice-shop/juice-shop"
      )
    );
    console.log(
      chalk.gray(
        "    npx tsx src/cli.ts scan snyk-labs/nodejs-goof --use-nvd"
      )
    );
    console.log();
    console.log("  Options:");
    console.log(chalk.gray("    --use-nvd      Also query NVD (slower, needs API key)"));
    console.log(chalk.gray("    --skip-dev     Skip dev dependencies"));
    console.log(chalk.gray("    --no-persist   Don't save to database"));
    console.log();
    process.exit(0);
  }

  const command = args[0];

  if (command !== "scan") {
    console.error(chalk.red(`Unknown command: ${command}. Use 'scan'.`));
    process.exit(1);
  }

  const repoUrl = args[1];
  if (!repoUrl) {
    console.error(chalk.red("Please provide a GitHub repository URL."));
    process.exit(1);
  }

  const useNVD = args.includes("--use-nvd");
  const skipDev = args.includes("--skip-dev");
  const noPersist = args.includes("--no-persist");

  // Check for GitHub token
  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      chalk.yellow(
        "⚠ GITHUB_TOKEN not set. API rate limits will be very restrictive.\n" +
          "  Set it in .env or export GITHUB_TOKEN=ghp_..."
      )
    );
  }

  const scanner = new VulnerabilityScanner();
  const spinner = ora();

  try {
    spinner.start(chalk.cyan(`Scanning ${repoUrl}...`));

    spinner.text = chalk.cyan("Fetching manifest files from GitHub...");
    const report = await scanner.scan(repoUrl, {
      useNVD,
      skipDev,
      persist: !noPersist,
    });

    spinner.succeed(chalk.green("Scan complete!"));
    printReport(report);
  } catch (error) {
    spinner.fail(chalk.red("Scan failed!"));
    if (error instanceof Error) {
      console.error(chalk.red(`\n  Error: ${error.message}`));
    }
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

main();
