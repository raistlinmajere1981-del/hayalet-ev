/**
 * Git PR Tools for MCP Server
 * 
 * GitHub CLI (gh) entegrasyonu ile PR workflow'ları:
 * - git_fork_setup: Fork ve branch hazırlığı
 * - git_create_pr: PR oluştur
 * - git_check_guidelines: Contribution guidelines kontrolü
 * - git_pr_status: Mevcut PR durumu
 */

import { spawn } from "child_process";
import { access, readFile } from "fs/promises";
import { join } from "path";

// Helper: Shell komutu çalıştır
async function runCommand(cmd: string, cwd?: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", cmd], { cwd });
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    
    child.on("close", (code) => {
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() || undefined,
      });
    });
    
    setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, output: "", error: "Timeout" });
    }, 60000);
  });
}

// Helper: gh CLI kontrolü
async function checkGhCli(): Promise<{ available: boolean; user?: string; error?: string }> {
  const ghCheck = await runCommand("command -v gh");
  if (!ghCheck.success) {
    return { available: false, error: "GitHub CLI (gh) kurulu değil. Kur: brew install gh veya apt install gh" };
  }
  
  const authCheck = await runCommand("gh auth status");
  if (!authCheck.success) {
    return { available: false, error: "GitHub CLI giriş yapılmamış. Çalıştır: gh auth login" };
  }
  
  const userResult = await runCommand("gh api user --jq '.login'");
  return { available: true, user: userResult.output };
}

// ============================================
// Tool: git_fork_setup
// ============================================
export async function gitForkSetup(
  repo: string,
  workDir: string,
  baseBranch: string = "main",
  featureBranch?: string,
  shallow: boolean = true
): Promise<{ success: boolean; message: string; repoPath?: string }> {
  // gh CLI kontrolü
  const ghStatus = await checkGhCli();
  if (!ghStatus.available) {
    return { success: false, message: ghStatus.error || "gh CLI kullanılamıyor" };
  }
  
  const ghUser = ghStatus.user!;
  const repoName = repo.split("/")[1];
  const repoPath = join(workDir, repoName || 'repo');
  const depthArg = shallow ? "--depth 1" : "";
  
  let output = `🔧 Git Fork Setup\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📦 Repo: ${repo}\n`;
  output += `👤 User: ${ghUser}\n`;
  output += `📁 Path: ${repoPath}\n`;
  output += `🌿 Base: ${baseBranch}\n`;
  if (featureBranch) output += `🔀 Feature: ${featureBranch}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 1. Fork kontrolü ve oluşturma
  output += `[1/4] Fork kontrol ediliyor...\n`;
  const forkCheck = await runCommand(`gh repo view ${ghUser}/${repoName} --json name 2>/dev/null`);
  
  if (!forkCheck.success) {
    output += `  → Fork bulunamadı, oluşturuluyor...\n`;
    const forkResult = await runCommand(`gh repo fork ${repo} --clone=false`);
    if (!forkResult.success) {
      return { success: false, message: output + `\n❌ Fork oluşturulamadı: ${forkResult.error}` };
    }
    output += `  ✅ Fork oluşturuldu\n`;
  } else {
    output += `  ✅ Fork mevcut\n`;
  }
  
  // 2. Clone veya mevcut repo kontrolü
  output += `\n[2/4] Repository hazırlanıyor...\n`;
  try {
    await access(join(repoPath, ".git"));
    output += `  → Mevcut repo bulundu, güncelleniyor...\n`;
    await runCommand(`git fetch upstream || git remote add upstream https://github.com/${repo}.git && git fetch upstream`, repoPath);
  } catch {
    output += `  → Clone ediliyor...\n`;
    const cloneResult = await runCommand(`gh repo clone ${ghUser}/${repoName} ${repoPath} -- ${depthArg}`);
    if (!cloneResult.success) {
      return { success: false, message: output + `\n❌ Clone başarısız: ${cloneResult.error}` };
    }
    // Upstream ekle
    await runCommand(`git remote add upstream https://github.com/${repo}.git`, repoPath);
  }
  output += `  ✅ Repository hazır\n`;
  
  // 3. Upstream'den güncelle
  output += `\n[3/4] Upstream'den güncelleniyor...\n`;
  await runCommand(`git fetch upstream`, repoPath);
  output += `  ✅ Fetch tamamlandı\n`;
  
  // 4. Feature branch oluştur (opsiyonel)
  if (featureBranch) {
    output += `\n[4/4] Feature branch oluşturuluyor...\n`;
    const branchCheck = await runCommand(`git rev-parse --verify ${featureBranch} 2>/dev/null`, repoPath);
    if (branchCheck.success) {
      output += `  → Branch mevcut, checkout yapılıyor...\n`;
      await runCommand(`git checkout ${featureBranch}`, repoPath);
    } else {
      await runCommand(`git checkout -b ${featureBranch} upstream/${baseBranch}`, repoPath);
    }
    output += `  ✅ Branch: ${featureBranch}\n`;
  }
  
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `✅ Setup tamamlandı!\n`;
  output += `📁 cd ${repoPath}\n`;
  
  return { success: true, message: output, repoPath };
}

