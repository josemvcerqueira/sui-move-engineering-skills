import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_CLI_VERSION = "1.5.23";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
}

function collectSkillFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    if (entry === ".git" || entry === "node_modules") continue;

    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectSkillFiles(path));
    } else if (entry === "SKILL.md") {
      files.push(path);
    }
  }

  return files;
}

function collectMarkdownFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    if (entry === ".git" || entry === "node_modules") continue;

    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectMarkdownFiles(path));
    } else if (entry.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}

const headingAnchorCache = new Map();
function markdownHeadingAnchors(markdownFile) {
  if (headingAnchorCache.has(markdownFile)) {
    return headingAnchorCache.get(markdownFile);
  }

  const anchors = new Set();
  const counts = new Map();
  const lines = readFileSync(markdownFile, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)?.[1];
    if (!heading) continue;

    const base = heading
      .replace(/<[^>]*>/g, "")
      .replace(/[`*_~]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = counts.get(base) ?? 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    counts.set(base, count + 1);
  }

  headingAnchorCache.set(markdownFile, anchors);
  return anchors;
}

const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(packageJson.version)) {
  fail(`package.json version is not semantic: ${packageJson.version}`);
}

const changelog = readFileSync(join(repositoryRoot, "CHANGELOG.md"), "utf8");
const currentChangelogVersion = changelog.match(/^## \[([^\]]+)\]/m)?.[1];
if (currentChangelogVersion !== packageJson.version) {
  fail(
    `CHANGELOG.md starts at ${currentChangelogVersion ?? "no version"}, expected ${packageJson.version}`,
  );
}

const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");
if (!readme.includes(`Current release: \`v${packageJson.version}\`.`)) {
  fail(`README.md does not declare current release v${packageJson.version}`);
}

const markdownFiles = collectMarkdownFiles(repositoryRoot);
const pinnedSuiSource =
  /^https:\/\/github\.com\/MystenLabs\/sui\/(?:blob\/[0-9a-f]{40}\/(?!docs\/)[^\s)]+|tree\/[0-9a-f]{40}(?:\/(?!docs\/)[^\s)]*)?)$/;

for (const markdownFile of markdownFiles) {
  const contents = readFileSync(markdownFile, "utf8");

  for (const match of contents.matchAll(/https?:\/\/[^\s)<>'"`]+/g)) {
    const target = match[0];
    if (!pinnedSuiSource.test(target)) {
      fail(`${markdownFile} contains disallowed external reference ${target}`);
    }
  }

  for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].replace(/^<|>$/g, "");
    if (!rawTarget || rawTarget.startsWith("#")) continue;
    if (/^https?:\/\//.test(rawTarget)) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) {
      fail(`${markdownFile} contains disallowed reference scheme ${rawTarget}`);
      continue;
    }

    const [targetWithQuery, fragment] = rawTarget.split("#", 2);
    const target = targetWithQuery.split("?", 1)[0];
    const resolvedTarget = target
      ? resolve(dirname(markdownFile), target)
      : markdownFile;
    if (target && !existsSync(resolvedTarget)) {
      fail(`${markdownFile} links to missing local file ${target}`);
      continue;
    }
    if (
      fragment &&
      resolvedTarget.endsWith(".md") &&
      !markdownHeadingAnchors(resolvedTarget).has(decodeURIComponent(fragment))
    ) {
      fail(`${markdownFile} links to missing anchor ${fragment} in ${target}`);
    }
  }
}

for (const markdownFile of markdownFiles.filter((file) =>
  file.startsWith(join(repositoryRoot, "skills")),
)) {
  const lines = readFileSync(markdownFile, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (/^\s*[-*+]\s+.*;\s+(?:and|or)\s*$/i.test(line)) {
      fail(
        `${markdownFile}:${index + 1} ends a list item with an ambiguous conjunction`,
      );
    }
  }
}

const expectedNames = [];
const localReferences = [];
for (const skillFile of collectSkillFiles(repositoryRoot)) {
  const contents = readFileSync(skillFile, "utf8");
  const frontmatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const name = frontmatter?.[1].match(/^name:\s*([a-z0-9-]+)\s*$/m)?.[1];
  const description = frontmatter?.[1].match(/^description:\s*(\S.*)$/m)?.[1];

  if (!name || !description) {
    fail(`${skillFile} needs name and description frontmatter`);
    continue;
  }
  if (name !== basename(dirname(skillFile))) {
    fail(`${skillFile} declares name ${name}, which does not match its directory`);
  }
  if (expectedNames.includes(name)) {
    fail(`duplicate skill name: ${name}`);
  }
  if (!existsSync(join(dirname(skillFile), "agents", "openai.yaml"))) {
    fail(`${name} has no agents/openai.yaml metadata`);
  }

  for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0].split("?", 1)[0];
    if (!target || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;

    if (!existsSync(resolve(dirname(skillFile), target))) {
      fail(`${skillFile} links to missing local file ${target}`);
    }
    localReferences.push({ name, target });
  }

  expectedNames.push(name);
}
expectedNames.sort();

if (process.exitCode) process.exit(process.exitCode);

const installRoot = mkdtempSync(join(tmpdir(), "sui-move-engineering-skills-"));
try {
  const install = spawnSync(
    "npx",
    [
      "--yes",
      `skills@${SKILLS_CLI_VERSION}`,
      "add",
      repositoryRoot,
      "--skill",
      "*",
      "--agent",
      "codex",
      "--yes",
      "--copy",
    ],
    { cwd: installRoot, encoding: "utf8" },
  );

  process.stdout.write(install.stdout ?? "");
  process.stderr.write(install.stderr ?? "");
  if (install.status !== 0) {
    fail(`skills CLI exited with status ${install.status}`);
  } else {
    const installedDirectory = join(installRoot, ".agents", "skills");
    const installedNames = readdirSync(installedDirectory).sort();
    if (JSON.stringify(installedNames) !== JSON.stringify(expectedNames)) {
      fail(
        `installer found [${installedNames.join(", ")}], expected [${expectedNames.join(", ")}]`,
      );
    }

    for (const { name, target } of localReferences) {
      const installedSkill = join(installedDirectory, name, "SKILL.md");
      if (!existsSync(resolve(dirname(installedSkill), target))) {
        fail(`${name} installation is missing linked file ${target}`);
      }
    }
  }
} finally {
  rmSync(installRoot, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `Validated suite v${packageJson.version}: ${expectedNames.length} skills discovered and installed with skills CLI ${SKILLS_CLI_VERSION}.`,
);
