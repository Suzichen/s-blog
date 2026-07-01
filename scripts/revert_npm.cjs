const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', 'target', 'dist', '.git', '.cache', 'artifacts', 'testes'];
const excludeFiles = ['bun.lock', 'Cargo.lock', 'revert_npm.cjs'];
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
            
            // Revert @spage/ to @s-blog/
            content = content.replace(/@spage\//g, '@s-blog/');
            
            // Revert titles
            // In config.json: "title": "spage" -> "title": "Spage"
            // Let's do a smart replace for title
            if (entry.name === 'config.json' || entry.name.includes('config.schema.json')) {
                content = content.replace(/"title":\s*"spage"/g, '"title": "Spage"');
            }

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated content: ${fullPath}`);
            }
        }
    }
}

const rootDir = path.join(__dirname, '..');
walkAndReplace(rootDir);

// 2. Add old commands to bin
const engineNapiPkgPath = path.join(rootDir, 'crates/spage-engine-napi/package.json');
if (fs.existsSync(engineNapiPkgPath)) {
    let pkg = JSON.parse(fs.readFileSync(engineNapiPkgPath, 'utf8'));
    if (pkg.bin) {
        // preserve both spage and s-blog
        pkg.bin["spage"] = pkg.bin["spage"] || pkg.bin["s-blog"];
        pkg.bin["s-blog"] = pkg.bin["spage"];
        fs.writeFileSync(engineNapiPkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        console.log('Added s-blog bin to spage-engine-napi');
    }
}

const createPkgPath = path.join(rootDir, 'packages/create-s-blog/package.json');
if (fs.existsSync(createPkgPath)) {
    let pkg = JSON.parse(fs.readFileSync(createPkgPath, 'utf8'));
    if (pkg.bin) {
        pkg.bin["create-s-blog"] = pkg.bin["create-s-blog"] || pkg.bin["create-s-blog"];
        pkg.bin["create-s-blog"] = pkg.bin["create-s-blog"];
        fs.writeFileSync(createPkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        console.log('Added create-s-blog bin to create-s-blog');
    }
}

// Scaffold templates config title update
const scaffoldSrcPath = path.join(rootDir, 'crates/spage-scaffold/src/lib.rs');
if (fs.existsSync(scaffoldSrcPath)) {
    let content = fs.readFileSync(scaffoldSrcPath, 'utf8');
    content = content.replace(/"Spage"/g, '"Spage"'); // Already done if it was Spage, but let's ensure it's "Spage"
    content = content.replace(/"spage"/g, '"Spage"'); // replace any generated lowercases for title
    fs.writeFileSync(scaffoldSrcPath, content, 'utf8');
}
