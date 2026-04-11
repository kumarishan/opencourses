"use strict";
const electron = require("electron");
const fs$1 = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const child_process = require("child_process");
const readline = require("readline");
const fs = require("fs/promises");
const util = require("util");
const pty = require("node-pty");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs$1);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const crypto__namespace = /* @__PURE__ */ _interopNamespaceDefault(crypto);
const fs__namespace$1 = /* @__PURE__ */ _interopNamespaceDefault(fs);
const IPC = {
  prerequisites: {
    get: "prerequisites/get"
  },
  registry: {
    list: "registry/list",
    refresh: "registry/refresh"
  },
  courses: {
    list: "courses/list",
    add: "courses/add",
    remove: "courses/remove",
    setMode: "courses/setMode",
    getProgress: "courses/getProgress",
    markSectionComplete: "courses/markSectionComplete",
    setActiveSection: "courses/setActiveSection"
  },
  git: {
    clone: "git/clone",
    listBranches: "git/listBranches",
    createBranch: "git/createBranch",
    checkout: "git/checkout",
    commitAndPush: "git/commitAndPush",
    discard: "git/discard",
    status: "git/status"
  },
  github: {
    createPR: "github/createPR",
    getPRState: "github/getPRState",
    createRelease: "github/createRelease",
    submitRegistryPR: "github/submitRegistryPR"
  },
  agent: {
    startGeneration: "agent/startGeneration",
    evaluate: "agent/evaluate",
    cancel: "agent/cancel",
    streamChunk: "agent:stream-chunk",
    complete: "agent:complete",
    error: "agent:error",
    evaluationResult: "agent:evaluation-result"
  },
  terminal: {
    create: "terminal/create",
    input: "terminal/input",
    resize: "terminal/resize",
    destroy: "terminal/destroy",
    data: "terminal:data"
  },
  fs: {
    read: "fs/read",
    write: "fs/write",
    list: "fs/list",
    watch: "fs/watch",
    unwatch: "fs/unwatch",
    changed: "fs:changed"
  }
};
function getSkillsDir() {
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "skills");
  }
  return path.join(electron.app.getAppPath(), "resources", "skills");
}
async function loadSkill(skillName) {
  const skillDir = path.join(getSkillsDir(), skillName);
  const skillMd = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf-8");
  const refsDir = path.join(skillDir, "references");
  let refContents = "";
  try {
    const refFiles = (await fs.readdir(refsDir)).sort();
    const refTexts = await Promise.all(
      refFiles.map(async (f) => {
        const text = await fs.readFile(path.join(refsDir, f), "utf-8");
        return `

--- ${f} ---
${text}`;
      })
    );
    refContents = refTexts.join("");
  } catch {
  }
  return skillMd + refContents;
}
function buildAgentArgs(agentCLI, skillContent, taskPrompt) {
  if (agentCLI === "claude") {
    return ["--print", "--system-prompt", skillContent, taskPrompt];
  }
  const combinedPrompt = `${skillContent}

Task payload (JSON):
${taskPrompt}`;
  return ["exec", "--skip-git-repo-check", combinedPrompt];
}
function normalizeAgentError(stderr, agentCLI, code) {
  const trimmed = stderr.trim();
  if (agentCLI === "codex" && trimmed.includes("Local state is only available in the desktop app")) {
    return `${trimmed}
Use \`codex login --device-auth\` or \`codex login --with-api-key\`.`;
  }
  return trimmed || `Process exited with code ${code}`;
}
class AgentService {
  jobs = /* @__PURE__ */ new Map();
  async startGeneration(win, req, agentCLI, skillContent, courseLocalPath) {
    const jobId = crypto__namespace.randomUUID();
    const taskPrompt = JSON.stringify({
      phase: req.phase,
      instructions: req.instructions,
      targetChapter: req.targetChapter,
      targetSection: req.targetSection
    });
    const args = buildAgentArgs(agentCLI, skillContent, taskPrompt);
    const child = child_process.spawn(agentCLI, args, { cwd: courseLocalPath });
    this.jobs.set(jobId, child);
    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      win.webContents.send(IPC.agent.streamChunk, { jobId, chunk: line });
    });
    let stderrBuf = "";
    child.stderr?.on("data", (data) => {
      stderrBuf += data.toString();
    });
    let stdoutFull = "";
    child.stdout?.on("data", (data) => {
      stdoutFull += data.toString();
    });
    child.on("close", (code) => {
      this.jobs.delete(jobId);
      if (code === 0) {
        let outline;
        try {
          const parsed = JSON.parse(stdoutFull.trim());
          outline = Array.isArray(parsed) ? parsed : parsed.outline;
        } catch {
          outline = void 0;
        }
        win.webContents.send(IPC.agent.complete, { jobId, outline });
      } else {
        win.webContents.send(IPC.agent.error, {
          jobId,
          error: normalizeAgentError(stderrBuf, agentCLI, code)
        });
      }
    });
    return { jobId };
  }
  async evaluate(win, req, agentCLI, skillContent, scratchPath) {
    const jobId = crypto__namespace.randomUUID();
    const taskPrompt = JSON.stringify({
      sectionFile: req.sectionFile,
      taskBlock: req.taskBlock,
      scratchFiles: req.scratchFiles
    });
    const args = buildAgentArgs(agentCLI, skillContent, taskPrompt);
    const child = child_process.spawn(agentCLI, args, { cwd: scratchPath });
    this.jobs.set(jobId, child);
    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      win.webContents.send(IPC.agent.streamChunk, { jobId, chunk: line });
    });
    let stderrBuf = "";
    child.stderr?.on("data", (data) => {
      stderrBuf += data.toString();
    });
    let stdoutFull = "";
    child.stdout?.on("data", (data) => {
      stdoutFull += data.toString();
    });
    child.on("close", (code) => {
      this.jobs.delete(jobId);
      if (code === 0) {
        let pass = false;
        let feedback = "";
        try {
          const parsed = JSON.parse(stdoutFull.trim());
          pass = parsed.pass === true;
          feedback = parsed.feedback ?? "";
        } catch {
          feedback = stdoutFull.trim();
        }
        win.webContents.send(IPC.agent.complete, { jobId, pass, feedback });
        win.webContents.send(IPC.agent.evaluationResult, { jobId, pass, feedback });
      } else {
        win.webContents.send(IPC.agent.error, {
          jobId,
          error: normalizeAgentError(stderrBuf, agentCLI, code)
        });
      }
    });
    return { jobId };
  }
  cancel(jobId) {
    const child = this.jobs.get(jobId);
    if (child) {
      child.kill("SIGINT");
      this.jobs.delete(jobId);
    }
  }
}
const agentService = new AgentService();
const execFileAsync$2 = util.promisify(child_process.execFile);
class PrerequisitesService {
  async check() {
    const tools = ["git", "gh", "claude", "codex"];
    const presence = {
      git: false,
      gh: false,
      claude: false,
      codex: false
    };
    await Promise.all(
      tools.map(async (tool) => {
        try {
          await execFileAsync$2("which", [tool]);
          presence[tool] = true;
        } catch {
          presence[tool] = false;
        }
      })
    );
    let agentCLI = null;
    if (presence.claude) {
      agentCLI = "claude";
    } else if (presence.codex) {
      agentCLI = "codex";
    }
    const missing = [];
    if (!presence.git) missing.push("git");
    if (!presence.gh) missing.push("gh");
    if (!presence.claude && !presence.codex) missing.push("claude");
    return { missing, agentCLI };
  }
}
const prerequisitesService = new PrerequisitesService();
const DEFAULT_STATE = {
  version: 1,
  agentPreference: null,
  courses: {}
};
class StateManager {
  state = { ...DEFAULT_STATE, courses: {} };
  debounceTimer = null;
  baseDir;
  constructor(baseDir) {
    this.baseDir = baseDir ?? path__namespace.join(os__namespace.homedir(), ".opencourses");
  }
  get stateFilePath() {
    return path__namespace.join(this.baseDir, "state.json");
  }
  async load() {
    await fs__namespace.promises.mkdir(this.baseDir, { recursive: true });
    await fs__namespace.promises.mkdir(path__namespace.join(this.baseDir, "repositories"), { recursive: true });
    await fs__namespace.promises.mkdir(path__namespace.join(this.baseDir, "courses"), { recursive: true });
    await fs__namespace.promises.mkdir(path__namespace.join(this.baseDir, "logs"), { recursive: true });
    try {
      const raw = await fs__namespace.promises.readFile(this.stateFilePath, "utf8");
      this.state = JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.state = { ...DEFAULT_STATE, courses: {} };
        await this.writeImmediately();
      } else {
        throw err;
      }
    }
  }
  getState() {
    return this.state;
  }
  getCourse(courseId) {
    return this.state.courses[courseId];
  }
  setCourse(courseId, course) {
    this.state.courses[courseId] = course;
    this.scheduleSave();
  }
  removeCourse(courseId) {
    delete this.state.courses[courseId];
    this.scheduleSave();
  }
  markSectionComplete(courseId, chapterId, sectionFile) {
    const course = this.state.courses[courseId];
    if (!course) return;
    if (!course.learnerProgress[chapterId]) {
      course.learnerProgress[chapterId] = { completed: false, sections: {} };
    }
    course.learnerProgress[chapterId].sections[sectionFile] = {
      completed: true,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const chapterProgress = course.learnerProgress[chapterId];
    const allComplete = Object.values(chapterProgress.sections).every((s) => s.completed);
    chapterProgress.completed = allComplete;
    this.scheduleSave();
  }
  setMode(courseId, mode) {
    const course = this.state.courses[courseId];
    if (!course) return;
    course.activeMode = mode;
    this.scheduleSave();
  }
  setBranch(courseId, branch) {
    const course = this.state.courses[courseId];
    if (!course) return;
    course.activeBranch = branch;
    this.scheduleSave();
  }
  setCreationBranch(courseId, branch, pr) {
    const course = this.state.courses[courseId];
    if (!course) return;
    course.creationBranch = branch;
    course.creationPR = pr;
    this.scheduleSave();
  }
  setActiveSection(courseId, chapterId, sectionFile) {
    const course = this.state.courses[courseId];
    if (!course) return;
    course.activeSection = { chapterId, sectionFile };
    this.scheduleSave();
  }
  setAgentPreference(pref) {
    this.state.agentPreference = pref;
    this.scheduleSave();
  }
  async flush() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.writeImmediately();
  }
  scheduleSave() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.writeImmediately().catch((err) => {
        console.error("[StateManager] Failed to persist state:", err);
      });
    }, 300);
  }
  async writeImmediately() {
    const tmpPath = this.stateFilePath + ".tmp";
    await fs__namespace.promises.writeFile(tmpPath, JSON.stringify(this.state, null, 2), "utf8");
    await fs__namespace.promises.rename(tmpPath, this.stateFilePath);
  }
}
const stateManager = new StateManager();
async function resolveAgentCLI() {
  const current = stateManager.getState().agentPreference;
  if (current) return current;
  const prerequisites = await prerequisitesService.check();
  if (!prerequisites.agentCLI) {
    throw new Error("No supported agent CLI available. Install Claude Code or Codex.");
  }
  stateManager.setAgentPreference(prerequisites.agentCLI);
  return prerequisites.agentCLI;
}
function registerAgentHandlers() {
  electron.ipcMain.handle(
    IPC.agent.startGeneration,
    async (event, req) => {
      try {
        const win = electron.BrowserWindow.fromWebContents(event.sender);
        if (!win) throw new Error("No BrowserWindow found");
        const course = stateManager.getCourse(req.courseId);
        if (!course) {
          return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${req.courseId}` } };
        }
        const agentCLI = await resolveAgentCLI();
        const skillContent = await loadSkill("course-creation");
        return await agentService.startGeneration(win, req, agentCLI, skillContent, course.localPath);
      } catch (err) {
        const error = err;
        return { error: { code: "AGENT_START_FAILED", message: error.message } };
      }
    }
  );
  electron.ipcMain.handle(
    IPC.agent.evaluate,
    async (event, req) => {
      try {
        const win = electron.BrowserWindow.fromWebContents(event.sender);
        if (!win) throw new Error("No BrowserWindow found");
        const course = stateManager.getCourse(req.courseId);
        if (!course) {
          return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${req.courseId}` } };
        }
        const agentCLI = await resolveAgentCLI();
        const skillContent = await loadSkill("course-evaluation");
        const scratchPath = course.scratchPath || path.dirname(req.sectionFile);
        return await agentService.evaluate(win, req, agentCLI, skillContent, scratchPath);
      } catch (err) {
        const error = err;
        return { error: { code: "AGENT_EVALUATE_FAILED", message: error.message } };
      }
    }
  );
  electron.ipcMain.handle(IPC.agent.cancel, async (_event, jobId) => {
    try {
      agentService.cancel(jobId);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: "AGENT_CANCEL_FAILED", message: error.message } };
    }
  });
}
const execFileAsync$1 = util.promisify(child_process.execFile);
class GitService {
  async exec(args, cwd) {
    const options = cwd ? { cwd } : {};
    const { stdout } = await execFileAsync$1("git", args, options);
    return String(stdout).trim();
  }
  spawnAsync(args, cwd) {
    return new Promise((resolve, reject) => {
      const child = child_process.spawn("git", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => {
        if (code !== 0) {
          const op = args[0].toUpperCase().replace(/-/g, "_");
          const err = new Error(stderr || `git ${args[0]} failed with exit code ${code}`);
          err.code = `GIT_${op}_FAILED`;
          reject(err);
        } else {
          resolve();
        }
      });
      child.on("error", reject);
    });
  }
  wrapError(op, err) {
    const original = err;
    const wrapped = new Error(original.message || `git ${op} failed`);
    wrapped.code = `GIT_${op.toUpperCase().replace(/-/g, "_")}_FAILED`;
    throw wrapped;
  }
  async clone(url, dest) {
    try {
      await this.spawnAsync(["clone", url, dest]);
    } catch (err) {
      this.wrapError("clone", err);
    }
  }
  async listBranches(cwd) {
    try {
      const output = await this.exec(["branch", "--format=%(refname:short)"], cwd);
      if (!output) return [];
      return output.split("\n").map((b) => b.trim()).filter(Boolean);
    } catch (err) {
      this.wrapError("listBranches", err);
    }
  }
  async currentBranch(cwd) {
    try {
      return await this.exec(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    } catch (err) {
      this.wrapError("currentBranch", err);
    }
  }
  async getRemoteUrl(cwd, remote = "origin") {
    try {
      const url = await this.exec(["remote", "get-url", remote], cwd);
      return url || null;
    } catch {
      return null;
    }
  }
  async createBranch(cwd, name) {
    try {
      await this.exec(["checkout", "-b", name], cwd);
    } catch (err) {
      this.wrapError("createBranch", err);
    }
  }
  async checkout(cwd, branch) {
    try {
      await this.exec(["checkout", branch], cwd);
    } catch (err) {
      this.wrapError("checkout", err);
    }
  }
  async commitAndPush(cwd, message) {
    try {
      await this.spawnAsync(["add", "-A"], cwd);
      await this.spawnAsync(["commit", "-m", message], cwd);
      await this.spawnAsync(["push"], cwd);
    } catch (err) {
      this.wrapError("commitAndPush", err);
    }
  }
  async discard(cwd) {
    try {
      await this.exec(["checkout", "--", "."], cwd);
      await this.exec(["clean", "-fd"], cwd);
    } catch (err) {
      this.wrapError("discard", err);
    }
  }
  async status(cwd) {
    try {
      const { stdout } = await execFileAsync$1("git", ["status", "--porcelain"], { cwd });
      const modified = [];
      const untracked = [];
      const staged = [];
      if (!stdout.trim()) {
        return { clean: true, modified, untracked, staged };
      }
      for (const line of stdout.split("\n")) {
        if (line.length < 3) continue;
        const indexStatus = line[0];
        const worktreeStatus = line[1];
        const file = line.substring(3).trim();
        if (!file) continue;
        if (indexStatus !== " " && indexStatus !== "?") {
          staged.push(file);
        }
        if (indexStatus === "?" && worktreeStatus === "?") {
          untracked.push(file);
        } else if (worktreeStatus === "M" || worktreeStatus === "D") {
          modified.push(file);
        }
      }
      const clean = staged.length === 0 && modified.length === 0 && untracked.length === 0;
      return { clean, modified, untracked, staged };
    } catch (err) {
      this.wrapError("status", err);
    }
  }
  async log(cwd, maxCount = 20) {
    try {
      const output = await this.exec(
        ["log", `--max-count=${maxCount}`, "--format=%H%n%s%n%ai"],
        cwd
      );
      if (!output) return [];
      const lines = output.split("\n");
      const entries = [];
      for (let i = 0; i + 2 < lines.length; i += 3) {
        const hash = lines[i].trim();
        const message = lines[i + 1].trim();
        const date = lines[i + 2].trim();
        if (hash) {
          entries.push({ hash, message, date });
        }
      }
      return entries;
    } catch (err) {
      this.wrapError("log", err);
    }
  }
}
const gitService = new GitService();
const DEFAULT_REGISTRY_REPO = "opencourses-project/opencourses-registry";
function getRegistryRepo() {
  const override = process.env.OPENCOURSES_REGISTRY_REPO?.trim();
  return override && override.length > 0 ? override : DEFAULT_REGISTRY_REPO;
}
function getRegistryContentsApiPath() {
  return `repos/${getRegistryRepo()}/contents/registry.json`;
}
function formatRegistryFetchError(message) {
  const trimmed = message.trim();
  if (trimmed.includes("Not Found (HTTP 404)")) {
    return `Registry repo "${getRegistryRepo()}" or its registry.json file was not found. gh is installed, but the configured registry target returned 404. Set OPENCOURSES_REGISTRY_REPO=owner/repo to override it, or use the GitHub URL flow instead.`;
  }
  return trimmed;
}
function execFilePromise(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const cb = (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    };
    if (opts !== void 0) {
      child_process.execFile(cmd, args, opts, cb);
    } else {
      child_process.execFile(cmd, args, cb);
    }
  });
}
async function runGh(args, cwd, operation) {
  try {
    return await execFilePromise("gh", args, cwd !== void 0 ? { cwd } : void 0);
  } catch (err) {
    const execErr = err;
    const stderr = execErr.stderr ?? execErr.message ?? "Unknown error";
    const code = operation ? `GH_${operation}_FAILED` : "GH_FAILED";
    const error = new Error(stderr);
    error.code = code;
    throw error;
  }
}
class GitHubService {
  async createPR(req) {
    const args = [
      "pr",
      "create",
      "--title",
      req.title,
      "--body",
      req.body ?? "",
      "--base",
      req.base ?? "main",
      "--json",
      "number,url,state"
    ];
    const { stdout } = await runGh(args, req.cwd, "CREATE_PR");
    const parsed = JSON.parse(stdout);
    return {
      number: parsed.number,
      url: parsed.url,
      state: normalizeState(parsed.state)
    };
  }
  async getPRState(cwd, prNumber) {
    const args = ["pr", "view", String(prNumber), "--json", "number,url,state"];
    const { stdout } = await runGh(args, cwd, "GET_PR_STATE");
    const parsed = JSON.parse(stdout);
    return {
      number: parsed.number,
      url: parsed.url,
      state: normalizeState(parsed.state)
    };
  }
  async createRelease(req) {
    const args = [
      "release",
      "create",
      req.tag,
      "--title",
      req.title,
      "--notes",
      req.notes ?? ""
    ];
    await runGh(args, req.cwd, "CREATE_RELEASE");
    return {
      tag: req.tag,
      url: "",
      title: req.title
    };
  }
  async repoExists(repoUrl) {
    try {
      await execFilePromise("gh", ["repo", "view", repoUrl]);
      return true;
    } catch {
      return false;
    }
  }
  async createRepo(name, description, isPrivate) {
    const visibilityFlag = isPrivate ? "--private" : "--public";
    const args = [
      "repo",
      "create",
      name,
      "--description",
      description,
      visibilityFlag,
      "--json",
      "url"
    ];
    const { stdout } = await runGh(args, void 0, "CREATE_REPO");
    const parsed = JSON.parse(stdout);
    return parsed.url;
  }
  async submitRegistryPR(courseId, registryRepoOwner) {
    const tmpDir = await fs__namespace.promises.mkdtemp(path__namespace.join(os__namespace.tmpdir(), "opencourses-registry-"));
    try {
      await execFilePromise("gh", ["repo", "clone", getRegistryRepo(), tmpDir, "--", "--depth=1"]);
      const registryPath = path__namespace.join(tmpDir, "registry.json");
      let registry = [];
      try {
        const raw = await fs__namespace.promises.readFile(registryPath, "utf8");
        registry = JSON.parse(raw);
      } catch {
        registry = [];
      }
      const entry = { id: courseId, owner: registryRepoOwner, addedAt: (/* @__PURE__ */ new Date()).toISOString() };
      registry.push(entry);
      await fs__namespace.promises.writeFile(registryPath, JSON.stringify(registry, null, 2), "utf8");
      const branch = `add-course-${courseId}-${Date.now()}`;
      await execFilePromise("git", ["checkout", "-b", branch], { cwd: tmpDir });
      await execFilePromise("git", ["add", "registry.json"], { cwd: tmpDir });
      await execFilePromise(
        "git",
        ["commit", "-m", `feat: add course ${courseId} to registry`],
        { cwd: tmpDir }
      );
      await execFilePromise("git", ["push", "origin", branch], { cwd: tmpDir });
      const pr = await this.createPR({
        cwd: tmpDir,
        title: `Add course: ${courseId}`,
        body: `Adds course \`${courseId}\` to the opencourses registry.

Owner: ${registryRepoOwner}`,
        base: "main"
      });
      return pr;
    } finally {
      await fs__namespace.promises.rm(tmpDir, { recursive: true, force: true });
    }
  }
}
function normalizeState(state) {
  const s = state.toLowerCase();
  if (s === "open") return "open";
  if (s === "merged") return "merged";
  if (s === "closed") return "closed";
  return null;
}
const githubService = new GitHubService();
function deriveCourseSlug(repoUrl) {
  const rawName = repoUrl.split("/").pop() ?? repoUrl;
  return rawName.replace(/\.git$/, "").replace(/[^a-zA-Z0-9-_]/g, "-");
}
function normalizeRepoUrl(repoUrl) {
  const trimmed = repoUrl.trim();
  if (!trimmed) {
    return "";
  }
  const scpLikeMatch = trimmed.match(/^[^@]+@([^:]+):(.+)$/);
  if (scpLikeMatch) {
    const host = scpLikeMatch[1]?.trim().toLowerCase();
    const pathname = scpLikeMatch[2]?.trim().replace(/^\/+/, "").replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase();
    return host && pathname ? `https://${host}/${pathname}` : trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.trim().replace(/^\/+/, "").replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase();
    return `https://${parsed.hostname.toLowerCase()}/${pathname}`;
  } catch {
    return trimmed.toLowerCase().replace(/\.git$/i, "").replace(/\/+$/, "");
  }
}
async function inspectCoursePath(candidatePath) {
  try {
    const stat = await fs__namespace.promises.stat(candidatePath);
    if (!stat.isDirectory()) {
      return "occupied";
    }
    const entries = await fs__namespace.promises.readdir(candidatePath);
    return entries.length === 0 ? "empty-dir" : "occupied";
  } catch (err) {
    if (err.code === "ENOENT") {
      return "missing";
    }
    throw err;
  }
}
async function resolveCourseLocation(repoUrl, coursesDir, baseName) {
  const normalizedRepoUrl = normalizeRepoUrl(repoUrl);
  for (let suffix = 0; suffix < 1e3; suffix += 1) {
    const name = suffix === 0 ? baseName : `${baseName}-${suffix + 1}`;
    const localPath = path__namespace.join(coursesDir, name);
    const pathState = await inspectCoursePath(localPath);
    if (pathState === "missing" || pathState === "empty-dir") {
      return { name, localPath, shouldClone: true };
    }
    const remoteUrl = await gitService.getRemoteUrl(localPath);
    if (remoteUrl && normalizeRepoUrl(remoteUrl) === normalizedRepoUrl) {
      return { name, localPath, shouldClone: false };
    }
  }
  const error = new Error(`Unable to allocate a course directory for ${baseName}`);
  error.code = "COURSE_DIRECTORY_UNAVAILABLE";
  throw error;
}
function registerCoursesHandlers() {
  electron.ipcMain.handle(IPC.courses.list, () => {
    try {
      return Object.values(stateManager.getState().courses);
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "COURSES_LIST_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.courses.add, async (_event, req) => {
    try {
      const repoUrl = req.courseRepo;
      const normalizedRepoUrl = normalizeRepoUrl(repoUrl);
      const existingCourse = Object.values(stateManager.getState().courses).find(
        (course) => normalizeRepoUrl(course.courseRepo) === normalizedRepoUrl
      );
      if (existingCourse) {
        const existingRemoteUrl = await gitService.getRemoteUrl(existingCourse.localPath);
        if (existingRemoteUrl && normalizeRepoUrl(existingRemoteUrl) === normalizedRepoUrl) {
          return existingCourse;
        }
      }
      const baseName = deriveCourseSlug(repoUrl);
      const coursesDir = path__namespace.join(os__namespace.homedir(), ".opencourses", "courses");
      const { name, localPath, shouldClone } = await resolveCourseLocation(
        repoUrl,
        coursesDir,
        baseName
      );
      const scratchPath = req.scratchPath ?? path__namespace.join(localPath, "scratch");
      if (shouldClone) {
        await gitService.clone(repoUrl, localPath);
      }
      await fs__namespace.promises.mkdir(scratchPath, { recursive: true });
      let title = name;
      try {
        const courseJsonPath = path__namespace.join(localPath, "course.json");
        const raw = await fs__namespace.promises.readFile(courseJsonPath, "utf8");
        const courseJson = JSON.parse(raw);
        if (courseJson.title) {
          title = courseJson.title;
        }
      } catch {
      }
      let activeBranch = "main";
      try {
        activeBranch = await gitService.currentBranch(localPath);
      } catch {
        activeBranch = "main";
      }
      const courseId = crypto__namespace.randomUUID();
      const courseState = {
        id: courseId,
        name,
        title,
        localPath,
        scratchPath,
        sourceRepo: req.sourceRepo ?? "",
        courseRepo: repoUrl,
        activeMode: "learn",
        activeBranch,
        creationBranch: null,
        creationPR: { number: null, url: null, state: null },
        activeSection: null,
        learnerProgress: {},
        addedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      stateManager.setCourse(courseId, courseState);
      return courseState;
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "COURSES_ADD_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.courses.remove, async (_event, courseId) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      await fs__namespace.promises.rm(course.localPath, { recursive: true, force: true });
      stateManager.removeCourse(courseId);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "COURSES_REMOVE_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.courses.setMode, async (_event, courseId, mode) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      if (mode === "learn") {
        stateManager.setMode(courseId, "learn");
        return { status: "ok", mode: "learn", branch: course.activeBranch };
      }
      if (mode === "create") {
        const { creationBranch, creationPR, localPath } = course;
        if (!creationBranch) {
          return { status: "needs-branch-name" };
        }
        if (creationPR.number != null) {
          const prInfo = await githubService.getPRState(localPath, creationPR.number);
          if (prInfo.state === "merged") {
            return { status: "pr-merged", prUrl: prInfo.url ?? "" };
          }
          await gitService.checkout(localPath, creationBranch);
          stateManager.setMode(courseId, "create");
          stateManager.setBranch(courseId, creationBranch);
          return { status: "ok", mode: "create", branch: creationBranch };
        }
        await gitService.checkout(localPath, creationBranch);
        stateManager.setMode(courseId, "create");
        stateManager.setBranch(courseId, creationBranch);
        return { status: "ok", mode: "create", branch: creationBranch };
      }
      stateManager.setMode(courseId, mode);
      return { status: "ok", mode, branch: course.activeBranch };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "COURSES_SETMODE_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.courses.getProgress, (_event, courseId) => {
    try {
      return stateManager.getCourse(courseId)?.learnerProgress ?? {};
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "COURSES_GETPROGRESS_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(
    IPC.courses.markSectionComplete,
    (_event, courseId, chapterId, sectionFile) => {
      try {
        stateManager.markSectionComplete(courseId, chapterId, sectionFile);
        return { ok: true };
      } catch (err) {
        const error = err;
        return {
          error: {
            code: error.code ?? "COURSES_MARK_SECTION_COMPLETE_FAILED",
            message: error.message
          }
        };
      }
    }
  );
  electron.ipcMain.handle(
    IPC.courses.setActiveSection,
    (_event, courseId, chapterId, sectionFile) => {
      try {
        stateManager.setActiveSection(courseId, chapterId, sectionFile);
        return { ok: true };
      } catch (err) {
        const error = err;
        return {
          error: {
            code: error.code ?? "COURSES_SET_ACTIVE_SECTION_FAILED",
            message: error.message
          }
        };
      }
    }
  );
}
class FileSystemService {
  baseDir;
  watchers = /* @__PURE__ */ new Map();
  constructor(baseDir) {
    this.baseDir = baseDir ?? path__namespace.join(os__namespace.homedir(), ".opencourses");
  }
  assertSafe(filePath) {
    const resolved = path__namespace.resolve(filePath);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`PATH_TRAVERSAL: ${filePath} escapes baseDir`);
    }
  }
  async log(message) {
    const logDir = path__namespace.join(os__namespace.homedir(), ".opencourses", "logs");
    const logFile = path__namespace.join(logDir, "main.log");
    try {
      await fs__namespace$1.mkdir(logDir, { recursive: true });
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      await fs__namespace$1.appendFile(logFile, `[${timestamp}] [debug] ${message}
`);
    } catch {
    }
  }
  async read(filePath) {
    this.assertSafe(filePath);
    await this.log(`read: ${filePath}`);
    const content = await fs__namespace$1.readFile(filePath, "utf-8");
    return { content };
  }
  async write(filePath, content) {
    this.assertSafe(filePath);
    await this.log(`write: ${filePath}`);
    const dir = path__namespace.dirname(filePath);
    await fs__namespace$1.mkdir(dir, { recursive: true });
    await fs__namespace$1.writeFile(filePath, content, "utf-8");
  }
  async list(dirPath) {
    this.assertSafe(dirPath);
    await this.log(`list: ${dirPath}`);
    const entries = await fs__namespace$1.readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      path: path__namespace.join(dirPath, entry.name),
      isDirectory: entry.isDirectory()
    }));
  }
  watch(win, watchPath) {
    this.assertSafe(watchPath);
    const watchId = crypto__namespace.randomUUID();
    const watcher = fs$1.watch(watchPath, { recursive: false }, (event, filename) => {
      const filePath = filename ? path__namespace.join(watchPath, filename) : watchPath;
      win.webContents.send(IPC.fs.changed, { watchId, path: filePath });
    });
    this.watchers.set(watchId, watcher);
    this.log(`watch: ${watchPath} (watchId=${watchId})`).catch(() => {
    });
    return { watchId };
  }
  unwatch(watchId) {
    const watcher = this.watchers.get(watchId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watchId);
      this.log(`unwatch: ${watchId}`).catch(() => {
      });
    }
  }
}
const fsService = new FileSystemService();
function registerFsHandlers() {
  electron.ipcMain.handle(IPC.fs.read, async (_event, filePath) => {
    try {
      return await fsService.read(filePath);
    } catch (err) {
      const error = err;
      return { error: { code: err.code ?? "FS_READ_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.fs.write, async (_event, filePath, content) => {
    try {
      await fsService.write(filePath, content);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: err.code ?? "FS_WRITE_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.fs.list, async (_event, dirPath) => {
    try {
      const entries = await fsService.list(dirPath);
      return { entries };
    } catch (err) {
      const error = err;
      return { error: { code: err.code ?? "FS_LIST_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.fs.watch, (event, watchPath) => {
    try {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { error: { code: "FS_WATCH_FAILED", message: "Could not get owner BrowserWindow" } };
      }
      const result = fsService.watch(win, watchPath);
      return result;
    } catch (err) {
      const error = err;
      return { error: { code: err.code ?? "FS_WATCH_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.fs.unwatch, (_event, watchId) => {
    try {
      fsService.unwatch(watchId);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: err.code ?? "FS_UNWATCH_FAILED", message: error.message } };
    }
  });
}
function registerGitHandlers() {
  electron.ipcMain.handle(IPC.git.clone, async (_event, url, dest) => {
    try {
      await gitService.clone(url, dest);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_CLONE_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.git.listBranches, async (_event, courseId) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      const branches = await gitService.listBranches(course.localPath);
      return { branches };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_LISTBRANCHES_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.git.createBranch, async (_event, courseId, name) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      await gitService.createBranch(course.localPath, name);
      stateManager.setCreationBranch(courseId, name, { number: null, url: null, state: null });
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_CREATEBRANCH_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.git.checkout, async (_event, courseId, branch) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      await gitService.checkout(course.localPath, branch);
      stateManager.setBranch(courseId, branch);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_CHECKOUT_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.git.commitAndPush, async (_event, courseId, message) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      await gitService.commitAndPush(course.localPath, message);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_COMMITANDPUSH_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.git.discard, async (_event, courseId) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      await gitService.discard(course.localPath);
      return { ok: true };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_DISCARD_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.git.status, async (_event, courseId) => {
    try {
      const course = stateManager.getCourse(courseId);
      if (!course) {
        return { error: { code: "COURSE_NOT_FOUND", message: `Course not found: ${courseId}` } };
      }
      const status = await gitService.status(course.localPath);
      return { status };
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "GIT_STATUS_FAILED", message: error.message } };
    }
  });
}
function registerGitHubHandlers() {
  electron.ipcMain.handle(
    IPC.github.createPR,
    async (_event, req) => {
      try {
        return await githubService.createPR(req);
      } catch (err) {
        const error = err;
        return { error: { code: error.code ?? "GH_CREATE_PR_FAILED", message: error.message } };
      }
    }
  );
  electron.ipcMain.handle(
    IPC.github.getPRState,
    async (_event, courseId, prNumber) => {
      try {
        const course = stateManager.getCourse(courseId);
        if (!course) {
          return { error: { code: "COURSE_NOT_FOUND", message: `Course ${courseId} not found` } };
        }
        return await githubService.getPRState(course.localPath, prNumber);
      } catch (err) {
        const error = err;
        return { error: { code: error.code ?? "GH_GET_PR_STATE_FAILED", message: error.message } };
      }
    }
  );
  electron.ipcMain.handle(
    IPC.github.createRelease,
    async (_event, req) => {
      try {
        return await githubService.createRelease(req);
      } catch (err) {
        const error = err;
        return {
          error: { code: error.code ?? "GH_CREATE_RELEASE_FAILED", message: error.message }
        };
      }
    }
  );
  electron.ipcMain.handle(
    IPC.github.submitRegistryPR,
    async (_event, courseId, registryRepoOwner) => {
      try {
        return await githubService.submitRegistryPR(courseId, registryRepoOwner);
      } catch (err) {
        const error = err;
        return {
          error: {
            code: error.code ?? "GH_SUBMIT_REGISTRY_PR_FAILED",
            message: error.message
          }
        };
      }
    }
  );
}
function registerPrerequisitesHandlers() {
  electron.ipcMain.handle(IPC.prerequisites.get, async () => {
    try {
      return await prerequisitesService.check();
    } catch (err) {
      const error = err;
      return { error: { code: "PREREQUISITES_CHECK_FAILED", message: error.message } };
    }
  });
}
const execFileAsync = util.promisify(child_process.execFile);
class RegistryService {
  cache = null;
  async list() {
    if (this.cache !== null) {
      return this.cache;
    }
    return this.fetch();
  }
  async refresh() {
    return this.fetch();
  }
  async fetch() {
    let b64;
    try {
      const { stdout } = await execFileAsync("gh", [
        "api",
        getRegistryContentsApiPath(),
        "--jq",
        ".content"
      ]);
      b64 = stdout.trim();
    } catch (err) {
      const error = err;
      const message = formatRegistryFetchError(
        error.stderr?.trim() || error.message || "Unknown error"
      );
      const fetchError = new Error(message);
      fetchError.code = "REGISTRY_FETCH_FAILED";
      throw fetchError;
    }
    const json = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    const courses = parsed.courses;
    this.cache = courses;
    return courses;
  }
}
const registryService = new RegistryService();
function registerRegistryHandlers() {
  electron.ipcMain.handle(IPC.registry.list, async () => {
    try {
      return await registryService.list();
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "REGISTRY_FETCH_FAILED", message: error.message } };
    }
  });
  electron.ipcMain.handle(IPC.registry.refresh, async () => {
    try {
      return await registryService.refresh();
    } catch (err) {
      const error = err;
      return { error: { code: error.code ?? "REGISTRY_FETCH_FAILED", message: error.message } };
    }
  });
}
class TerminalService {
  sessions = /* @__PURE__ */ new Map();
  create(win, courseId, cwd) {
    const resolvedCwd = cwd ?? stateManager.getCourse(courseId)?.scratchPath ?? os__namespace.homedir();
    const shell = process.env.SHELL || "/bin/bash";
    const sessionId = crypto__namespace.randomUUID();
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: resolvedCwd,
      env: process.env
    });
    ptyProcess.onData((data) => {
      win.webContents.send(IPC.terminal.data, { sessionId, data });
    });
    this.sessions.set(sessionId, { id: sessionId, pty: ptyProcess, cwd: resolvedCwd });
    return { sessionId };
  }
  input(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.pty.write(data);
  }
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.pty.resize(cols, rows);
  }
  destroy(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(sessionId);
  }
}
const terminalService = new TerminalService();
function registerTerminalHandlers() {
  electron.ipcMain.handle(
    IPC.terminal.create,
    (event, { courseId, cwd }) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (!win) throw new Error("No owner BrowserWindow found");
      return terminalService.create(win, courseId, cwd);
    }
  );
  electron.ipcMain.handle(
    IPC.terminal.input,
    (_event, { sessionId, data }) => {
      terminalService.input(sessionId, data);
    }
  );
  electron.ipcMain.handle(
    IPC.terminal.resize,
    (_event, { sessionId, cols, rows }) => {
      terminalService.resize(sessionId, cols, rows);
    }
  );
  electron.ipcMain.handle(IPC.terminal.destroy, (_event, { sessionId }) => {
    terminalService.destroy(sessionId);
  });
}
let handlersRegistered = false;
let lifecycleRegistered = false;
async function logStartup() {
  const logDir = path.join(os__namespace.homedir(), ".opencourses", "logs");
  await fs__namespace.promises.mkdir(logDir, { recursive: true });
  await fs__namespace.promises.appendFile(
    path.join(logDir, "main.log"),
    `[${(/* @__PURE__ */ new Date()).toISOString()}] [info] opencourses bootstrap started
`,
    "utf8"
  );
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 12 } : void 0,
    vibrancy: process.platform === "darwin" ? "under-window" : void 0,
    backgroundColor: "#0a0a0b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  {
    mainWindow.loadURL("http://localhost:5174");
  }
  return mainWindow;
}
async function bootstrap() {
  await stateManager.load();
  await logStartup();
  const prerequisites = await prerequisitesService.check();
  stateManager.setAgentPreference(prerequisites.agentCLI);
  if (!handlersRegistered) {
    registerPrerequisitesHandlers();
    registerRegistryHandlers();
    registerCoursesHandlers();
    registerGitHandlers();
    registerGitHubHandlers();
    registerAgentHandlers();
    registerTerminalHandlers();
    registerFsHandlers();
    handlersRegistered = true;
  }
  if (!lifecycleRegistered) {
    electron.app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        electron.app.quit();
      }
    });
    electron.app.on("before-quit", () => stateManager.flush());
    lifecycleRegistered = true;
  }
  return createWindow();
}
electron.app.whenReady().then(() => {
  bootstrap();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
//# sourceMappingURL=index.js.map
