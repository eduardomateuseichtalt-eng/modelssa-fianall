import fs from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve(process.cwd(), "modelos.fake");
const sourceFiles = (await fs.readdir(sourceDir))
  .filter((file) => file.toLowerCase().endsWith(".json"))
  .sort();

const profiles = [];
for (const file of sourceFiles) {
  const value = JSON.parse(await fs.readFile(path.join(sourceDir, file), "utf8"));
  if (Array.isArray(value)) profiles.push(...value);
}

const validImageUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) && /\.(?:jpe?g|png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
};

const firstPhotos = profiles
  .map((profile) => (Array.isArray(profile.photos) ? profile.photos[0] : ""))
  .filter(validImageUrl);
const allPhotos = profiles
  .flatMap((profile) => (Array.isArray(profile.photos) ? profile.photos : []))
  .filter(validImageUrl);
const uniqueFirstPhotos = [...new Set(firstPhotos)];
const uniqueAllPhotos = [...new Set(allPhotos)];

const checkUrl = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
      response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: controller.signal,
      });
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    return response.ok && contentType.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const broken = [];
let next = 0;
const worker = async () => {
  while (true) {
    const index = next++;
    if (index >= uniqueAllPhotos.length) return;
    const url = uniqueAllPhotos[index];
    if (!(await checkUrl(url))) broken.push(url);
  }
};

await Promise.all(Array.from({ length: 24 }, worker));
const brokenSet = new Set(broken);
const brokenFirstPhotos = uniqueFirstPhotos.filter((url) => brokenSet.has(url));
const profilesWithoutWorkingPhoto = profiles.filter((profile) =>
  !(Array.isArray(profile.photos) && profile.photos.some((url) => validImageUrl(url) && !brokenSet.has(url)))
);

console.log(JSON.stringify({
  sourceFiles,
  profiles: profiles.length,
  firstPhotos: firstPhotos.length,
  uniqueFirstPhotos: uniqueFirstPhotos.length,
  workingFirstPhotos: uniqueFirstPhotos.length - brokenFirstPhotos.length,
  brokenFirstPhotos: brokenFirstPhotos.length,
  allPhotos: allPhotos.length,
  uniqueAllPhotos: uniqueAllPhotos.length,
  workingAllPhotos: uniqueAllPhotos.length - broken.length,
  brokenAllPhotos: broken.length,
  profilesWithoutWorkingPhoto: profilesWithoutWorkingPhoto.length,
  brokenExamples: broken.slice(0, 20),
}, null, 2));
