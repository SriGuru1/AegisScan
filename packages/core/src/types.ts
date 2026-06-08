// ─── Shared Types ───────────────────────────────────────────────────────────

/** Supported package ecosystems */
export type Ecosystem = "npm" | "maven" | "pypi";

/** A single parsed dependency from a manifest file */
export interface ParsedDependency {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  isDev: boolean;
  manifestPath: string;
}

/** A manifest file fetched from a repository */
export interface ManifestFile {
  path: string;
  content: string;
  ecosystem: Ecosystem;
}

/** Severity level for vulnerabilities */
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

/** Unified vulnerability record from any source */
export interface UnifiedVulnerability {
  cveId: string | null;
  osvId?: string;
  severity: Severity;
  cvssScore: number | null;
  cvssVector: string | null;
  summary: string;
  details: string | null;
  publishedDate: string | null;
  modifiedDate: string | null;
  fixedVersions: string[];
  references: string[];
  source: "OSV" | "NVD";
  affectedRange: string | null;
}

/** Result of scanning a single dependency */
export interface DependencyScanResult {
  dependency: ParsedDependency;
  vulnerabilities: UnifiedVulnerability[];
}

/** Complete scan report */
export interface ScanReport {
  scanId: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  scannedAt: string;
  totalDependencies: number;
  totalVulnerabilities: number;
  severityCounts: Record<Severity, number>;
  results: DependencyScanResult[];
}

// ─── Parser Interface ───────────────────────────────────────────────────────

/** Interface that all manifest parsers must implement */
export interface ManifestParser {
  /** The ecosystem this parser handles */
  ecosystem: Ecosystem;

  /** Filenames this parser can handle */
  supportedFiles: string[];

  /** Check if this parser can handle a given filename */
  canParse(filename: string): boolean;

  /** Parse file content and return list of dependencies */
  parse(content: string, filepath: string): ParsedDependency[];
}

// ─── Vulnerability DB Client Interface ──────────────────────────────────────

/** Interface for vulnerability database clients */
export interface VulnDBClient {
  /** Name of the data source */
  source: "OSV" | "NVD";

  /** Query vulnerabilities for a specific package */
  query(
    ecosystem: Ecosystem,
    packageName: string,
    version: string
  ): Promise<UnifiedVulnerability[]>;
}
