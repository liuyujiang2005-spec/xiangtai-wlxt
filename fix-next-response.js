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

    // This regex looks for `if (varName instanceof Response || ...) { return varName; }`
    // and changes it to `if (...) { return varName as any; }`
    content = content.replace(/(if\s*\(\s*([a-zA-Z0-9_]+)\s*instanceof\s*Response\s*\|\|\s*\(\s*\2\s*&&\s*typeof\s*\2\s*===\s*'object'\s*&&\s*'status'\s*in\s*\2\s*\)\s*\)\s*\{\s*return\s+)\2(\s*;?\s*\})/g, "$1$2 as any$3");

    // Also handle single line without braces: `if (...) return varName;`
    content = content.replace(/(if\s*\(\s*([a-zA-Z0-9_]+)\s*instanceof\s*Response\s*\|\|\s*\(\s*\2\s*&&\s*typeof\s*\2\s*===\s*'object'\s*&&\s*'status'\s*in\s*\2\s*\)\s*\)\s*return\s+)\2(\s*;)/g, "$1$2 as any$3");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        replacedCount++;
    }
});

console.log(`Updated ${replacedCount} files with 'as any'.`);