const fs = require('fs');
const path = require('path');

const notices = {
    'README.md': `> **IMPORTANT NOTICE:** This repository has been migrated and renamed to **Spage**. We will no longer update under the old \`s-blog\` name. Please use \`spage\` for future references.\n\n`,
    'README.zh-CN.md': `> **重要提示：** 本仓库已迁移并更名为 **Spage**。我们将不再在旧的 \`s-blog\` 名称下发布更新。请在后续使用 \`spage\`。\n\n`,
    'README.ja-JP.md': `> **重要なお知らせ：** このリポジトリは **Spage** に移行され、名前が変更されました。古い \`s-blog\` という名前での更新は行われません。今後は \`spage\` を使用してください。\n\n`
};

for (const [file, notice] of Object.entries(notices)) {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes('**IMPORTANT NOTICE:**') && !content.includes('**重要提示：**') && !content.includes('**重要なお知らせ：**')) {
            content = notice + content;
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    }
}
