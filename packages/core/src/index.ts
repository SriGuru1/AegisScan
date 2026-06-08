// ─── VulnShield Core ────────────────────────────────────────────────────────
// AI-Powered Vulnerability Detection and Mitigation System
// ─────────────────────────────────────────────────────────────────────────────

export { VulnerabilityScanner } from "./scanner.js";
export type { ScanOptions } from "./scanner.js";

export { GitHubClient } from "./github/index.js";

export { NpmParser, MavenParser, PythonParser } from "./parsers/index.js";
export { parseManifest, getParserForFile, MANIFEST_FILENAMES } from "./parsers/index.js";

export { OSVClient } from "./vulndb/osv-client.js";
export { NVDClient } from "./vulndb/nvd-client.js";

export { getDB, disconnectDB } from "./db.js";

export type {
  Ecosystem,
  ParsedDependency,
  ManifestFile,
  Severity,
  UnifiedVulnerability,
  DependencyScanResult,
  ScanReport,
  ManifestParser,
  VulnDBClient,
} from "./types.js";
