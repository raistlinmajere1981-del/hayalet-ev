import { spawn } from "child_process";
import { access, readFile } from "fs/promises";
import { join } from "path";
import { createMcpTranslatorSync } from "../utils/i18n/index.js";

type GitTranslator = (key: string, params?: Record<string, string | number | boolean>) => string;

const gitDefinitionTranslator = createMcpTranslatorSync();

function gitDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return gitDefinitionTranslator(`mcpServer.gitTools.definition.${key}`, params);
}

function createGitTranslator(): GitTranslator {
  const t = createMcpTranslatorSync();
  return (key: string, params?: Record<string, string | number | boolean>) =>
    t(`mcpServer.gitTools.${key}`, params);
}

function chunkToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  return String(data);
}

async function runCommand(
  cmd: string,
  cwd?: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const t = createGitTranslator();
  return await new Promise((resolve) => {
    const child = spawn("bash", ["-c", cmd], { cwd });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: unknown) => {
      stdout += chunkToString(data);
    });
    child.stderr.on("data", (data: unknown) => {
      stderr += chunkToString(data);
    });

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() !== "" ? stderr.trim() : (undefined as never),
      });
    });

    setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, output: "", error: t("common.timeout") });
    }, 60000);
  });
}

async function checkGhCli(): Promise<{ available: boolean; user?: string; error?: string }> {
  const t = createGitTranslator();
  const ghCheck = await runCommand("command -v gh");
  if (!ghCheck.success) {
    return {
      available: false,
      error: t("common.ghMissing"),
    };
  }

  const authCheck = await runCommand("gh auth status");
  if (!authCheck.success) {
    return { available: false, error: t("common.ghAuthMissing") };
  }

  const userResult = await runCommand("gh api user --jq '.login'");
  return { available: true, user: userResult.output };
}

