// Audit helper for the "text field loses focus / hangs after one word" bug.
//
// Root-cause pattern: a component (PascalCase function) declared INSIDE
// another component's body and rendered as <Name/>. Every parent render
// creates a new function identity, so React unmounts + remounts that
// subtree and any focused <input>/<textarea> inside it loses focus.
//
// Uses @babel/parser + @babel/traverse (already present via Vite's React
// plugin — no new dependency).
//   node scripts/find-inline-components.cjs [srcDir]
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = process.argv[2] || path.join(__dirname, '..', 'src');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f)) files.push(p);
  }
})(root);

const isPascal = (n) => /^[A-Z]/.test(n || '');
const isFn = (n) => n && (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration');

const out = [];
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { console.error('parse', file, e.message); continue; }
  const found = [];
  traverse(ast, {
    'VariableDeclarator|FunctionDeclaration'(p) {
      const node = p.node;
      const name = node.type === 'FunctionDeclaration' ? node.id && node.id.name : node.id && node.id.name;
      if (!isPascal(name)) return;
      const fn = node.type === 'FunctionDeclaration' ? node : node.init;
      if (!isFn(fn)) return;
      // Nested inside another function that is itself a component (PascalCase)?
      const parentFn = p.getFunctionParent();
      if (!parentFn) return;
      let owner = parentFn;
      let ownerName = null;
      while (owner) {
        const n = owner.node;
        const nm = n.id ? n.id.name : (owner.parentPath && owner.parentPath.node.type === 'VariableDeclarator' ? owner.parentPath.node.id.name : null);
        if (isPascal(nm)) { ownerName = nm; break; }
        owner = owner.getFunctionParent();
      }
      if (!ownerName) return;
      // Is it rendered as JSX <Name .../> inside the owner?
      let rendered = false;
      let hasField = false;
      owner.traverse({
        JSXOpeningElement(q) { if (q.node.name.type === 'JSXIdentifier' && q.node.name.name === name) rendered = true; },
      });
      if (!rendered) return;
      p.traverse({
        JSXOpeningElement(q) { const n = q.node.name.name; if (/^(input|textarea|select)$/.test(n) || /Input|Field|TextArea|Textarea|Select/.test(n || '')) hasField = true; },
      });
      found.push({ name, owner: ownerName, line: node.loc.start.line, hasField });
    },
  });
  for (const f of found) out.push({ file: path.relative(root, file), ...f });
}

out.sort((a, b) => (b.hasField - a.hasField) || a.file.localeCompare(b.file) || a.line - b.line);
for (const r of out) console.log(`${r.hasField ? 'FIELD' : '     '}  ${r.file}:${r.line}  <${r.name}> inside <${r.owner}>`);
console.log(`\n${out.length} nested component(s) rendered as JSX; ${out.filter((r) => r.hasField).length} contain form fields`);