// ============================================
// Tool: git_create_pr
// ============================================
export async function gitCreatePr(
  baseBranch: string,
  title: string,
  body?: string,
  cwd?: string
): Promise<{ success: boolean; message: string; prUrl?: string }> {
  const repoPath = cwd || process.cwd();
  
  // gh CLI kontrolü
  const ghStatus = await checkGhCli();
  if (!ghStatus.available) {
    return { success: false, message: ghStatus.error || "gh CLI kullanılamıyor" };
  }
  
  let output = `🚀 PR Oluşturma\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  // 1. Git repo kontrolü
  const gitCheck = await runCommand("git rev-parse --git-dir", repoPath);
  if (!gitCheck.success) {
    return { success: false, message: "Bu dizin bir git repository değil" };
  }
  
  // 2. Mevcut branch
  const branchResult = await runCommand("git branch --show-current", repoPath);
  const currentBranch = branchResult.output;
  output += `🌿 Branch: ${currentBranch}\n`;
  
  if (currentBranch === baseBranch) {
    return { success: false, message: `Base branch (${baseBranch}) üzerindesiniz. Önce feature branch oluşturun.` };
  }
  
  // 3. Uncommitted değişiklik kontrolü
  const statusResult = await runCommand("git status --porcelain", repoPath);
  if (statusResult.output) {
    output += `\n[1/4] Uncommitted değişiklikler commit ediliyor...\n`;
    await runCommand("git add -u", repoPath);
    const commitResult = await runCommand(`git commit -s -m "${title}"`, repoPath);
    if (commitResult.success) {
      output += `  ✅ Değişiklikler commit edildi (DCO signed)\n`;
    }
  } else {
    output += `\n[1/4] Tüm değişiklikler commit edilmiş ✅\n`;
  }
  
  // 4. Upstream bilgisi
  const upstreamResult = await runCommand("git remote get-url upstream", repoPath);
  if (!upstreamResult.success) {
    return { success: false, message: "Upstream remote bulunamadı. Önce git_fork_setup çalıştırın." };
  }
  const upstreamUrl = upstreamResult.output;
  const upstreamRepo = upstreamUrl.replace(/.*github\.com[:/](.*)\.git?/, "$1").replace(".git", "");
  output += `📦 Upstream: ${upstreamRepo}\n`;
  
  // 5. Origin user
  const originResult = await runCommand("git remote get-url origin", repoPath);
  const originUser = originResult.output.replace(/.*github\.com[:/](.*)\/.*/, "$1");
  
  // 6. Push
  output += `\n[2/4] Branch push ediliyor...\n`;
  const pushResult = await runCommand(`git push -u origin ${currentBranch}`, repoPath);
  if (!pushResult.success && !pushResult.error?.includes("up-to-date")) {
    return { success: false, message: output + `\n❌ Push başarısız: ${pushResult.error}` };
  }
  output += `  ✅ Push tamamlandı\n`;
  
  // 7. Mevcut PR kontrolü
  output += `\n[3/4] Mevcut PR kontrol ediliyor...\n`;
  const prCheckResult = await runCommand(
    `gh pr list --repo ${upstreamRepo} --head ${originUser}:${currentBranch} --json number,url --jq '.[0].url'`,
    repoPath
  );
  
  if (prCheckResult.output && prCheckResult.output !== "null") {
    output += `  ⚠️ PR zaten mevcut: ${prCheckResult.output}\n`;
    return { success: true, message: output, prUrl: prCheckResult.output };
  }
  
  // 8. PR oluştur
  output += `\n[4/4] PR oluşturuluyor...\n`;
  const bodyArg = body ? `--body "${body.replace(/"/g, '\\"')}"` : "";
  const prResult = await runCommand(
    `gh pr create --repo ${upstreamRepo} --base ${baseBranch} --head ${originUser}:${currentBranch} --title "${title}" ${bodyArg}`,
    repoPath
  );
  
  if (!prResult.success) {
    return { success: false, message: output + `\n❌ PR oluşturulamadı: ${prResult.error}` };
  }
  
  const prUrl = prResult.output;
  output += `  ✅ PR oluşturuldu!\n`;
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `🔗 ${prUrl}\n`;
  
  return { success: true, message: output, prUrl };
}