export async function gitForkSetup(
  repo: string,
  workDir: string,
  baseBranch: string = "main",
  featureBranch?: string,
  shallow: boolean = true
): Promise<{ success: boolean; message: string; repoPath?: string }> {
  const t = createGitTranslator();
  const ghStatus = await checkGhCli();
  if (!ghStatus.available) {
    return { success: false, message: ghStatus.error ?? t("common.ghUnavailable") };
  }

  const ghUser = ghStatus.user ?? "unknown";
  const repoName = repo.split("/")[1];
  const safeRepoName = repoName ?? "repo";
  const repoPath = join(workDir, safeRepoName);
  const depthArg = shallow ? "--depth 1" : "";

  let output = `${t("forkSetup.title")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${t("forkSetup.repo", { repo })}\n`;
  output += `${t("forkSetup.user", { user: ghUser })}\n`;
  output += `${t("forkSetup.path", { repoPath })}\n`;
  output += `${t("forkSetup.base", { baseBranch })}\n`;
  if (featureBranch !== undefined && featureBranch.length > 0) {
    output += `${t("forkSetup.feature", { featureBranch })}\n`;
  }
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  output += `${t("forkSetup.steps.checkFork")}\n`;
  const forkCheck = await runCommand(
    `gh repo view ${ghUser}/${safeRepoName} --json name 2>/dev/null`
  );

  if (!forkCheck.success) {
    output += `${t("forkSetup.forkMissing")}\n`;
    const forkResult = await runCommand(`gh repo fork ${repo} --clone=false`);
    if (!forkResult.success) {
      return {
        success: false,
        message:
          output +
          `\n${t("forkSetup.forkCreateFailed", {
            message: forkResult.error ?? t("common.unknown"),
          })}`,
      };
    }
    output += `${t("forkSetup.forkCreated")}\n`;
  } else {
    output += `${t("forkSetup.forkExists")}\n`;
  }

  output += `\n${t("forkSetup.steps.prepareRepository")}\n`;
  try {
    await access(join(repoPath, ".git"));
    output += `${t("forkSetup.repositoryExists")}\n`;
    await runCommand(
      `git fetch upstream || git remote add upstream https://github.com/${repo}.git && git fetch upstream`,
      repoPath
    );
  } catch {
    output += `${t("forkSetup.cloning")}\n`;
    const cloneResult = await runCommand(
      `gh repo clone ${ghUser}/${safeRepoName} ${repoPath} -- ${depthArg}`
    );
    if (!cloneResult.success) {
      return {
        success: false,
        message:
          output +
          `\n${t("forkSetup.cloneFailed", {
            message: cloneResult.error ?? t("common.unknown"),
          })}`,
      };
    }
    await runCommand(`git remote add upstream https://github.com/${repo}.git`, repoPath);
  }
  output += `${t("forkSetup.repositoryReady")}\n`;

  output += `\n${t("forkSetup.steps.fetchUpstream")}\n`;
  await runCommand(`git fetch upstream`, repoPath);
  output += `${t("forkSetup.fetchCompleted")}\n`;

  if (featureBranch !== undefined && featureBranch.length > 0) {
    output += `\n${t("forkSetup.steps.createFeatureBranch")}\n`;
    const branchCheck = await runCommand(
      `git rev-parse --verify ${featureBranch} 2>/dev/null`,
      repoPath
    );
    if (branchCheck.success) {
      output += `${t("forkSetup.featureBranchExists")}\n`;
      await runCommand(`git checkout ${featureBranch}`, repoPath);
    } else {
      await runCommand(`git checkout -b ${featureBranch} upstream/${baseBranch}`, repoPath);
    }
    output += `${t("forkSetup.featureBranchReady", { featureBranch })}\n`;
  }

  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${t("forkSetup.completed")}\n`;
  output += `${t("forkSetup.cdHint", { repoPath })}\n`;

  return { success: true, message: output, repoPath };
}

export async function gitCreatePr(
  baseBranch: string,
  title: string,
  body?: string,
  cwd?: string
): Promise<{ success: boolean; message: string; prUrl?: string }> {
  const t = createGitTranslator();
  // eslint-disable-next-line no-restricted-syntax -- git tools work on arbitrary repos, cwd fallback is intentional
  const repoPath = cwd ?? process.cwd();

  const ghStatus = await checkGhCli();
  if (!ghStatus.available) {
    return { success: false, message: ghStatus.error ?? t("common.ghUnavailable") };
  }

  let output = `${t("createPr.title")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  const gitCheck = await runCommand("git rev-parse --git-dir", repoPath);
  if (!gitCheck.success) {
    return { success: false, message: t("createPr.notGitRepository") };
  }

  const branchResult = await runCommand("git branch --show-current", repoPath);
  const currentBranch = branchResult.output;
  output += `${t("createPr.branch", { currentBranch })}\n`;

  if (currentBranch === baseBranch) {
    return {
      success: false,
      message: t("createPr.onBaseBranch", { baseBranch }),
    };
  }

  const statusResult = await runCommand("git status --porcelain", repoPath);
  if (statusResult.output !== "") {
    output += `\n${t("createPr.steps.commitChanges")}\n`;
    await runCommand("git add -u", repoPath);
    const commitResult = await runCommand(`git commit -s -m "${title}"`, repoPath);
    if (commitResult.success) {
      output += `${t("createPr.commitCreated")}\n`;
    }
  } else {
    output += `\n${t("createPr.allChangesCommitted")}\n`;
  }

  const upstreamResult = await runCommand("git remote get-url upstream", repoPath);
  if (!upstreamResult.success) {
    return {
      success: false,
      message: t("createPr.upstreamMissing"),
    };
  }
  const upstreamUrl = upstreamResult.output;
  const upstreamRepo = upstreamUrl.replace(/.*github\.com[:/](.*)\.git?/, "$1").replace(".git", "");
  output += `${t("createPr.upstream", { upstreamRepo })}\n`;

  const originResult = await runCommand("git remote get-url origin", repoPath);
  const originUser = originResult.output.replace(/.*github\.com[:/](.*)\/.*/, "$1");

  output += `\n${t("createPr.steps.pushBranch")}\n`;
  const pushResult = await runCommand(`git push -u origin ${currentBranch}`, repoPath);
  if (!pushResult.success && pushResult.error?.includes("up-to-date") !== true) {
    return {
      success: false,
      message:
        output +
        `\n${t("createPr.pushFailed", { message: pushResult.error ?? t("common.unknown") })}`,
    };
  }
  output += `${t("createPr.pushCompleted")}\n`;

  output += `\n${t("createPr.steps.checkExistingPr")}\n`;
  const prCheckResult = await runCommand(
    `gh pr list --repo ${upstreamRepo} --head ${originUser}:${currentBranch} --json number,url --jq '.[0].url'`,
    repoPath
  );

  if (prCheckResult.output !== "" && prCheckResult.output !== "null") {
    output += `${t("createPr.existingPr", { prUrl: prCheckResult.output })}\n`;
    return { success: true, message: output, prUrl: prCheckResult.output };
  }

  output += `\n${t("createPr.steps.createPr")}\n`;
  const bodyArg =
    body !== undefined && body.length > 0 ? `--body "${body.replace(/"/g, '\\"')}"` : "";
  const prResult = await runCommand(
    `gh pr create --repo ${upstreamRepo} --base ${baseBranch} --head ${originUser}:${currentBranch} --title "${title}" ${bodyArg}`,
    repoPath
  );

  if (!prResult.success) {
    return {
      success: false,
      message:
        output +
        `\n${t("createPr.creationFailed", {
          message: prResult.error ?? t("common.unknown"),
        })}`,
    };
  }

  const prUrl = prResult.output;
  output += `${t("createPr.created")}\n`;
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${t("createPr.prUrl", { prUrl })}\n`;

  return { success: true, message: output, prUrl };
}

export async function gitCheckGuidelines(
  cwd?: string
): Promise<{ success: boolean; message: string; checks: Record<string, boolean> }> {
  const t = createGitTranslator();
  // eslint-disable-next-line no-restricted-syntax -- git tools work on arbitrary repos, cwd fallback is intentional
  const repoPath = cwd ?? process.cwd();
  const checks: Record<string, boolean> = {};

  let output = `${t("guidelines.title")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  try {
    await access(join(repoPath, "CONTRIBUTING.md"));
    checks["contributing"] = true;
    output += `${t("guidelines.contributingFound")}\n`;
    const content = await readFile(join(repoPath, "CONTRIBUTING.md"), "utf-8");
    const firstLines = content.split("\n").slice(0, 10).join("\n");
    output += `${t("guidelines.firstLinesLabel")}\n   ${firstLines.replace(/\n/g, "\n   ")}\n\n`;
  } catch {
    checks["contributing"] = false;
    output += `${t("guidelines.contributingMissing")}\n\n`;
  }

  try {
    await access(join(repoPath, "CODE_OF_CONDUCT.md"));
    checks["codeOfConduct"] = true;
    output += `${t("guidelines.codeOfConductFound")}\n`;
  } catch {
    checks["codeOfConduct"] = false;
    output += `${t("guidelines.codeOfConductMissing")}\n`;
  }

  const prTemplates = [
    ".github/PULL_REQUEST_TEMPLATE.md",
    "PULL_REQUEST_TEMPLATE.md",
    ".github/pull_request_template.md",
  ];
  checks["prTemplate"] = false;

  for (const template of prTemplates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await access(join(repoPath, template));
      checks["prTemplate"] = true;
      output += `\n${t("guidelines.prTemplateFound", { template })}\n`;
      // eslint-disable-next-line no-await-in-loop
      const content = await readFile(join(repoPath, template), "utf-8");
      output += `${t("guidelines.contentLabel")}\n   ${content.replace(/\n/g, "\n   ")}\n`;
      break;
    } catch {
      // NOTE: Continue scanning optional template locations.
    }
  }
  if (!checks["prTemplate"]) {
    output += `\n${t("guidelines.prTemplateMissing")}\n`;
  }

  checks["dcoRequired"] = false;
  const filesToCheck = ["CONTRIBUTING.md", "README.md", ".github/CONTRIBUTING.md"];

  for (const file of filesToCheck) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const content = await readFile(join(repoPath, file), "utf-8");
      if (/DCO|sign-off|signed-off-by/i.test(content)) {
        checks["dcoRequired"] = true;
        output += `\n${t("guidelines.dcoRequired")}\n`;
        output += `   ${t("guidelines.dcoHint")}\n`;
        break;
      }
    } catch {
      // NOTE: Continue scanning optional files for DCO references.
    }
  }
  if (!checks["dcoRequired"]) {
    output += `\n${t("guidelines.dcoNotDetected")}\n`;
  }

  checks["hasCI"] = false;
  try {
    await access(join(repoPath, ".github/workflows"));
    checks["hasCI"] = true;
    const workflows = await runCommand(
      "ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null | head -5",
      repoPath
    );
    output += `\n${t("guidelines.workflowsFound")}\n`;
    output += `   ${workflows.output.replace(/\n/g, "\n   ")}\n`;
  } catch {
    output += `\n${t("guidelines.ciMissing")}\n`;
  }

  try {
    await access(join(repoPath, "Makefile"));
    const makefile = await readFile(join(repoPath, "Makefile"), "utf-8");
    const targets: string[] = [];
    if (/^test:/m.test(makefile)) targets.push("make test");
    if (/^lint:/m.test(makefile)) targets.push("make lint");
    if (/^fmt:/m.test(makefile)) targets.push("make fmt");
    if (targets.length > 0) {
      output += `\n${t("guidelines.makeTargets", { targets: targets.join(", ") })}\n`;
    }
  } catch {
    // NOTE: Makefile support is optional.
  }

  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${t("guidelines.checklistTitle")}\n`;
  output += `   • ${t("guidelines.checklist.readContributing")}\n`;
  output += `   • ${t("guidelines.checklist.signCommits")}\n`;
  output += `   • ${t("guidelines.checklist.runTests")}\n`;
  output += `   • ${t("guidelines.checklist.followTemplate")}\n`;

  return { success: true, message: output, checks };
}

export async function gitPrStatus(cwd?: string): Promise<{ success: boolean; message: string }> {
  const t = createGitTranslator();
  // eslint-disable-next-line no-restricted-syntax -- git tools work on arbitrary repos, cwd fallback is intentional
  const repoPath = cwd ?? process.cwd();

  const ghStatus = await checkGhCli();
  if (!ghStatus.available) {
    return { success: false, message: ghStatus.error ?? t("common.ghUnavailable") };
  }

  let output = `${t("status.title")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const branchResult = await runCommand("git branch --show-current", repoPath);
  output += `${t("status.branch", { branch: branchResult.output })}\n`;

  const remotesResult = await runCommand("git remote -v | head -4", repoPath);
  output += `\n${t("status.remotes")}\n${remotesResult.output}\n`;

  const diffResult = await runCommand(
    "git rev-list --count upstream/main..HEAD 2>/dev/null || echo 0",
    repoPath
  );
  output += `\n${t("status.ahead", { count: diffResult.output })}\n`;

  const statusResult = await runCommand("git status --short", repoPath);
  if (statusResult.output !== "") {
    output += `\n${t("status.changes")}\n${statusResult.output}\n`;
  } else {
    output += `\n${t("status.clean")}\n`;
  }

  const upstreamResult = await runCommand("git remote get-url upstream 2>/dev/null", repoPath);
  if (upstreamResult.success) {
    const upstreamRepo = upstreamResult.output
      .replace(/.*github\.com[:/](.*)\.git?/, "$1")
      .replace(".git", "");
    const prsResult = await runCommand(
      `gh pr list --repo ${upstreamRepo} --author @me --json number,title,url,state --jq '.[] | "PR #\\(.number): \\(.title) [\\(.state)]\\n   \\(.url)"'`,
      repoPath
    );
    if (prsResult.output !== "") {
      output += `\n${t("status.openPrs")}\n${prsResult.output}\n`;
    } else {
      output += `\n${t("status.noOpenPrs")}\n`;
    }
  }

  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return { success: true, message: output };
}

