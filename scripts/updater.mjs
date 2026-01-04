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

  const latestRelease = releases.find(
    (r) => !r.prerelease && r.tag_name.startsWith("v"),
  );

  if (!latestRelease) {
    return;
  }

  // Fetch the annotated tag message directly, as Release.body may be empty
  // during the initial GitHub Actions run (tag message syncs to Release async)
  let notes = latestRelease.body;
  if (!notes) {
    try {
      const tagRef = await github.rest.git.getRef({
        ...options,
        ref: `tags/${latestRelease.tag_name}`,
      });
      // Only fetch tag object if it's an annotated tag (object type is tag)
      if (tagRef.data.object.type === "tag") {
        const tagObject = await github.rest.git.getTag({
          ...options,
          tag_sha: tagRef.data.object.sha,
        });
        notes = tagObject.data.message;
      }
    } catch (e) {
      console.warn(`Failed to fetch tag annotation for ${latestRelease.tag_name}:`, e.message);
    }
  }
  // Fallback to tag name if no notes available
  const finalNotes = notes || `Release ${latestRelease.tag_name}`;

  const updateData = {
    version: latestRelease.tag_name.replace(/^v/, ""),
    notes: finalNotes,
    pub_date: latestRelease.published_at,
    platforms: {
      "darwin-aarch64": { signature: "", url: "" },
      "windows-x86_64": { signature: "", url: "" },
    },
  };

  // Process assets
  for (const asset of latestRelease.assets) {
    const { name, browser_download_url } = asset;

    // macOS aarch64 - .aarch64.dmg or .aarch64.app.tar.gz (exclude .sig files)
    if (
      (name.endsWith("aarch64.dmg") || name.endsWith("aarch64.app.tar.gz")) &&
      !name.endsWith(".sig")
    ) {
      updateData.platforms["darwin-aarch64"].url = browser_download_url;
    }

    // macOS aarch64 signature
    if (
      name.includes("aarch64.dmg.sig") ||
      name.includes("aarch64.app.tar.gz.sig")
    ) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["darwin-aarch64"].signature = sig;
    }

    // Windows x86_64 - *_x64-setup.exe (exclude .sig files)
    if (name.endsWith("x64-setup.exe") && !name.endsWith(".sig")) {
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
      delete updateData.platforms[key];
    }
  });

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
}

async function getSignature(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/octet-stream" },
  });
  return response.text();
}

void resolveUpdater();
