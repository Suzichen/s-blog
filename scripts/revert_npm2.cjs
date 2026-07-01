const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. Revert create-spage to create-s-blog in contents
const excludeDirs = ['node_modules', 'target', 'dist', '.git', '.cache', 'artifacts', 'testes'];
const excludeFiles = ['bun.lock', 'Cargo.lock', 'revert_npm2.cjs'];
const excludeExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.wasm', '.node'];

function walkAndReplace(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (excludeDirs.includes(entry.name) && entry.isDirectory()) continue;
        if (excludeFiles.includes(entry.name) && entry.isFile()) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            walkAndReplace(fullPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (excludeExts.includes(ext)) continue;

            let content;
            try {
                content = fs.readFileSync(fullPath, 'utf8');
            } catch (e) {
                continue;
            }
            
            if (content.includes('\u0000')) continue;
            
            let originalContent = content;
            
            // Revert create-spage to create-s-blog
            content = content.replace(/create-spage/g, 'create-s-blog');
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Reverted create-spage in ${fullPath}`);
            }
        }
    }
}

walkAndReplace(rootDir);

// 2. Update README notices to be subtle
const readmes = {
    'README.md': [
        `> **IMPORTANT NOTICE:** This repository has been migrated and renamed to **Spage**. We will no longer update under the old \`s-blog\` name. Please use \`spage\` for future references.\n\n`,
        `> *Note: This is the original s-blog project, which has now been migrated and renamed to Spage.*\n\n`
    ],
    'README.zh-CN.md': [
        `> **重要提示：** 本仓库已迁移并更名为 **Spage**。我们将不再在旧的 \`s-blog\` 名称下发布更新。请在后续使用 \`spage\`。\n\n`,
        `> *注：此项目原名为 s-blog，现已全面迁移并更名为 Spage。*\n\n`
    ],
    'README.ja-JP.md': [
        `> **重要なお知らせ：** このリポジトリは **Spage** に移行され、名前が変更されました。古い \`s-blog\` という名前での更新は行われません。今後は \`spage\` を使用してください。\n\n`,
        `> *注：このプロジェクトは元々 s-blog という名前でしたが、現在は Spage に移行し、名前が変更されました。*\n\n`
    ]
};

// Also apply the english notice to the npm readmes
const npmReadmes = [
    'packages/core/README.md',
    'packages/create-spage/README.md',
    'crates/spage-engine-napi/README.md'
];

const npmDir = path.join(rootDir, 'crates/spage-engine-napi/npm');
if (fs.existsSync(npmDir)) {
    const platforms = fs.readdirSync(npmDir);
    for (const p of platforms) {
        if (fs.statSync(path.join(npmDir, p)).isDirectory()) {
            npmReadmes.push(`crates/spage-engine-napi/npm/${p}/README.md`);
        }
    }
}

for (const npmReadme of npmReadmes) {
    readmes[npmReadme] = readmes['README.md'];
}

for (const [file, [oldText, newText]] of Object.entries(readmes)) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(oldText)) {
            content = content.replace(oldText, newText);
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated notice in ${file}`);
        } else if (!content.includes(newText.trim())) {
            // Just in case it wasn't added or was modified, append it to the top
            content = newText + content;
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Added notice to ${file}`);
        }
    }
}