export const GIT_TOOL_DEFINITIONS = [
  {
    name: "hev_git_fork_setup",
    description: gitDefT("forkSetup.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: gitDefT("forkSetup.repo") },
        work_dir: { type: "string", description: gitDefT("forkSetup.workDir") },
        base_branch: { type: "string", description: gitDefT("forkSetup.baseBranch") },
        feature_branch: { type: "string", description: gitDefT("forkSetup.featureBranch") },
        shallow: { type: "boolean", description: gitDefT("forkSetup.shallow") },
      },
      required: ["repo", "work_dir"],
    },
    metadata: {
      category: "git",
      subcategory: "contribution",
      priority: "high",
      complexity: "medium",
      useCases: [
        gitDefT("forkSetup.useCases.openSourceContribution"),
        gitDefT("forkSetup.useCases.setupWorkflow"),
        gitDefT("forkSetup.useCases.featureBranchCreation"),
      ],
      relatedTools: ["hev_git_create_pr", "hev_git_check_guidelines"],
      agentGuidance: gitDefT("forkSetup.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["git", "fork", "setup", "contribution"],
    },
  },
  {
    name: "hev_git_create_pr",
    description: gitDefT("createPr.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        base_branch: { type: "string", description: gitDefT("createPr.baseBranch") },
        title: { type: "string", description: gitDefT("createPr.title") },
        body: { type: "string", description: gitDefT("createPr.body") },
        cwd: { type: "string", description: gitDefT("createPr.cwd") },
      },
      required: ["base_branch", "title"],
    },
    metadata: {
      category: "git",
      subcategory: "contribution",
      priority: "high",
      complexity: "medium",
      useCases: [
        gitDefT("createPr.useCases.createPullRequest"),
        gitDefT("createPr.useCases.commitAndPush"),
        gitDefT("createPr.useCases.openSourceContribution"),
      ],
      relatedTools: ["hev_git_fork_setup", "hev_git_pr_status", "hev_git_check_guidelines"],
      agentGuidance: gitDefT("createPr.agentGuidance"),
      requiresConfirmation: true,
      riskLevel: "medium",
      tags: ["git", "pr", "commit", "contribution"],
    },
  },
  {
    name: "hev_git_check_guidelines",
    description: gitDefT("guidelines.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        cwd: { type: "string", description: gitDefT("guidelines.cwd") },
      },
      required: [] as string[],
    },
    metadata: {
      category: "git",
      subcategory: "validation",
      priority: "medium",
      complexity: "simple",
      useCases: [
        gitDefT("guidelines.useCases.checkContributionGuidelines"),
        gitDefT("guidelines.useCases.dcoVerification"),
        gitDefT("guidelines.useCases.prTemplateCheck"),
      ],
      relatedTools: ["hev_git_create_pr", "hev_git_fork_setup"],
      agentGuidance: gitDefT("guidelines.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["git", "guidelines", "validation", "dco"],
    },
  },
  {
    name: "hev_git_pr_status",
    description: gitDefT("status.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        cwd: { type: "string", description: gitDefT("status.cwd") },
      },
      required: [],
    },
    metadata: {
      category: "git",
      subcategory: "status",
      priority: "medium",
      complexity: "simple",
      useCases: [
        gitDefT("status.useCases.checkGitStatus"),
        gitDefT("status.useCases.viewOpenPrs"),
        gitDefT("status.useCases.branchInformation"),
      ],
      relatedTools: ["hev_git_create_pr", "hev_dev_git_diff"],
      agentGuidance: gitDefT("status.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["git", "status", "pr", "branch"],
    },
  },
];

// NOTE: Auto-generated metadata for listTools().
export const GIT_TOOL_METADATA = {
  category: "Git & PR",
  emoji: "🔀",
  tools: GIT_TOOL_DEFINITIONS.map((t) => t.name),
};