// ============================================
// Tool: git_check_guidelines
// ============================================
export async function gitCheckGuidelines(cwd?: string): Promise<{ success: boolean; message: string; checks: Record<string, boolean> }> {
  const repoPath = cwd || process.cwd();
  const checks: Record<string, boolean> = {};
  
  let output = `📋 Contribution Guidelines Kontrolü\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // CONTRIBUTING.md
  try {
    await access(join(repoPath, "CONTRIBUTING.md"));
    checks.contributing = true;
    output += `✅ CONTRIBUTING.md bulundu\n`;
    const content = await readFile(join(repoPath, "CONTRIBUTING.md"), "utf-8");
    const firstLines = content.split("\n").slice(0, 10).join("\n");
    output += `   İlk 10 satır:\n   ${firstLines.replace(/\n/g, "\n   ")}\n\n`;
  } catch {
    checks.contributing = false;
    output += `⚠️ CONTRIBUTING.md bulunamadı\n\n`;
  }
  
  // CODE_OF_CONDUCT.md
  try {
    await access(join(repoPath, "CODE_OF_CONDUCT.md"));
    checks.codeOfConduct = true;
    output += `✅ CODE_OF_CONDUCT.md bulundu\n`;
  } catch {
    checks.codeOfConduct = false;
    output += `⚠️ CODE_OF_CONDUCT.md bulunamadı\n`;
  }
  
  // PR Template
  const prTemplates = [
    ".github/PULL_REQUEST_TEMPLATE.md",
    "PULL_REQUEST_TEMPLATE.md",
    ".github/pull_request_template.md",
  ];
  checks.prTemplate = false;
  for (const template of prTemplates) {
    try {
      await access(join(repoPath, template));
      checks.prTemplate = true;
      output += `\n✅ PR Template bulundu: ${template}\n`;
      const content = await readFile(join(repoPath, template), "utf-8");
      output += `   İçerik:\n   ${content.replace(/\n/g, "\n   ")}\n`;
      break;
    } catch { /* devam */ }
  }
  if (!checks.prTemplate) {
    output += `\n⚠️ PR Template bulunamadı\n`;
  }
  
  // DCO/Sign-off kontrolü
  checks.dcoRequired = false;
  const filesToCheck = ["CONTRIBUTING.md", "README.md", ".github/CONTRIBUTING.md"];
  for (const file of filesToCheck) {
    try {
      const content = await readFile(join(repoPath, file), "utf-8");
      if (/DCO|sign-off|signed-off-by/i.test(content)) {
        checks.dcoRequired = true;
        output += `\n✅ DCO (Developer Certificate of Origin) gerekli\n`;
        output += `   Commit'lerde -s flag kullanın: git commit -s -m "mesaj"\n`;
        break;
      }
    } catch { /* devam */ }
  }
  if (!checks.dcoRequired) {
    output += `\n⚠️ DCO zorunluluğu tespit edilemedi (yine de -s kullanmanız önerilir)\n`;
  }
  
  // CI/CD kontrolü
  checks.hasCI = false;
  try {
    await access(join(repoPath, ".github/workflows"));
    checks.hasCI = true;
    const workflows = await runCommand("ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null | head -5", repoPath);
    output += `\n✅ GitHub Actions workflow'ları bulundu:\n`;
    output += `   ${workflows.output.replace(/\n/g, "\n   ")}\n`;
  } catch {
    output += `\n⚠️ CI/CD yapılandırması bulunamadı\n`;
  }
  
  // Makefile kontrolü
  try {
    await access(join(repoPath, "Makefile"));
    const makefile = await readFile(join(repoPath, "Makefile"), "utf-8");
    const targets: string[] = [];
    if (/^test:/m.test(makefile)) targets.push("make test");
    if (/^lint:/m.test(makefile)) targets.push("make lint");
    if (/^fmt:/m.test(makefile)) targets.push("make fmt");
    if (targets.length > 0) {
      output += `\n✅ Makefile hedefleri: ${targets.join(", ")}\n`;
    }
  } catch { /* Makefile yok */ }
  
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📝 PR öncesi checklist:\n`;
  output += `   • CONTRIBUTING.md'yi oku\n`;
  output += `   • Commit'leri -s ile imzala (DCO)\n`;
  output += `   • Testleri çalıştır\n`;
  output += `   • PR template'ini takip et\n`;
  
  return { success: true, message: output, checks };
}

