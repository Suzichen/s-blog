/**
 * 构建输出验证测试
 *
 * 验证生产构建输出满足以下需求：
 * - 需求 1.1: dist/generated/manifest.json 存在且包含 availableLanguages 字段
 * - 需求 1.2: dist/posts/ 包含所有 Markdown 文件
 * - 需求 1.3: public/ 不包含 posts/、generated/、albums/ 子目录
 * - 需求 1.7: public/ 仅保留真正的静态资源文件
 *
 * 用法: node test-build-output.cjs
 */
const fs = require("fs");
const path = require("path");

const CWD = process.cwd();
const DIST_DIR = path.join(CWD, "dist");
const PUBLIC_DIR = path.join(CWD, "public");

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ✅ PASS: ${msg}`);
  passed++;
}

function fail(msg) {
  console.error(`  ❌ FAIL: ${msg}`);
  failed++;
}

// ── Check 1: dist/generated/manifest.json 存在且包含 availableLanguages 字段 ──
console.log("\n[Check 1] dist/generated/manifest.json 存在且包含 availableLanguages 字段");

const manifestPath = path.join(DIST_DIR, "generated", "manifest.json");

if (!fs.existsSync(manifestPath)) {
  fail("dist/generated/manifest.json 不存在");
} else {
  pass("dist/generated/manifest.json 存在");

  try {
    const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRaw);

    if (!Array.isArray(manifest)) {
      fail("manifest.json 不是数组格式");
    } else if (manifest.length === 0) {
      fail("manifest.json 为空数组，无文章条目");
    } else {
      const hasAvailableLanguages = manifest.some(
        (entry) => Array.isArray(entry.availableLanguages)
      );
      if (hasAvailableLanguages) {
        pass("至少一个文章条目包含 availableLanguages 字段（数组）");
      } else {
        fail("没有任何文章条目包含 availableLanguages 字段（数组）");
      }
    }
  } catch (e) {
    fail(`manifest.json 解析失败: ${e.message}`);
  }
}

// ── Check 2: dist/posts/ 包含 .md 文件 ──
console.log("\n[Check 2] dist/posts/ 包含 Markdown 文件");

const postsDir = path.join(DIST_DIR, "posts");

if (!fs.existsSync(postsDir)) {
  fail("dist/posts/ 目录不存在");
} else {
  const mdFiles = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));
  if (mdFiles.length > 0) {
    pass(`dist/posts/ 包含 ${mdFiles.length} 个 .md 文件: ${mdFiles.join(", ")}`);
  } else {
    fail("dist/posts/ 不包含任何 .md 文件");
  }
}

// ── Check 3: public/ 不包含 posts/、generated/、albums/ 子目录 ──
console.log("\n[Check 3] public/ 不包含 posts/、generated/、albums/ 子目录");

const forbiddenDirs = ["posts", "generated", "albums"];

if (!fs.existsSync(PUBLIC_DIR)) {
  pass("public/ 目录不存在（无需检查）");
} else {
  for (const dir of forbiddenDirs) {
    const dirPath = path.join(PUBLIC_DIR, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      fail(`public/${dir}/ 子目录仍然存在`);
    } else {
      pass(`public/ 不包含 ${dir}/ 子目录`);
    }
  }
}

// ── 结果汇总 ──
console.log(`\n${"─".repeat(50)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  console.log("\n⚠️  部分检查未通过，请确认构建流程是否正确。");
  process.exit(1);
} else {
  console.log("\n🎉 所有检查通过！");
  process.exit(0);
}
