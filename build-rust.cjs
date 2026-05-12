/**
 * 临时的Rust完整构建脚本 — 使用 @s-blog/engine (Rust) 替代所有 TS 脚本
 *
 * 等价于: build:shell + build:posts + build:albums + build:public + build:seo
 * 用法: node build-rust.cjs          (production build)
 *        node build-rust.cjs --dev    (dev mode: generate data into public/ only)
 */
const fs = require("fs");
const path = require("path");
const engine = require("@s-blog/engine");

const isDev = process.argv.includes("--dev");

const CWD = process.cwd();
const DIST_DIR = path.join(CWD, "dist");
const PUBLIC_DIR = path.join(CWD, "public");

const EXCLUDE = [".DS_Store", "Thumbs.db", ".gitkeep", ".git"];

function copyDir(src, dest) {
    let count = 0;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (EXCLUDE.includes(entry.name)) continue;
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            count += copyDir(s, d);
        } else {
            fs.copyFileSync(s, d);
            count++;
        }
    }
    return count;
}

// ── Dev mode: generate manifest + albums data into public/ ──
if (isDev) {
    console.log("🚀 Dev mode: generating data into public/\n");

    const configRaw = fs.readFileSync(path.join(CWD, "config.json"), "utf-8");
    const albumConfigRaw = fs.readFileSync(
        path.join(CWD, "album.config.json"),
        "utf-8",
    );

    // Generate posts manifest → public/generated/manifest.json (+ copies .md to public/posts/)
    console.log("[1/2] generatePostsData → public/");
    const postsResult = engine.generatePostsData("posts", "public", configRaw);
    const manifest = JSON.parse(postsResult);
    console.log(`  ✅ ${manifest.length} 篇文章\n`);

    // Generate albums data → public/generated/
    console.log("[2/2] generateAlbumsData → public/");
    engine.generateAlbumsData("albums", "public", albumConfigRaw, configRaw);
    console.log("  ✅ 相册数据\n");

    console.log("✨ Dev data ready — start Vite to serve the app");
    process.exit(0);
}

// ── Production build ──

// ── Step 0: 清理 dist ──
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });
console.log("🧹 已清理 dist/\n");

// ── Step 1: 复制 App Shell ──
console.log("[1/6] 复制 App Shell");
const shellDir = path.join(
    CWD,
    "node_modules",
    "@s-blog",
    "core",
    "dist",
    "shell",
);
if (!fs.existsSync(shellDir)) {
    console.error(
        "❌ 找不到 @s-blog/core/dist/shell，请确认 @s-blog/core 已安装",
    );
    process.exit(1);
}
const shellCount = copyDir(shellDir, DIST_DIR);

// 修复 index.html 中的相对路径为绝对路径
const configRaw = fs.readFileSync(path.join(CWD, "config.json"), "utf-8");
const configObj = JSON.parse(configRaw);
let basePath = configObj.basePath || "/";
if (basePath === "/") basePath = "";
else {
    basePath = basePath.replace(/\/+$/, "");
    if (!basePath.startsWith("/")) basePath = "/" + basePath;
}

const indexHtml = path.join(DIST_DIR, "index.html");
if (fs.existsSync(indexHtml)) {
    let html = fs.readFileSync(indexHtml, "utf-8");
    html = html.replace(/href="\.\/assets\//g, `href="${basePath}/assets/`);
    html = html.replace(/src="\.\/assets\//g, `src="${basePath}/assets/`);
    html = html.replace(/href="\.\/favicon/g, `href="${basePath}/favicon`);
    html = html.replace(/src="\.\/favicon/g, `src="${basePath}/favicon`);
    fs.writeFileSync(indexHtml, html, "utf-8");
}
console.log(`  ✅ ${shellCount} 个文件\n`);

// ── Step 2: Rust 引擎 — 生成文章数据 ──
console.log("[2/6] generatePostsData");
const albumConfigRaw = fs.readFileSync(
    path.join(CWD, "album.config.json"),
    "utf-8",
);
const postsResult = engine.generatePostsData("posts", "dist", configRaw);
const manifest = JSON.parse(postsResult);
console.log(`  ✅ ${manifest.length} 篇文章\n`);

// ── Step 3: Rust 引擎 — 生成相册数据 ──
console.log("[3/6] generateAlbumsData");
engine.generateAlbumsData("albums", "dist", albumConfigRaw, configRaw);
console.log("  ✅ 相册数据\n");

// ── Step 4: Rust 引擎 — 生成 SEO + Sitemap + RSS + Robots ──
console.log("[4/6] generateSeoPages + Sitemap + RSS + Robots");
const templatePath = path.join(shellDir, "index.html");
const seoCount = engine.generateSeoPages(
    postsResult,
    templatePath,
    "dist",
    configRaw,
);
engine.generateSitemap(postsResult, "dist/sitemap.xml", configRaw);
engine.generateRss(postsResult, "dist/rss.xml", configRaw);
engine.generateRobots("dist/robots.txt", configRaw);
console.log(`  ✅ ${seoCount} 个 SEO 页面 + sitemap + rss + robots\n`);

// ── Step 5: 复制 public/ 静态资源 ──
console.log("[5/6] 复制静态资源");
let pubTotal = 0;
// 复制项目根目录 albums/ 原图到 dist/albums/（Rust 引擎已处理 posts，albums 仍需复制原图）
for (const dir of ["albums"]) {
    const src = path.join(CWD, dir);
    if (fs.existsSync(src)) {
        const c = copyDir(src, path.join(DIST_DIR, dir));
        pubTotal += c;
        console.log(`  ${dir}/: ${c} 文件`);
    }
}
// public/ 根目录文件
if (fs.existsSync(PUBLIC_DIR)) {
    for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory() && !EXCLUDE.includes(entry.name)) {
            fs.copyFileSync(
                path.join(PUBLIC_DIR, entry.name),
                path.join(DIST_DIR, entry.name),
            );
            pubTotal++;
        }
    }
}
console.log(`  ✅ 共 ${pubTotal} 个文件\n`);

// ── Step 6: 复制配置文件 ──
console.log("[6/6] 复制配置文件");
for (const f of ["config.json", "album.config.json"]) {
    const src = path.join(CWD, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(DIST_DIR, f));
        console.log(`  ${f}`);
    }
}

console.log("\n🎉 构建完成！dist/ 已就绪");
