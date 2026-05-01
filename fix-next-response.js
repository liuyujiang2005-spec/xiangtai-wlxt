const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./app/api');
let replacedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Restore to original simple `instanceof Response` but without Next.js class prototype issues
    // Just return `NextResponse.json({ message: "Unauthorized" }, { status: 401 })` directly
    // Wait, the better way is to just let the requireAdmin return a NextResponse, and we check if it has a `.status` and `.json`?
    // Actually `auth instanceof Response` is perfectly fine in Next.js 15+ if it's returning NextResponse.
    // The previous error was `auth instanceof NextResponse` failing in production because NextResponse was sometimes polyfilled or minified.

    // Let's replace the whole complex if statement with a simple one:
    // if (auth instanceof Response) { return auth as any; }
    
    // We will find all `if (varName instanceof Response || (varName && typeof varName === 'object' && 'status' in varName))`
    // and replace it with: `if ('status' in (varName as any) && typeof (varName as any).status === 'number') { return varName as any; }`
    
    // But since this is TS, we can't just put `as any` inside JS logic cleanly without risking parser issues.
    
    content = content.replace(/if\s*\(\s*([a-zA-Z0-9_]+)\s*instanceof\s*Response\s*\|\|\s*\(\s*\1\s*&&\s*typeof\s*\1\s*===\s*'object'\s*&&\s*'status'\s*in\s*\1\s*\)\s*\)/g, "if ($1 && typeof $1 === 'object' && 'status' in $1 && 'headers' in $1)");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        replacedCount++;
    }
});

console.log(`Updated ${replacedCount} files with simplified duck typing.`);