import { Octokit } from "octokit";
import { MANIFEST_FILENAMES } from "../parsers/index.js";
import type { ManifestFile, Ecosystem } from "../types.js";

/**
 * GitHub API client for fetching repository contents and manifest files.
 */
export class GitHubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Parse a GitHub URL into owner and repo name.
   * Supports: https://github.com/owner/repo, github.com/owner/repo, owner/repo
   */
  parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    // Remove trailing slashes and .git suffix
    const cleaned = repoUrl.replace(/\/+$/, "").replace(/\.git$/, "");

    // Try to extract owner/repo from URL
    const urlMatch = cleaned.match(
      /(?:github\.com\/|^)([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/
    );

    if (!urlMatch) {
      throw new Error(
        `Invalid GitHub URL: ${repoUrl}. Expected format: https://github.com/owner/repo`
      );
    }

    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  /**
   * Search the repository root and common subdirectories for manifest files.
   * Returns a list of paths that match known manifest filenames.
   */
  async detectManifests(owner: string, repo: string): Promise<string[]> {
    const foundPaths: string[] = [];

    // Check root directory
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });

      if (Array.isArray(data)) {
        for (const item of data) {
          if (
            item.type === "file" &&
            MANIFEST_FILENAMES.includes(item.name)
          ) {
            foundPaths.push(item.path);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list root directory for ${owner}/${repo}`);
    }

    // Also check common subdirectory patterns for monorepos
    const commonPaths = ["backend", "frontend", "server", "client", "app", "api"];
    for (const subDir of commonPaths) {
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: subDir,
        });

        if (Array.isArray(data)) {
          for (const item of data) {
            if (
              item.type === "file" &&
              MANIFEST_FILENAMES.includes(item.name)
            ) {
              foundPaths.push(item.path);
            }
          }
        }
      } catch {
        // Subdirectory doesn't exist — that's fine, skip it
      }
    }

    return foundPaths;
  }

  /**
   * Fetch the raw content of a file from the repository.
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string
  ): Promise<string> {
    const { data } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      mediaType: { format: "raw" },
    });

    // When requesting raw format, data is the file content as a string
    return data as unknown as string;
  }

  /**
   * Detect the ecosystem for a given manifest filename.
   */
  private detectEcosystem(filename: string): Ecosystem {
    const basename = filename.split("/").pop() || filename;

    if (basename === "package.json") return "npm";
    if (basename === "pom.xml") return "maven";
    if (
      basename.startsWith("requirements") ||
      basename === "Pipfile"
    ) {
      return "pypi";
    }

    throw new Error(`Unknown manifest type: ${filename}`);
  }

  /**
   * Fetch all manifest files from a repository.
   * Main entry point — detects manifests, downloads them, returns structured data.
   */
  async fetchManifests(repoUrl: string): Promise<ManifestFile[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const manifestPaths = await this.detectManifests(owner, repo);

    const manifests: ManifestFile[] = [];

    for (const path of manifestPaths) {
      try {
        const content = await this.getFileContent(owner, repo, path);
        manifests.push({
          path,
          content,
          ecosystem: this.detectEcosystem(path),
        });
      } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
      }
    }

    return manifests;
  }
}