// ============================================
// Tool: git_pr_status
// ============================================
export async function gitPrStatus(cwd?: string): Promise<{ success: boolean; message: string }> {
  const repoPath = cwd || process.cwd();
  
  const ghStatus = await checkGhCli();
  if (!ghStatus.available) {
    return { success: false, message: ghStatus.error || "gh CLI kullanılamıyor" };
  }
  
  let output = `📊 Git & PR Durumu\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // Branch bilgisi
  const branchResult = await runCommand("git branch --show-current", repoPath);
  output += `🌿 Branch: ${branchResult.output}\n`;
  
  // Remote bilgisi
  const remotesResult = await runCommand("git remote -v | head -4", repoPath);
  output += `\n📡 Remotes:\n${remotesResult.output}\n`;
  
  // Commit farkı
  const diffResult = await runCommand("git rev-list --count upstream/main..HEAD 2>/dev/null || echo 0", repoPath);
  output += `\n📈 Upstream'den ${diffResult.output} commit ileride\n`;
  
  // Değişiklik durumu
  const statusResult = await runCommand("git status --short", repoPath);
  if (statusResult.output) {
    output += `\n📝 Değişiklikler:\n${statusResult.output}\n`;
  } else {
    output += `\n✅ Çalışma dizini temiz\n`;
  }
  
  // Açık PR'lar
  const upstreamResult = await runCommand("git remote get-url upstream 2>/dev/null", repoPath);
  if (upstreamResult.success) {
    const upstreamRepo = upstreamResult.output.replace(/.*github\.com[:/](.*)\.git?/, "$1").replace(".git", "");
    const prsResult = await runCommand(`gh pr list --repo ${upstreamRepo} --author @me --json number,title,url,state --jq '.[] | "PR #\\(.number): \\(.title) [\\(.state)]\\n   \\(.url)"'`, repoPath);
    if (prsResult.output) {
      output += `\n🔗 Açık PR'larınız:\n${prsResult.output}\n`;
    } else {
      output += `\n📭 Bu repo'da açık PR'ınız yok\n`;
    }
  }
  
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  return { success: true, message: output };
}

