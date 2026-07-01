const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. Fix Suzic's Blog URLs
const filesToFixURLs = [
    'README.md',
    'README.zh-CN.md',
    'README.ja-JP.md',
    'config.json',
    'album.config.json'
];

for (const file of filesToFixURLs) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let originalContent = content;
        
        content = content.replace(/spage\.suzichen\.me/g, 's-blog.suzichen.me');
        content = content.replace(/img\.spage\.me/g, 'img.s-blog.me');
        
        if (content !== originalContent) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Reverted URLs in ${file}`);
        }
    }
}

// 2. Add notice to NPM package READMEs
const notice = `> **IMPORTANT NOTICE:** This repository has been migrated and renamed to **Spage**. We will no longer update under the old \`s-blog\` name. Please use \`spage\` for future references.\n\n`;

const npmReadmes = [
    'packages/core/README.md',
    'packages/create-s-blog/README.md',
    'crates/spage-engine-napi/README.md'
];

// Add the platform specific ones too
const npmDir = path.join(rootDir, 'crates/spage-engine-napi/npm');
if (fs.existsSync(npmDir)) {
    const platforms = fs.readdirSync(npmDir);
    for (const p of platforms) {
        if (fs.statSync(path.join(npmDir, p)).isDirectory()) {
            npmReadmes.push(`crates/spage-engine-napi/npm/${p}/README.md`);
        }
    }
}

for (const file of npmReadmes) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes('**IMPORTANT NOTICE:**')) {
            content = notice + content;
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Added notice to ${file}`);
        }
    }
}
