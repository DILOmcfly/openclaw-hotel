#!/usr/bin/env node
/**
 * Audit Imports - Detect broken imports and dead code
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, '../src');

const issues = {
  brokenImports: [],
  deadCode: [],
  unusedExports: []
};

/**
 * Find all TypeScript files
 */
function findTsFiles(dir, files = []) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && entry !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Extract import statements from file
 */
function extractImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const imports = [];
  
  // Match: import ... from 'path' or import ... from "path"
  const importRegex = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      statement: match[0],
      path: match[1]
    });
  }
  
  return imports;
}

/**
 * Resolve import path to actual file
 */
function resolveImport(importPath, fromFile) {
  if (importPath.startsWith('.')) {
    // Relative import
    const baseDir = dirname(fromFile);
    let resolvedPath = resolve(baseDir, importPath);
    
    // Try with extensions
    const extensions = ['', '.ts', '.js', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const testPath = resolvedPath + ext;
      if (existsSync(testPath)) {
        return testPath;
      }
    }
    
    return null; // Not found
  }
  
  // External module (node_modules) - assume valid
  return 'external';
}

/**
 * Check if a file is referenced anywhere
 */
function isFileReferenced(filePath, allFiles) {
  const relativePath = filePath.replace(SRC_DIR + '/', '');
  let referenceCount = 0;
  
  for (const file of allFiles) {
    if (file === filePath) continue;
    
    const imports = extractImports(file);
    for (const imp of imports) {
      const resolved = resolveImport(imp.path, file);
      if (resolved === filePath) {
        referenceCount++;
      }
    }
  }
  
  return referenceCount > 0;
}

/**
 * Main audit
 */
function auditImports() {
  console.log('🔍 Auditing imports in src/...\n');
  
  const files = findTsFiles(SRC_DIR);
  console.log(`Found ${files.length} TypeScript files\n`);
  
  // Check for broken imports
  let brokenCount = 0;
  for (const file of files) {
    const imports = extractImports(file);
    
    for (const imp of imports) {
      const resolved = resolveImport(imp.path, file);
      
      if (resolved === null) {
        issues.brokenImports.push({
          file: file.replace(SRC_DIR + '/', ''),
          import: imp.statement,
          path: imp.path
        });
        brokenCount++;
      }
    }
  }
  
  // Check for dead code (files never imported)
  const entryPoints = ['server.ts', 'db/index.ts', 'db/migrate.ts', 'db/seed.ts'];
  let deadCount = 0;
  
  for (const file of files) {
    const relativePath = file.replace(SRC_DIR + '/', '');
    
    // Skip entry points and tests
    if (entryPoints.some(ep => relativePath.endsWith(ep))) continue;
    
    if (!isFileReferenced(file, files)) {
      issues.deadCode.push(relativePath);
      deadCount++;
    }
  }
  
  // Report
  console.log('📊 AUDIT RESULTS:\n');
  
  if (brokenCount === 0) {
    console.log('✅ No broken imports found!');
  } else {
    console.log(`❌ Found ${brokenCount} broken imports:\n`);
    issues.brokenImports.forEach(({ file, import: stmt, path }) => {
      console.log(`  ${file}:`);
      console.log(`    ${stmt}`);
      console.log(`    → Path not found: ${path}\n`);
    });
  }
  
  console.log('');
  
  if (deadCount === 0) {
    console.log('✅ No dead code files found!');
  } else {
    console.log(`⚠️  Found ${deadCount} potentially unused files:\n`);
    issues.deadCode.forEach(file => {
      console.log(`  - ${file}`);
    });
    console.log('\n  Note: These files are not imported anywhere. Verify they are truly unused before deleting.');
  }
  
  console.log('\n');
  console.log(`🎯 Summary: ${brokenCount} broken imports, ${deadCount} unused files`);
  
  return brokenCount === 0 && deadCount === 0;
}

// Run audit
const success = auditImports();
process.exit(success ? 0 : 1);
