import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  VulnerabilityScanner,
  getDB,
  disconnectDB,
} from "@vuln-shield/core";

// Load env from project root
dotenv.config({ path: "../../.env" });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Health Check ───────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "vuln-shield-api", timestamp: new Date().toISOString() });
});

// ─── Start a New Scan ───────────────────────────────────────────────────────

app.post("/api/scan", async (req, res) => {
  const { repoUrl, useNVD, skipDev } = req.body;

  if (!repoUrl || typeof repoUrl !== "string") {
    res.status(400).json({ error: "repoUrl is required" });
    return;
  }

  try {
    const scanner = new VulnerabilityScanner();
    const report = await scanner.scan(repoUrl, {
      useNVD: useNVD || false,
      skipDev: skipDev || false,
      persist: true,
    });

    res.json({
      scanId: report.scanId,
      repoUrl: report.repoUrl,
      totalDependencies: report.totalDependencies,
      totalVulnerabilities: report.totalVulnerabilities,
      severityCounts: report.severityCounts,
      results: report.results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    res.status(500).json({ error: message });
  }
});

// ─── Get Scan by ID ─────────────────────────────────────────────────────────

app.get("/api/scan/:id", async (req, res) => {
  try {
    const db = getDB();
    const scan = await db.scan.findUnique({
      where: { id: req.params.id },
      include: {
        dependencies: {
          include: {
            vulnerabilities: true,
          },
        },
      },
    });

    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    res.json(scan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch scan";
    res.status(500).json({ error: message });
  }
});

// ─── List All Scans ─────────────────────────────────────────────────────────

app.get("/api/scans", async (_req, res) => {
  try {
    const db = getDB();
    const scans = await db.scan.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(scans);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch scans";
    res.status(500).json({ error: message });
  }
});

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  🛡️  VulnShield API running on http://localhost:${PORT}`);
  console.log(`  📚  Endpoints:`);
  console.log(`     GET  /api/health`);
  console.log(`     POST /api/scan        { repoUrl: "owner/repo" }`);
  console.log(`     GET  /api/scan/:id`);
  console.log(`     GET  /api/scans\n`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});