// ============================================
// Tool Definitions
// ============================================
export const GIT_TOOL_DEFINITIONS = [
  {
    name: "hev_git_fork_setup",
    description: "GitHub repo fork et, clone et ve feature branch oluştur. gh CLI gerektirir.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Fork edilecek repo (owner/repo)" },
        work_dir: { type: "string", description: "Çalışma dizini" },
        base_branch: { type: "string", description: "Base branch (default: main)" },
        feature_branch: { type: "string", description: "Oluşturulacak feature branch" },
        shallow: { type: "boolean", description: "Shallow clone (hızlı, default: true)" },
      },
      required: ["repo", "work_dir"],
    },
    metadata: {
      category: 'git',
      subcategory: 'contribution',
      priority: 'high',
      complexity: 'medium',
      useCases: ['Open source contribution', 'Fork and setup workflow', 'Feature branch creation'],
      relatedTools: ['hev_git_create_pr', 'hev_git_check_guidelines'],
      agentGuidance: 'Open source contribution için repo fork et, clone et ve branch oluştur. gh CLI gerektirir.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['git', 'fork', 'setup', 'contribution']
    }
  },
  {
    name: "hev_git_create_pr",
    description: "Değişiklikleri commit et, push et ve PR oluştur. Mevcut PR varsa URL döner.",
    inputSchema: {
      type: "object" as const,
      properties: {
        base_branch: { type: "string", description: "PR'ın hedef branch'i (default: main)" },
        title: { type: "string", description: "PR başlığı" },
        body: { type: "string", description: "PR açıklaması" },
        cwd: { type: "string", description: "Repository dizini (default: mevcut dizin)" },
      },
      required: ["base_branch", "title"],
    },
    metadata: {
      category: 'git',
      subcategory: 'contribution',
      priority: 'high',
      complexity: 'medium',
      useCases: ['Create pull request', 'Commit and push changes', 'Open source contribution'],
      relatedTools: ['hev_git_fork_setup', 'hev_git_pr_status', 'hev_git_check_guidelines'],
      agentGuidance: 'Değişiklikleri commit/push et ve PR oluştur. Mevcut PR varsa update eder.',
      requiresConfirmation: true,
      riskLevel: 'medium',
      tags: ['git', 'pr', 'commit', 'contribution']
    }
  },
  {
    name: "hev_git_check_guidelines",
    description: "Repository'nin contribution guidelines, DCO, PR template vb. kontrollerini yap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cwd: { type: "string", description: "Repository dizini (default: mevcut dizin)" },
      },
      required: [] as string[],
    },
    metadata: {
      category: 'git',
      subcategory: 'validation',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Check contribution guidelines', 'DCO verification', 'PR template check'],
      relatedTools: ['hev_git_create_pr', 'hev_git_fork_setup'],
      agentGuidance: 'PR oluşturmadan önce contribution guidelines ve DCO gereksinimlerini kontrol et.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['git', 'guidelines', 'validation', 'dco']
    }
  },
  {
    name: "hev_git_pr_status",
    description: "Mevcut git durumu, açık PR'lar ve branch bilgilerini göster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cwd: { type: "string", description: "Repository dizini (default: mevcut dizin)" },
      },
      required: [],
    },
    metadata: {
      category: 'git',
      subcategory: 'status',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Check git status', 'View open PRs', 'Branch information'],
      relatedTools: ['hev_git_create_pr', 'hev_dev_git_diff'],
      agentGuidance: 'Git durumunu ve açık PR\'ları kontrol et. PR oluşturmadan önce kullan.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['git', 'status', 'pr', 'branch']
    }
  },
];

// Auto-generated metadata for listTools()
export const GIT_TOOL_METADATA = {
  category: "Git & PR",
  emoji: "🔀",
  tools: GIT_TOOL_DEFINITIONS.map(t => t.name)
};
