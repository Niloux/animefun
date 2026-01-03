import { getOctokit, context } from "@actions/github";
import fetch from "node-fetch";

const UPDATE_JSON_FILE = "latest.json";

async function resolveUpdater() {
  if (process.env.GITHUB_TOKEN === undefined) {
    throw new Error("GITHUB_TOKEN is required");
  }

  const options = { owner: context.repo.owner, repo: context.repo.repo };
  const github = getOctokit(process.env.GITHUB_TOKEN);

  // Get the latest release tag (v*.*.* format)
  const { data: releases } = await github.rest.repos.listReleases({
    ...options,
    per_page: 10,
  });

  const latestRelease = releases.find((r) => !r.prerelease && r.tag_name.startsWith("v"));

  if (!latestRelease) {
    console.log("No stable release found");
    return;
  }

  console.log(`Processing release: ${latestRelease.tag_name}`);

  const updateData = {
    version: latestRelease.tag_name.replace(/^v/, ""),
    notes: latestRelease.body || `Release ${latestRelease.tag_name}`,
    pub_date: latestRelease.published_at,
    platforms: {
      "darwin-x86_64": { signature: "", url: "" },
      "darwin-aarch64": { signature: "", url: "" },
      "windows-x86_64": { signature: "", url: "" },
    },
  };

  // Process assets
  for (const asset of latestRelease.assets) {
    const { name, browser_download_url } = asset;

    // macOS x86_64 (intel) - .app.tar.gz
    if (name.endsWith(".app.tar.gz") && !name.includes("aarch64")) {
      updateData.platforms["darwin-x86_64"].url = browser_download_url;
    }

    // macOS x86_64 signature
    if (name.endsWith(".app.tar.gz.sig") && !name.includes("aarch64")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["darwin-x86_64"].signature = sig;
    }

    // macOS aarch64 - .aarch64.dmg or .aarch64.app.tar.gz
    if (name.includes("aarch64.dmg") || name.includes("aarch64.app.tar.gz")) {
      updateData.platforms["darwin-aarch64"].url = browser_download_url;
    }

    // macOS aarch64 signature
    if (name.includes("aarch64.dmg.sig") || name.includes("aarch64.app.tar.gz.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["darwin-aarch64"].signature = sig;
    }

    // Windows x86_64 - *_x64-setup.exe
    if (name.includes("x64-setup.exe")) {
      updateData.platforms["windows-x86_64"].url = browser_download_url;
    }

    // Windows x86_64 signature
    if (name.includes("x64-setup.exe.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["windows-x86_64"].signature = sig;
    }
  }

  // Remove platforms without URL
  Object.entries(updateData.platforms).forEach(([key, value]) => {
    if (!value.url) {
      console.log(`[Warning] No asset found for: ${key}`);
      delete updateData.platforms[key];
    }
  });

  console.log("Generated update data:", JSON.stringify(updateData, null, 2));

  // Use the latest release (already fetched above)
  const updateRelease = latestRelease;

  // Delete existing latest.json asset
  for (const asset of updateRelease.assets) {
    if (asset.name === UPDATE_JSON_FILE) {
      await github.rest.repos.deleteReleaseAsset({
        ...options,
        asset_id: asset.id,
      });
    }
  }

  // Upload new latest.json
  await github.rest.repos.uploadReleaseAsset({
    ...options,
    release_id: updateRelease.id,
    name: UPDATE_JSON_FILE,
    data: JSON.stringify(updateData, null, 2),
  });

  console.log(`Successfully uploaded ${UPDATE_JSON_FILE} to ${latestRelease.tag_name} release`);
}

async function getSignature(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/octet-stream" },
  });
  return response.text();
}

resolveUpdater().catch((error) => {
  console.error("Updater failed:", error.message);
  process.exit(1);
});
