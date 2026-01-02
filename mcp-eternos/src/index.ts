#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";
import fg from "fast-glob";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { marked } from "marked";
import yaml from "js-yaml";
import chokidar from "chokidar";
import { exec } from "child_process";
import sqlite3 from "sqlite3";
import jsonpath from "jsonpath";
import Papa from "papaparse";
import { parseStringPromise, Builder } from "xml2js";

// Sharp will be loaded dynamically at runtime if needed
let sharpModule: any = null;




// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

// Web & API Tools
const FetchUrlInputSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().default(10000),
});

const ScrapeWebpageInputSchema = z.object({
  url: z.string().url(),
  selectors: z.record(z.string()),
  extract: z.enum(["text", "html", "attr"]).default("text"),
  attribute: z.string().optional(),
});

async function fetchUrl(args: any) {
  const { url, method, headers, body, timeout } = FetchUrlInputSchema.parse(args);
  
  try {
    const response = await axios({
      url,
      method,
      headers,
      data: body,
      timeout,
      validateStatus: () => true, // Don't throw on any status
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      contentType: response.headers["content-type"],
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
}

async function scrapeWebpage(args: any) {
  const { url, selectors, extract, attribute } = ScrapeWebpageInputSchema.parse(args);
  
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const results: any = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      const elements = $(selector as string);
      const values: any[] = [];
      
      elements.each((_: number, el: any) => {
        if (extract === "text") {
          values.push($(el).text().trim());
        } else if (extract === "html") {
          values.push($(el).html());
        } else if (extract === "attr" && attribute) {
          values.push($(el).attr(attribute));
        }
      });
      
      results[key] = values.length === 1 ? values[0] : values;
    }
    
    return results;
  } catch (error: any) {
    throw new Error(`Failed to scrape webpage: ${error.message}`);
  }
}



// File System Tools
const SearchFilesInputSchema = z.object({
  pattern: z.string(),
  cwd: z.string().default("."),
  ignore: z.array(z.string()).optional(),
  maxDepth: z.number().optional(),
});

async function searchFiles(args: any) {
  const { pattern, cwd, ignore, maxDepth } = SearchFilesInputSchema.parse(args);
  
  try {
    const files = await fg(pattern, {
      cwd,
      ignore: ["node_modules/**", ".git/**", ...(ignore || [])],
      deep: maxDepth,
      absolute: false,
    });
    
    return files;
  } catch (error: any) {
    throw new Error(`Failed to search files: ${error.message}`);
  }
}

const ReadFileContentInputSchema = z.object({
  filePath: z.string(),
  encoding: z.string().default("utf-8"),
  parse: z.boolean().default(true),
});

async function readFileContent(args: any) {
  const { filePath, encoding, parse } = ReadFileContentInputSchema.parse(args);
  
  try {
    const content = await fs.readFile(filePath, encoding as BufferEncoding);
    const contentStr = content.toString();
    
    if (parse) {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === ".json") {
        return { type: "json", data: JSON.parse(contentStr) };
      } else if (ext === ".yaml" || ext === ".yml") {
        return { type: "yaml", data: yaml.load(contentStr) };
      } else if (ext === ".md" || ext === ".markdown") {
        return { type: "markdown", raw: contentStr, html: marked(contentStr) };
      }
    }
    
    return { type: "text", content: contentStr };
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

const WriteFileContentInputSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  createDirs: z.boolean().default(true),
  backup: z.boolean().default(false),
});

async function writeFileContent(args: any) {
  const { filePath, content, createDirs, backup } = WriteFileContentInputSchema.parse(args);
  
  try {
    if (createDirs) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }
    
    if (backup) {
      try {
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        if (exists) {
          await fs.copyFile(filePath, `${filePath}.backup`);
        }
      } catch (e) {
        // Ignore backup errors
      }
    }
    
    await fs.writeFile(filePath, content, "utf-8");
    return { success: true, path: filePath };
  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

const WatchDirectoryInputSchema = z.object({
  directory: z.string(),
  pattern: z.string().optional(),
  events: z.array(z.enum(["add", "change", "unlink"])).default(["add", "change"]),
});

async function watchDirectory(args: any) {
  const { directory, pattern, events } = WatchDirectoryInputSchema.parse(args);

  return new Promise((resolve, reject) => {
    const watcher = chokidar.watch(pattern ? path.join(directory, pattern) : directory, {
      ignored: /[\/\\]./,
      persistent: true,
      ignoreInitial: true,
    });

    const onEvent = (event: string) => (path: string) => {
      if (events.includes(event as "add" | "change" | "unlink")) {
        watcher.close();
        resolve({ event, path });
      }
    };

    watcher
      .on('add', onEvent('add'))
      .on('change', onEvent('change'))
      .on('unlink', onEvent('unlink'))
      .on('error', (err: unknown) => {
        watcher.close();
        const message = err instanceof Error ? err.message : String(err);
        reject(new Error(`Watcher error: ${message}`));
      });
  });
}

// Data Processing Tools
const ProcessJsonInputSchema = z.object({
  data: z.string(),
  operation: z.enum(["query", "transform", "validate", "merge", "diff"]),
  query: z.string().optional(),
  schema: z.any().optional(),
});

async function processJson(args: any) {
  const { data, operation, query, schema } = ProcessJsonInputSchema.parse(args);

  try {
    let jsonData: any;

    // Try to parse as JSON or read from file
    try {
      jsonData = JSON.parse(data);
    } catch {
      const content = await fs.readFile(data, "utf-8");
      jsonData = JSON.parse(content);
    }

    switch (operation) {
      case "query":
        if (!query) throw new Error("Query is required for query operation");
        return { result: jsonpath.query(jsonData, query) };

      case "validate":
        // Basic validation (would need a proper JSON schema validator)
        return { valid: true, data: jsonData };

      default:
        return jsonData;
    }
  } catch (error: any) {
    throw new Error(`Failed to process JSON: ${error.message}`);
  }
}
const ConvertFormatInputSchema = z.object({
  input: z.string(),
  from: z.enum(["json", "yaml", "csv", "xml", "markdown"]),
  to: z.enum(["json", "yaml", "csv", "xml", "markdown", "html"]),
});

async function convertFormat(args: any) {
  const { input, from, to } = ConvertFormatInputSchema.parse(args);

  try {
    let data: any;

    // Parse input based on source format
    if (from === "json") {
      data = JSON.parse(input);
    } else if (from === "yaml") {
      data = yaml.load(input);
    } else if (from === "markdown") {
      data = { html: marked(input), raw: input };
    } else if (from === "csv") {
      data = Papa.parse(input, { header: true }).data;
    } else if (from === "xml") {
      data = await parseStringPromise(input);
    }

    // Convert to target format
    if (to === "json") {
      return JSON.stringify(data, null, 2);
    } else if (to === "yaml") {
      return yaml.dump(data);
    } else if (to === "html" && from === "markdown") {
      return marked(input);
    } else if (to === "csv") {
      return Papa.unparse(data);
    } else if (to === "xml") {
      const builder = new Builder();
      return builder.buildObject(data);
    }

    return data;
  } catch (error: any) {
    throw new Error(`Failed to convert format: ${error.message}`);
  }
}

// Security & Crypto Tools
const HashDataInputSchema = z.object({
  data: z.string(),
  algorithm: z.enum(["md5", "sha1", "sha256", "sha512", "sha3-256", "sha3-512"]).default("sha256"),
  encoding: z.enum(["hex", "base64", "base64url"]).default("hex"),
});

async function hashData(args: any) {
  const { data, algorithm, encoding } = HashDataInputSchema.parse(args);
  
  try {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    
    if (encoding === "base64url") {
      return hash.digest("base64url");
    }
    return hash.digest(encoding as any);
  } catch (error: any) {
    throw new Error(`Failed to hash data: ${error.message}`);
  }
}

const EncryptDecryptInputSchema = z.object({
  data: z.any(),
  password: z.string(),
  operation: z.enum(["encrypt", "decrypt"]),
});

async function encryptDecrypt(args: any) {
  const { data, password, operation } = EncryptDecryptInputSchema.parse(args);

  try {
    if (operation === "encrypt") {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(password, "salt", 32) as Buffer;
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      let encrypted = cipher.update(data, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
      };
    } else {
      const { encrypted, iv: ivHex, authTag: authTagHex } = data;
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const key = crypto.scryptSync(password, "salt", 32) as Buffer;
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return { decrypted };
    }
  } catch (error: any) {
    throw new Error(`Failed to encrypt/decrypt: ${error.message}`);
  }
}

// Developer Utilities
const GenerateCodeInputSchema = z.object({
  type: z.enum(["uuid", "jwt", "api-key", "password", "lorem", "mock-data"]),
  count: z.number().default(1),
  options: z.any().optional(),
});

async function generateCode(args: any) {
  const { type, count, options } = GenerateCodeInputSchema.parse(args);
  
  const results: any[] = [];
  
  for (let i = 0; i < count; i++) {
    switch (type) {
      case "uuid":
        results.push(crypto.randomUUID());
        break;
      
      case "api-key":
        results.push(crypto.randomBytes(32).toString("hex"));
        break;
      
      case "password":
        const length = options?.length || 16;
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let password = "";
        for (let j = 0; j < length; j++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        results.push(password);
        break;
      
      case "lorem":
        results.push("Lorem ipsum dolor sit amet, consectetur adipiscing elit.");
        break;
      
      default:
        results.push(null);
    }
  }
  
  return count === 1 ? results[0] : results;
}

const AnalyzeCodeInputSchema = z.object({
  code: z.string(),
  language: z.enum(["javascript", "typescript", "python", "go", "rust"]),
  analysis: z.array(z.enum(["imports", "exports", "functions", "classes", "complexity"])),
});

async function analyzeCode(args: any) {
  const { code, language, analysis } = AnalyzeCodeInputSchema.parse(args);

  let source = '';
  try {
    await fs.access(code);
    source = await fs.readFile(code, 'utf-8');
  } catch {
    source = code;
  }

  if (language !== 'javascript' && language !== 'typescript') {
    throw new Error(`Code analysis for ${language} is not yet implemented.`);
  }

  const results: any = {};

  if (analysis.includes('imports')) {
    const importRegex = /import(?:["'\s]*([\w*{}\n\r\t, ]+)from\s*)?["'\s]*([@\w/\\.\-]+)["'\s]*/g;
    results.imports = [...source.matchAll(importRegex)].map(m => m[0]);
  }

  if (analysis.includes('exports')) {
    const exportRegex = /export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/g;
    results.exports = [...source.matchAll(exportRegex)].map(m => m[1]);
  }

  if (analysis.includes('functions')) {
    const functionRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
    results.functions = [...source.matchAll(functionRegex)].map(m => m[1]);
  }

  if (analysis.includes('classes')) {
    const classRegex = /class\s+(\w+)/g;
    results.classes = [...source.matchAll(classRegex)].map(m => m[1]);
  }

  if (analysis.includes('complexity')) {
    results.complexity = {
      lineCount: source.split('\n').length,
    };
  }

  return results;
}

// System Tools
const GetSystemInfoInputSchema = z.object({
  info: z.array(z.enum(["os", "cpu", "memory", "disk", "network", "process"])).default(["os", "cpu", "memory"]),
});

async function getSystemInfo(args: any) {
  const { info } = GetSystemInfoInputSchema.parse(args);
  
  const os = await import("os");
  const result: any = {};
  
  for (const type of info) {
    switch (type) {
      case "os":
        result.os = {
          platform: os.platform(),
          type: os.type(),
          release: os.release(),
          arch: os.arch(),
          hostname: os.hostname(),
        };
        break;
      
      case "cpu":
        result.cpu = {
          model: os.cpus()[0]?.model,
          cores: os.cpus().length,
          speed: os.cpus()[0]?.speed,
        };
        break;
      
      case "memory":
        result.memory = {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
        };
        break;
    }
  }
  
  return result;
}

const ExecuteCommandInputSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  timeout: z.number().default(30000),
  env: z.record(z.string()).optional(),
});

async function executeCommand(args: any) {
  const { command, cwd, timeout, env } = ExecuteCommandInputSchema.parse(args);

  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout, env }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const QuerySqliteInputSchema = z.object({
  database: z.string(),
  query: z.string(),
  params: z.array(z.any()).optional(),
});

async function querySqlite(args: any) {
  const { database, query, params } = QuerySqliteInputSchema.parse(args);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(database, (err) => {
      if (err) {
        reject(err);
      }
    });

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
      db.close();
    });
  });
}

// Time Operations
const TimeOperationsInputSchema = z.object({
  operation: z.enum(["now", "parse", "format", "add", "subtract", "diff", "convert-timezone"]),
  input: z.string().optional(),
  timezone: z.string().optional(),
  format: z.string().optional(),
  amount: z.number().optional(),
  unit: z.enum(["seconds", "minutes", "hours", "days", "weeks", "months", "years"]).optional(),
});

const GitCloneInputSchema = z.object({
  repoUrl: z.string().url(),
  directory: z.string().optional(),
});

const GitStatusInputSchema = z.object({
  directory: z.string(),
});

const GitAddInputSchema = z.object({
  directory: z.string(),
  files: z.array(z.string()).optional(),
});

const GitCommitInputSchema = z.object({
  directory: z.string(),
  message: z.string(),
});

const GitDiffInputSchema = z.object({
  directory: z.string(),
});

async function timeOperations(args: any) {
  const { operation, input, timezone, format, amount, unit } = TimeOperationsInputSchema.parse(args);

  const now = new Date();

  switch (operation) {
    case "now":
      if (timezone) {
        return now.toLocaleString("en-US", { timeZone: timezone });
      }
      return now.toISOString();

    case "parse":
      if (!input) throw new Error("Input is required for parse operation");
      return new Date(input).toISOString();

    case "format":
      const date = input ? new Date(input) : now;
      if (timezone) {
        return date.toLocaleString("en-US", { timeZone: timezone });
      }
      return date.toISOString();

    default:
      return now.toISOString();
  }
}

async function gitClone(args: any) {
  const { repoUrl, directory } = GitCloneInputSchema.parse(args);
  const command = `git clone ${repoUrl}` + (directory ? ` ${directory}` : "");
  return await executeCommand({ command });
}

async function gitStatus(args: any) {
  const { directory } = GitStatusInputSchema.parse(args);
  return await executeCommand({ command: "git status", cwd: directory });
}

async function gitAdd(args: any) {
  const { directory, files } = GitAddInputSchema.parse(args);
  const filesToAdd = files ? files.join(" ") : ".";
  return await executeCommand({ command: `git add ${filesToAdd}`, cwd: directory });
}

async function gitCommit(args: any) {
  const { directory, message } = GitCommitInputSchema.parse(args);
  return await executeCommand({ command: `git commit -m "${message}"`, cwd: directory });
}

async function gitDiff(args: any) {
  const { directory } = GitDiffInputSchema.parse(args);
  return await executeCommand({ command: "git diff", cwd: directory });
}

// ============================================================================
// ADVANCED FEATURES - Git Extensions
// ============================================================================

const GitLogInputSchema = z.object({
  directory: z.string(),
  limit: z.number().default(10),
  format: z.enum(["oneline", "short", "medium", "full", "raw"]).default("medium"),
});

const GitBranchInputSchema = z.object({
  directory: z.string(),
  action: z.enum(["list", "create", "delete", "switch"]).default("list"),
  branchName: z.string().optional(),
});

const GitPushInputSchema = z.object({
  directory: z.string(),
  remote: z.string().default("origin"),
  branch: z.string().optional(),
  force: z.boolean().default(false),
});

const GitPullInputSchema = z.object({
  directory: z.string(),
  remote: z.string().default("origin"),
  branch: z.string().optional(),
});

async function gitLog(args: any) {
  const { directory, limit, format } = GitLogInputSchema.parse(args);
  const formatMap: any = {
    oneline: "--oneline",
    short: "--pretty=short",
    medium: "--pretty=medium",
    full: "--pretty=full",
    raw: "--pretty=raw",
  };
  return await executeCommand({ 
    command: `git log ${formatMap[format]} -n ${limit}`, 
    cwd: directory 
  });
}

async function gitBranch(args: any) {
  const { directory, action, branchName } = GitBranchInputSchema.parse(args);
  
  switch (action) {
    case "list":
      return await executeCommand({ command: "git branch -a", cwd: directory });
    case "create":
      if (!branchName) throw new Error("Branch name required for create");
      return await executeCommand({ command: `git branch ${branchName}`, cwd: directory });
    case "delete":
      if (!branchName) throw new Error("Branch name required for delete");
      return await executeCommand({ command: `git branch -d ${branchName}`, cwd: directory });
    case "switch":
      if (!branchName) throw new Error("Branch name required for switch");
      return await executeCommand({ command: `git checkout ${branchName}`, cwd: directory });
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function gitPush(args: any) {
  const { directory, remote, branch, force } = GitPushInputSchema.parse(args);
  const forceFlag = force ? " --force" : "";
  const branchArg = branch ? ` ${branch}` : "";
  return await executeCommand({ 
    command: `git push${forceFlag} ${remote}${branchArg}`, 
    cwd: directory 
  });
}

async function gitPull(args: any) {
  const { directory, remote, branch } = GitPullInputSchema.parse(args);
  const branchArg = branch ? ` ${branch}` : "";
  return await executeCommand({ 
    command: `git pull ${remote}${branchArg}`, 
    cwd: directory 
  });
}

// ============================================================================
// ADVANCED FEATURES - Batch Operations
// ============================================================================

const BatchReadFilesInputSchema = z.object({
  patterns: z.array(z.string()),
  cwd: z.string().default("."),
  maxFiles: z.number().default(100),
});

const BatchProcessInputSchema = z.object({
  operation: z.enum(["rename", "move", "delete", "copy"]),
  files: z.array(z.string()),
  destination: z.string().optional(),
  pattern: z.string().optional(),
  replacement: z.string().optional(),
});

async function batchReadFiles(args: any) {
  const { patterns, cwd, maxFiles } = BatchReadFilesInputSchema.parse(args);
  
  try {
    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await fg(pattern, { cwd, ignore: ["node_modules/**", ".git/**"] });
      allFiles.push(...files);
    }
    
    const uniqueFiles = [...new Set(allFiles)].slice(0, maxFiles);
    const results: any[] = [];
    
    for (const file of uniqueFiles) {
      try {
        const fullPath = path.join(cwd, file);
        const content = await fs.readFile(fullPath, "utf-8");
        results.push({
          path: file,
          size: content.length,
          lines: content.split("\n").length,
          content: content.substring(0, 1000), // First 1000 chars
        });
      } catch (e: any) {
        results.push({ path: file, error: e.message });
      }
    }
    
    return { totalFound: allFiles.length, returned: results.length, files: results };
  } catch (error: any) {
    throw new Error(`Batch read failed: ${error.message}`);
  }
}

async function batchProcess(args: any) {
  const { operation, files, destination, pattern, replacement } = BatchProcessInputSchema.parse(args);
  
  const results: any[] = [];
  
  for (const file of files) {
    try {
      switch (operation) {
        case "rename":
          if (pattern && replacement) {
            const newName = file.replace(new RegExp(pattern, "g"), replacement);
            await fs.rename(file, newName);
            results.push({ file, success: true, newName });
          }
          break;
        case "move":
          if (destination) {
            const fileName = path.basename(file);
            const newPath = path.join(destination, fileName);
            await fs.rename(file, newPath);
            results.push({ file, success: true, newPath });
          }
          break;
        case "delete":
          await fs.unlink(file);
          results.push({ file, success: true, deleted: true });
          break;
        case "copy":
          if (destination) {
            const fileName = path.basename(file);
            const newPath = path.join(destination, fileName);
            await fs.copyFile(file, newPath);
            results.push({ file, success: true, copied: newPath });
          }
          break;
      }
    } catch (error: any) {
      results.push({ file, success: false, error: error.message });
    }
  }
  
  return { processed: results.length, results };
}

// ============================================================================
// ADVANCED FEATURES - Code Analysis
// ============================================================================

const FindDuplicatesInputSchema = z.object({
  directory: z.string(),
  minSize: z.number().default(100),
  extensions: z.array(z.string()).optional(),
});

async function findDuplicates(args: any) {
  const { directory, minSize, extensions } = FindDuplicatesInputSchema.parse(args);
  
  const pattern = extensions ? `**/*.{${extensions.join(",")}}` : "**/*";
  const files = await fg(pattern, { 
    cwd: directory, 
    ignore: ["node_modules/**", ".git/**"],
    absolute: true 
  });
  
  const hashes = new Map<string, string[]>();
  
  for (const file of files) {
    try {
      const stats = await fs.stat(file);
      if (stats.size < minSize) continue;
      
      const content = await fs.readFile(file);
      const hash = crypto.createHash("md5").update(content).digest("hex");
      
      if (!hashes.has(hash)) {
        hashes.set(hash, []);
      }
      hashes.get(hash)!.push(file);
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  const duplicates = Array.from(hashes.entries())
    .filter(([_, files]) => files.length > 1)
    .map(([hash, files]) => ({
      hash,
      count: files.length,
      files,
      size: fsSync.statSync(files[0]).size,
    }));
  
  return {
    total: duplicates.length,
    duplicates,
    potentialSavings: duplicates.reduce((sum, d) => sum + (d.size * (d.count - 1)), 0),
  };
}

// ============================================================================
// ADVANCED FEATURES - Network Tools
// ============================================================================

const DownloadFileInputSchema = z.object({
  url: z.string().url(),
  destination: z.string(),
  timeout: z.number().default(60000),
});

const HttpServerInputSchema = z.object({
  directory: z.string().default("."),
  port: z.number().default(8000),
  duration: z.number().default(60),
});

async function downloadFile(args: any) {
  const { url, destination, timeout } = DownloadFileInputSchema.parse(args);
  
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "arraybuffer",
      timeout,
    });
    
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, response.data);
    
    return {
      success: true,
      path: destination,
      size: response.data.length,
      contentType: response.headers["content-type"],
    };
  } catch (error: any) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

// ============================================================================
// ADVANCED FEATURES - Text Processing
// ============================================================================

const TextSearchInputSchema = z.object({
  pattern: z.string(),
  files: z.array(z.string()),
  regex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  contextLines: z.number().default(2),
});

const TextReplaceInputSchema = z.object({
  filePath: z.string(),
  search: z.string(),
  replace: z.string(),
  regex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

async function textSearch(args: any) {
  const { pattern, files, regex, caseSensitive, contextLines } = TextSearchInputSchema.parse(args);
  
  const results: any[] = [];
  const searchRegex = regex 
    ? new RegExp(pattern, caseSensitive ? "g" : "gi")
    : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "g" : "gi");
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8");
      const lines = content.split("\n");
      const matches: any[] = [];
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          const start = Math.max(0, index - contextLines);
          const end = Math.min(lines.length, index + contextLines + 1);
          matches.push({
            lineNumber: index + 1,
            line: line.trim(),
            context: lines.slice(start, end),
          });
        }
      });
      
      if (matches.length > 0) {
        results.push({ file, matchCount: matches.length, matches });
      }
    } catch (e: any) {
      results.push({ file, error: e.message });
    }
  }
  
  return { totalMatches: results.reduce((sum, r) => sum + (r.matchCount || 0), 0), results };
}

async function textReplace(args: any) {
  const { filePath, search, replace, regex, caseSensitive, dryRun } = TextReplaceInputSchema.parse(args);
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const searchRegex = regex 
      ? new RegExp(search, caseSensitive ? "g" : "gi")
      : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "g" : "gi");
    
    const newContent = content.replace(searchRegex, replace);
    const changes = content !== newContent;
    const replacementCount = (content.match(searchRegex) || []).length;
    
    if (changes && !dryRun) {
      await fs.writeFile(filePath, newContent, "utf-8");
    }
    
    return {
      success: true,
      changed: changes,
      replacements: replacementCount,
      dryRun,
      preview: newContent.substring(0, 500),
    };
  } catch (error: any) {
    throw new Error(`Text replace failed: ${error.message}`);
  }
}

// ============================================================================
// ADVANCED FEATURES - Web Search & Developer Info Gathering
// ============================================================================

const SearchWebInputSchema = z.object({
  query: z.string(),
  engine: z.enum(["google", "duckduckgo", "bing"]).default("duckduckgo"),
  limit: z.number().default(10),
});

const CrawlWebpageInputSchema = z.object({
  url: z.string().url(),
  maxDepth: z.number().min(1).max(3).default(1),
  maxPages: z.number().min(1).max(50).default(10),
  sameDomain: z.boolean().default(true),
  followExternalLinks: z.boolean().default(false),
  extractContent: z.boolean().default(true),
});

const ExtractLinksInputSchema = z.object({
  url: z.string().url(),
  filter: z.enum(["all", "internal", "external"]).default("all"),
  pattern: z.string().optional(),
});

const SearchRedditInputSchema = z.object({
  query: z.string(),
  subreddit: z.string().optional(),
  limit: z.number().default(10),
  sortBy: z.enum(["relevance", "hot", "new", "top"]).default("relevance"),
});

const SearchGitHubInputSchema = z.object({
  query: z.string(),
  type: z.enum(["repositories", "code", "issues", "users"]).default("repositories"),
  language: z.string().optional(),
  limit: z.number().default(10),
});

const SearchStackOverflowInputSchema = z.object({
  query: z.string(),
  tags: z.array(z.string()).optional(),
  limit: z.number().default(10),
  sortBy: z.enum(["relevance", "votes", "newest"]).default("relevance"),
});

const SearchNpmInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const GetNpmPackageInputSchema = z.object({
  packageName: z.string(),
});

const SearchDocsInputSchema = z.object({
  query: z.string(),
  site: z.enum(["mdn", "devdocs", "nodejs", "python", "react"]).optional(),
  limit: z.number().default(5),
});

const GetGitHubRepoInputSchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

const GetGitHubIssuesInputSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).default("open"),
  limit: z.number().default(10),
});

const SearchPyPiInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const GetPyPiPackageInputSchema = z.object({
  packageName: z.string(),
});

const SearchCratesIoInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const GetCrateInputSchema = z.object({
  crateName: z.string(),
});

const SearchDockerHubInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const GetDockerImageInputSchema = z.object({
  imageName: z.string(),
});

const SearchOpenRouterInputSchema = z.object({
  query: z.string().optional(),
  category: z.enum(["all", "chat", "completion", "image", "embedding"]).default("all"),
});

const GetModelInfoInputSchema = z.object({
  modelId: z.string(),
  source: z.enum(["openrouter", "huggingface", "ollama"]).default("openrouter"),
});

const SearchHuggingFaceInputSchema = z.object({
  query: z.string(),
  type: z.enum(["models", "datasets", "spaces"]).default("models"),
  limit: z.number().default(10),
});

const SearchDevToInputSchema = z.object({
  query: z.string(),
  tag: z.string().optional(),
  limit: z.number().default(10),
});

const SearchMediumInputSchema = z.object({
  query: z.string(),
  tag: z.string().optional(),
  limit: z.number().default(10),
});

const SearchAwesomeListsInputSchema = z.object({
  topic: z.string(),
  limit: z.number().default(10),
});

const GetGitHubTrendingInputSchema = z.object({
  language: z.string().optional(),
  since: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

const SearchPackagistInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const SearchMavenInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const SearchGoPackagesInputSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
});

const GetApiInfoInputSchema = z.object({
  apiName: z.string(),
  source: z.enum(["rapidapi", "publicapis", "apilayer"]).default("publicapis"),
});

async function searchWeb(args: any) {
  const { query, engine, limit } = SearchWebInputSchema.parse(args);
  
  try {
    let searchUrl = "";
    
    if (engine === "duckduckgo") {
      searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    } else if (engine === "google") {
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    } else if (engine === "bing") {
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    }
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    const $ = cheerio.load(response.data);
    const results: any[] = [];
    
    if (engine === "duckduckgo") {
      $('.result').slice(0, limit).each((_, el) => {
        const title = $(el).find('.result__a').text().trim();
        const url = $(el).find('.result__a').attr('href');
        const snippet = $(el).find('.result__snippet').text().trim();
        
        if (title && url) {
          results.push({ title, url, snippet });
        }
      });
    } else if (engine === "google") {
      $('.g').slice(0, limit).each((_, el) => {
        const title = $(el).find('h3').text().trim();
        const url = $(el).find('a').first().attr('href');
        const snippet = $(el).find('.VwiC3b').text().trim() || $(el).find('.IsZvec').text().trim();
        
        if (title && url && url.startsWith('http')) {
          results.push({ title, url, snippet });
        }
      });
    } else if (engine === "bing") {
      $('.b_algo').slice(0, limit).each((_, el) => {
        const title = $(el).find('h2').text().trim();
        const url = $(el).find('h2 a').attr('href');
        const snippet = $(el).find('.b_caption p').text().trim();
        
        if (title && url) {
          results.push({ title, url, snippet });
        }
      });
    }
    
    return {
      query,
      engine,
      count: results.length,
      results,
    };
  } catch (error: any) {
    throw new Error(`Web search failed: ${error.message}`);
  }
}

async function crawlWebpage(args: any) {
  const { url, maxDepth, maxPages, sameDomain, followExternalLinks, extractContent } = CrawlWebpageInputSchema.parse(args);
  
  try {
    const visited = new Set<string>();
    const toVisit: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const results: any[] = [];
    const urlObj = new URL(url);
    const baseDomain = urlObj.hostname;
    
    while (toVisit.length > 0 && visited.size < maxPages) {
      const current = toVisit.shift();
      if (!current || visited.has(current.url) || current.depth >= maxDepth) continue;
      
      visited.add(current.url);
      
      try {
        const response = await axios.get(current.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
          },
          timeout: 10000,
          maxRedirects: 5,
        });
        
        const $ = cheerio.load(response.data);
        const pageData: any = {
          url: current.url,
          depth: current.depth,
          title: $('title').text().trim(),
          statusCode: response.status,
        };
        
        if (extractContent) {
          $('script, style, nav, footer, header').remove();
          const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
          pageData.content = bodyText.substring(0, 1000);
          pageData.headings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get().slice(0, 10);
          pageData.metaDescription = $('meta[name="description"]').attr('content') || '';
        }
        
        // Extract links
        const links: string[] = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          
          try {
            const linkUrl = new URL(href, current.url);
            const linkDomain = linkUrl.hostname;
            
            if (sameDomain && linkDomain !== baseDomain && !followExternalLinks) return;
            if (!sameDomain && !followExternalLinks && linkDomain !== baseDomain) return;
            
            const fullUrl = linkUrl.href;
            if (!visited.has(fullUrl) && fullUrl.startsWith('http')) {
              links.push(fullUrl);
              if (current.depth + 1 < maxDepth) {
                toVisit.push({ url: fullUrl, depth: current.depth + 1 });
              }
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });
        
        pageData.links = links.slice(0, 20);
        pageData.linkCount = links.length;
        results.push(pageData);
        
      } catch (e: any) {
        results.push({
          url: current.url,
          depth: current.depth,
          error: e.message,
        });
      }
    }
    
    return {
      startUrl: url,
      pagesVisited: visited.size,
      maxDepth,
      sameDomain,
      results,
    };
  } catch (error: any) {
    throw new Error(`Web crawl failed: ${error.message}`);
  }
}

async function extractLinks(args: any) {
  const { url, filter, pattern } = ExtractLinksInputSchema.parse(args);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkExtractor/1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const urlObj = new URL(url);
    const baseDomain = urlObj.hostname;
    const links: any[] = [];
    
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      if (!href) return;
      
      try {
        const linkUrl = new URL(href, url);
        const linkDomain = linkUrl.hostname;
        const isInternal = linkDomain === baseDomain;
        
        if (filter === "internal" && !isInternal) return;
        if (filter === "external" && isInternal) return;
        
        const fullUrl = linkUrl.href;
        
        if (pattern) {
          const regex = new RegExp(pattern);
          if (!regex.test(fullUrl)) return;
        }
        
        links.push({
          url: fullUrl,
          text: text || '(no text)',
          type: isInternal ? 'internal' : 'external',
          domain: linkDomain,
        });
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    return {
      sourceUrl: url,
      totalLinks: links.length,
      internal: links.filter(l => l.type === 'internal').length,
      external: links.filter(l => l.type === 'external').length,
      links,
    };
  } catch (error: any) {
    throw new Error(`Link extraction failed: ${error.message}`);
  }
}

async function searchReddit(args: any) {
  const { query, subreddit, limit, sortBy } = SearchRedditInputSchema.parse(args);
  
  try {
    const searchPath = subreddit 
      ? `/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1`
      : `/search.json?q=${encodeURIComponent(query)}`;
    
    const url = `https://www.reddit.com${searchPath}&sort=${sortBy}&limit=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const posts = response.data.data.children.map((child: any) => ({
      title: child.data.title,
      author: child.data.author,
      subreddit: child.data.subreddit,
      score: child.data.score,
      url: `https://reddit.com${child.data.permalink}`,
      numComments: child.data.num_comments,
      created: new Date(child.data.created_utc * 1000).toISOString(),
      selftext: child.data.selftext?.substring(0, 200),
    }));
    
    return {
      query,
      subreddit: subreddit || 'all',
      count: posts.length,
      posts,
    };
  } catch (error: any) {
    throw new Error(`Reddit search failed: ${error.message}`);
  }
}

async function searchGitHub(args: any) {
  const { query, type, language, limit } = SearchGitHubInputSchema.parse(args);
  
  try {
    let searchQuery = query;
    if (language) searchQuery += `+language:${language}`;
    
    const url = `https://github.com/search?q=${encodeURIComponent(searchQuery)}&type=${type}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const results: any[] = [];
    
    if (type === "repositories") {
      $('.repo-list-item').slice(0, limit).each((_, el) => {
        const name = $(el).find('a.v-align-middle').first().text().trim();
        const url = 'https://github.com' + $(el).find('a.v-align-middle').first().attr('href');
        const description = $(el).find('p').text().trim();
        const stars = $(el).find('[href*="stargazers"]').text().trim();
        const language = $(el).find('[itemprop="programmingLanguage"]').text().trim();
        
        if (name) {
          results.push({ name, url, description, stars, language });
        }
      });
    }
    
    return {
      query,
      type,
      count: results.length,
      results,
    };
  } catch (error: any) {
    throw new Error(`GitHub search failed: ${error.message}`);
  }
}

async function searchStackOverflow(args: any) {
  const { query, tags, limit, sortBy } = SearchStackOverflowInputSchema.parse(args);
  
  try {
    let searchQuery = query;
    if (tags && tags.length > 0) {
      searchQuery += ' ' + tags.map(t => `[${t}]`).join(' ');
    }
    
    const url = `https://stackoverflow.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const results: any[] = [];
    
    $('.question-summary').slice(0, limit).each((_, el) => {
      const title = $(el).find('.question-hyperlink').text().trim();
      const url = 'https://stackoverflow.com' + $(el).find('.question-hyperlink').attr('href');
      const votes = $(el).find('.vote-count-post strong').text().trim();
      const answers = $(el).find('.status strong').text().trim();
      const excerpt = $(el).find('.excerpt').text().trim();
      const tags = $(el).find('.post-tag').map((_, tag) => $(tag).text()).get();
      
      if (title) {
        results.push({ title, url, votes, answers, excerpt, tags });
      }
    });
    
    return {
      query,
      count: results.length,
      results,
    };
  } catch (error: any) {
    throw new Error(`Stack Overflow search failed: ${error.message}`);
  }
}

async function searchNpm(args: any) {
  const { query, limit } = SearchNpmInputSchema.parse(args);
  
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`;
    
    const response = await axios.get(url);
    
    const packages = response.data.objects.map((obj: any) => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description,
      author: obj.package.author?.name,
      keywords: obj.package.keywords || [],
      date: obj.package.date,
      links: obj.package.links,
      score: {
        final: obj.score.final,
        quality: obj.score.detail.quality,
        popularity: obj.score.detail.popularity,
        maintenance: obj.score.detail.maintenance,
      },
    }));
    
    return {
      query,
      count: packages.length,
      packages,
    };
  } catch (error: any) {
    throw new Error(`npm search failed: ${error.message}`);
  }
}

async function getNpmPackage(args: any) {
  const { packageName } = GetNpmPackageInputSchema.parse(args);
  
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    const latest = data['dist-tags']?.latest;
    const latestVersion = latest ? data.versions[latest] : null;
    
    return {
      name: data.name,
      version: latest,
      description: data.description,
      author: data.author,
      license: data.license,
      homepage: data.homepage,
      repository: data.repository,
      keywords: data.keywords || [],
      dependencies: latestVersion?.dependencies || {},
      devDependencies: latestVersion?.devDependencies || {},
      downloads: data.downloads,
      readme: data.readme?.substring(0, 500),
    };
  } catch (error: any) {
    throw new Error(`Failed to get npm package: ${error.message}`);
  }
}

async function searchDocs(args: any) {
  const { query, site, limit } = SearchDocsInputSchema.parse(args);
  
  try {
    const siteUrls: Record<string, string> = {
      mdn: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}`,
      devdocs: `https://devdocs.io/#q=${encodeURIComponent(query)}`,
      nodejs: `https://nodejs.org/api/all.html#all_${encodeURIComponent(query)}`,
      python: `https://docs.python.org/3/search.html?q=${encodeURIComponent(query)}`,
      react: `https://react.dev/?search=${encodeURIComponent(query)}`,
    };
    
    if (site && siteUrls[site]) {
      return {
        query,
        site,
        url: siteUrls[site],
        message: "Direct documentation link generated",
      };
    }
    
    // Search across multiple documentation sites
    const searchResults = {
      query,
      sites: [
        { name: "MDN", url: siteUrls.mdn },
        { name: "DevDocs", url: siteUrls.devdocs },
        { name: "Node.js", url: siteUrls.nodejs },
      ],
    };
    
    return searchResults;
  } catch (error: any) {
    throw new Error(`Documentation search failed: ${error.message}`);
  }
}

async function getGitHubRepo(args: any) {
  const { owner, repo } = GetGitHubRepoInputSchema.parse(args);
  
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    const data = response.data;
    
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      url: data.html_url,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      language: data.language,
      topics: data.topics || [],
      license: data.license?.name,
      defaultBranch: data.default_branch,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      homepage: data.homepage,
    };
  } catch (error: any) {
    throw new Error(`Failed to get GitHub repo: ${error.message}`);
  }
}

async function getGitHubIssues(args: any) {
  const { owner, repo, state, limit } = GetGitHubIssuesInputSchema.parse(args);
  
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    const issues = response.data.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.user.login,
      url: issue.html_url,
      labels: issue.labels.map((l: any) => l.name),
      comments: issue.comments,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      body: issue.body?.substring(0, 200),
    }));
    
    return {
      repository: `${owner}/${repo}`,
      state,
      count: issues.length,
      issues,
    };
  } catch (error: any) {
    throw new Error(`Failed to get GitHub issues: ${error.message}`);
  }
}

async function searchPyPi(args: any) {
  const { query, limit } = SearchPyPiInputSchema.parse(args);
  
  try {
    const url = `https://pypi.org/search/?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const packages: any[] = [];
    
    $('.package-snippet').slice(0, limit).each((_, el) => {
      const name = $(el).find('.package-snippet__name').text().trim();
      const version = $(el).find('.package-snippet__version').text().trim();
      const description = $(el).find('.package-snippet__description').text().trim();
      const released = $(el).find('.package-snippet__created time').attr('datetime');
      
      if (name) {
        packages.push({
          name,
          version,
          description,
          released,
          url: `https://pypi.org/project/${name}/`,
        });
      }
    });
    
    return {
      query,
      count: packages.length,
      packages,
    };
  } catch (error: any) {
    throw new Error(`PyPI search failed: ${error.message}`);
  }
}

async function getPyPiPackage(args: any) {
  const { packageName } = GetPyPiPackageInputSchema.parse(args);
  
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    return {
      name: data.info.name,
      version: data.info.version,
      summary: data.info.summary,
      description: data.info.description?.substring(0, 500),
      author: data.info.author,
      authorEmail: data.info.author_email,
      license: data.info.license,
      homepage: data.info.home_page,
      projectUrl: data.info.project_url,
      requiresPython: data.info.requires_python,
      keywords: data.info.keywords,
      classifiers: data.info.classifiers?.slice(0, 10),
    };
  } catch (error: any) {
    throw new Error(`Failed to get PyPI package: ${error.message}`);
  }
}

async function searchCratesIo(args: any) {
  const { query, limit } = SearchCratesIoInputSchema.parse(args);
  
  try {
    const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Developer Info Bot (https://recoder.xyz)',
      },
    });
    
    const crates = response.data.crates.map((crate: any) => ({
      name: crate.name,
      version: crate.max_version,
      description: crate.description,
      downloads: crate.downloads,
      recentDownloads: crate.recent_downloads,
      repository: crate.repository,
      homepage: crate.homepage,
      documentation: crate.documentation,
      createdAt: crate.created_at,
      updatedAt: crate.updated_at,
    }));
    
    return {
      query,
      count: crates.length,
      crates,
    };
  } catch (error: any) {
    throw new Error(`Crates.io search failed: ${error.message}`);
  }
}

async function getCrate(args: any) {
  const { crateName } = GetCrateInputSchema.parse(args);
  
  try {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Developer Info Bot (https://recoder.xyz)',
      },
    });
    
    const crate = response.data.crate;
    const versions = response.data.versions;
    
    return {
      name: crate.name,
      version: crate.max_version,
      description: crate.description,
      downloads: crate.downloads,
      recentDownloads: crate.recent_downloads,
      repository: crate.repository,
      homepage: crate.homepage,
      documentation: crate.documentation,
      keywords: crate.keywords,
      categories: crate.categories,
      versions: versions.slice(0, 10).map((v: any) => ({
        version: v.num,
        downloads: v.downloads,
        createdAt: v.created_at,
      })),
    };
  } catch (error: any) {
    throw new Error(`Failed to get crate: ${error.message}`);
  }
}

async function searchDockerHub(args: any) {
  const { query, limit } = SearchDockerHubInputSchema.parse(args);
  
  try {
    const url = `https://hub.docker.com/api/content/v1/products/search?q=${encodeURIComponent(query)}&page_size=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const images = response.data.summaries?.map((img: any) => ({
      name: img.name,
      slug: img.slug,
      type: img.type,
      publisher: img.publisher?.name,
      pullCount: img.pull_count,
      starCount: img.star_count,
      shortDescription: img.short_description,
      source: img.source,
    })) || [];
    
    return {
      query,
      count: images.length,
      images,
    };
  } catch (error: any) {
    throw new Error(`Docker Hub search failed: ${error.message}`);
  }
}

async function getDockerImage(args: any) {
  const { imageName } = GetDockerImageInputSchema.parse(args);
  
  try {
    const [namespace, repo] = imageName.includes('/') 
      ? imageName.split('/')
      : ['library', imageName];
    
    const url = `https://hub.docker.com/v2/repositories/${namespace}/${repo}/`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const data = response.data;
    
    return {
      name: data.name,
      namespace: data.namespace,
      description: data.description,
      pullCount: data.pull_count,
      starCount: data.star_count,
      isOfficial: data.is_official,
      isAutomated: data.is_automated,
      lastUpdated: data.last_updated,
      dateRegistered: data.date_registered,
      affiliation: data.affiliation,
    };
  } catch (error: any) {
    throw new Error(`Failed to get Docker image: ${error.message}`);
  }
}

async function searchOpenRouter(args: any) {
  const { query, category } = SearchOpenRouterInputSchema.parse(args);
  
  try {
    const url = 'https://openrouter.ai/api/v1/models';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    let models = response.data.data || [];
    
    // Filter by category and query
    if (category !== "all") {
      models = models.filter((m: any) => {
        const cat = m.id.toLowerCase();
        if (category === "chat") return cat.includes('chat') || cat.includes('instruct');
        if (category === "completion") return !cat.includes('chat') && !cat.includes('vision');
        if (category === "image") return cat.includes('vision') || cat.includes('image');
        if (category === "embedding") return cat.includes('embed');
        return true;
      });
    }
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      models = models.filter((m: any) => 
        m.id.toLowerCase().includes(lowerQuery) ||
        m.name?.toLowerCase().includes(lowerQuery)
      );
    }
    
    const results = models.slice(0, 20).map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      pricing: m.pricing,
      contextLength: m.context_length,
      topProvider: m.top_provider,
      architecture: m.architecture,
    }));
    
    return {
      query: query || 'all',
      category,
      count: results.length,
      models: results,
    };
  } catch (error: any) {
    throw new Error(`OpenRouter search failed: ${error.message}`);
  }
}

async function getModelInfo(args: any) {
  const { modelId, source } = GetModelInfoInputSchema.parse(args);
  
  try {
    if (source === "openrouter") {
      const response = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
        },
      });
      
      const model = response.data.data?.find((m: any) => m.id === modelId);
      
      if (!model) {
        throw new Error(`Model ${modelId} not found on OpenRouter`);
      }
      
      return {
        source: 'openrouter',
        id: model.id,
        name: model.name,
        description: model.description,
        pricing: model.pricing,
        contextLength: model.context_length,
        topProvider: model.top_provider,
        architecture: model.architecture,
        promptCost: model.pricing?.prompt,
        completionCost: model.pricing?.completion,
      };
    } else if (source === "huggingface") {
      const url = `https://huggingface.co/api/models/${encodeURIComponent(modelId)}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
        },
      });
      
      const model = response.data;
      
      return {
        source: 'huggingface',
        id: model.id,
        modelId: model.modelId,
        author: model.author,
        downloads: model.downloads,
        likes: model.likes,
        tags: model.tags,
        pipeline_tag: model.pipeline_tag,
        library_name: model.library_name,
        createdAt: model.createdAt,
        lastModified: model.lastModified,
      };
    }
    
    return { error: 'Source not implemented yet' };
  } catch (error: any) {
    throw new Error(`Failed to get model info: ${error.message}`);
  }
}

async function searchHuggingFace(args: any) {
  const { query, type, limit } = SearchHuggingFaceInputSchema.parse(args);
  
  try {
    const url = `https://huggingface.co/api/${type}?search=${encodeURIComponent(query)}&limit=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const results = response.data.map((item: any) => ({
      id: item.id,
      modelId: item.modelId || item.id,
      author: item.author,
      downloads: item.downloads,
      likes: item.likes,
      tags: item.tags?.slice(0, 5),
      pipeline_tag: item.pipeline_tag,
      lastModified: item.lastModified,
    }));
    
    return {
      query,
      type,
      count: results.length,
      results,
    };
  } catch (error: any) {
    throw new Error(`Hugging Face search failed: ${error.message}`);
  }
}

async function searchDevTo(args: any) {
  const { query, tag, limit } = SearchDevToInputSchema.parse(args);
  
  try {
    let url = 'https://dev.to/api/articles?';
    
    if (tag) {
      url += `tag=${encodeURIComponent(tag)}&`;
    }
    url += `per_page=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    let articles = response.data;
    
    if (query && !tag) {
      const lowerQuery = query.toLowerCase();
      articles = articles.filter((a: any) => 
        a.title.toLowerCase().includes(lowerQuery) ||
        a.description?.toLowerCase().includes(lowerQuery) ||
        a.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))
      );
    }
    
    const results = articles.slice(0, limit).map((article: any) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      publishedAt: article.published_at,
      tags: article.tag_list,
      readingTimeMinutes: article.reading_time_minutes,
      positiveReactions: article.positive_reactions_count,
      commentsCount: article.comments_count,
      user: {
        name: article.user.name,
        username: article.user.username,
      },
    }));
    
    return {
      query,
      tag,
      count: results.length,
      articles: results,
    };
  } catch (error: any) {
    throw new Error(`Dev.to search failed: ${error.message}`);
  }
}

async function searchMedium(args: any) {
  const { query, tag, limit } = SearchMediumInputSchema.parse(args);
  
  try {
    const searchUrl = tag 
      ? `https://medium.com/tag/${encodeURIComponent(tag)}/latest`
      : `https://medium.com/search?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    // Medium has complex JS rendering, so we provide the search URL
    return {
      query,
      tag,
      searchUrl,
      message: 'Medium requires JavaScript rendering. Use the searchUrl to view results in browser.',
      suggestion: 'Consider using RSS feed: https://medium.com/feed/tag/' + (tag || query),
    };
  } catch (error: any) {
    throw new Error(`Medium search failed: ${error.message}`);
  }
}

async function searchAwesomeLists(args: any) {
  const { topic, limit } = SearchAwesomeListsInputSchema.parse(args);
  
  try {
    const url = `https://github.com/search?q=awesome+${encodeURIComponent(topic)}&type=repositories`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const results: any[] = [];
    
    $('.repo-list-item').slice(0, limit).each((_, el) => {
      const name = $(el).find('a.v-align-middle').first().text().trim();
      const url = 'https://github.com' + $(el).find('a.v-align-middle').first().attr('href');
      const description = $(el).find('p').text().trim();
      const stars = $(el).find('[href*="stargazers"]').text().trim();
      
      if (name && name.toLowerCase().includes('awesome')) {
        results.push({ name, url, description, stars });
      }
    });
    
    return {
      topic,
      count: results.length,
      awesomeLists: results,
    };
  } catch (error: any) {
    throw new Error(`Awesome lists search failed: ${error.message}`);
  }
}

async function getGitHubTrending(args: any) {
  const { language, since } = GetGitHubTrendingInputSchema.parse(args);
  
  try {
    let url = `https://github.com/trending`;
    if (language) {
      url += `/${encodeURIComponent(language)}`;
    }
    url += `?since=${since}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const repos: any[] = [];
    
    $('article.Box-row').each((_, el) => {
      const nameElement = $(el).find('h2 a');
      const repoPath = nameElement.attr('href')?.replace('/', '');
      const name = repoPath?.split('/')[1];
      const owner = repoPath?.split('/')[0];
      const description = $(el).find('p').text().trim();
      const language = $(el).find('[itemprop="programmingLanguage"]').text().trim();
      const stars = $(el).find('.d-inline-block.float-sm-right').text().trim();
      const starsToday = $(el).find('.d-inline-block.float-sm-right + span').text().trim();
      
      if (name) {
        repos.push({
          owner,
          name,
          fullName: repoPath,
          url: `https://github.com/${repoPath}`,
          description,
          language,
          stars,
          starsToday,
        });
      }
    });
    
    return {
      language: language || 'all',
      since,
      count: repos.length,
      repositories: repos,
    };
  } catch (error: any) {
    throw new Error(`GitHub trending failed: ${error.message}`);
  }
}

async function searchPackagist(args: any) {
  const { query, limit } = SearchPackagistInputSchema.parse(args);
  
  try {
    const url = `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const packages = response.data.results?.map((pkg: any) => ({
      name: pkg.name,
      description: pkg.description,
      url: pkg.url,
      repository: pkg.repository,
      downloads: pkg.downloads,
      favers: pkg.favers,
    })) || [];
    
    return {
      query,
      count: packages.length,
      packages,
    };
  } catch (error: any) {
    throw new Error(`Packagist search failed: ${error.message}`);
  }
}

async function searchMaven(args: any) {
  const { query, limit } = SearchMavenInputSchema.parse(args);
  
  try {
    const url = `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(query)}&rows=${limit}&wt=json`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const artifacts = response.data.response?.docs?.map((doc: any) => ({
      groupId: doc.g,
      artifactId: doc.a,
      version: doc.latestVersion,
      packaging: doc.p,
      timestamp: doc.timestamp,
      versionCount: doc.versionCount,
    })) || [];
    
    return {
      query,
      count: artifacts.length,
      artifacts,
    };
  } catch (error: any) {
    throw new Error(`Maven search failed: ${error.message}`);
  }
}

async function searchGoPackages(args: any) {
  const { query, limit } = SearchGoPackagesInputSchema.parse(args);
  
  try {
    const url = `https://pkg.go.dev/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Developer Info Bot 1.0)',
      },
    });
    
    const $ = cheerio.load(response.data);
    const packages: any[] = [];
    
    $('.SearchSnippet').slice(0, limit).each((_, el) => {
      const name = $(el).find('.SearchSnippet-header a').first().text().trim();
      const url = 'https://pkg.go.dev' + $(el).find('.SearchSnippet-header a').first().attr('href');
      const synopsis = $(el).find('.SearchSnippet-synopsis').text().trim();
      const version = $(el).find('.SearchSnippet-version').text().trim();
      const published = $(el).find('.SearchSnippet-published').text().trim();
      
      if (name) {
        packages.push({ name, url, synopsis, version, published });
      }
    });
    
    return {
      query,
      count: packages.length,
      packages,
    };
  } catch (error: any) {
    throw new Error(`Go packages search failed: ${error.message}`);
  }
}

async function getApiInfo(args: any) {
  const { apiName, source } = GetApiInfoInputSchema.parse(args);
  
  try {
    if (source === "publicapis") {
      const url = 'https://api.publicapis.org/entries';
      
      const response = await axios.get(url);
      const apis = response.data.entries || [];
      
      const lowerName = apiName.toLowerCase();
      const matchingApis = apis.filter((api: any) => 
        api.API.toLowerCase().includes(lowerName) ||
        api.Description.toLowerCase().includes(lowerName) ||
        api.Category.toLowerCase().includes(lowerName)
      ).slice(0, 10);
      
      return {
        source: 'publicapis',
        query: apiName,
        count: matchingApis.length,
        apis: matchingApis.map((api: any) => ({
          name: api.API,
          description: api.Description,
          auth: api.Auth,
          https: api.HTTPS,
          cors: api.Cors,
          category: api.Category,
          link: api.Link,
        })),
      };
    }
    
    return {
      source,
      message: 'This source requires API key. Use publicapis for free access.',
    };
  } catch (error: any) {
    throw new Error(`API info retrieval failed: ${error.message}`);
  }
}

// ============================================================================
// DATABASE TOOLS - PostgreSQL, MongoDB
// ============================================================================

async function queryPostgres(args: any) {
  const { connectionString, query, params } = args;
  
  try {
    // Dynamic import to avoid requiring pg if not used
    const pg = await import('pg' as any).catch(() => null) as any;
    if (!pg) {
      return { error: 'PostgreSQL client (pg) not installed. Run: npm install pg' };
    }
    
    const client = new pg.default.Client({ connectionString });
    await client.connect();
    
    const result = await client.query(query, params || []);
    await client.end();
    
    return {
      rowCount: result.rowCount,
      rows: result.rows.slice(0, 100), // Limit to 100 rows
      fields: result.fields?.map((f: any) => ({ name: f.name, dataType: f.dataTypeID })),
    };
  } catch (error: any) {
    return { error: `PostgreSQL query failed: ${error.message}` };
  }
}

async function queryMongodb(args: any) {
  const { connectionString, database, collection, operation, query, options } = args;
  
  try {
    // Dynamic import
    const mongodb = await import('mongodb' as any).catch(() => null) as any;
    if (!mongodb) {
      return { error: 'MongoDB client not installed. Run: npm install mongodb' };
    }
    
    const client = new mongodb.MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(database);
    const coll = db.collection(collection);
    
    let result;
    switch (operation) {
      case 'find':
        result = await coll.find(query || {}, options || {}).limit(100).toArray();
        break;
      case 'findOne':
        result = await coll.findOne(query || {});
        break;
      case 'count':
        result = await coll.countDocuments(query || {});
        break;
      case 'aggregate':
        result = await coll.aggregate(query || []).limit(100).toArray();
        break;
      default:
        result = { error: 'Unknown operation' };
    }
    
    await client.close();
    return result;
  } catch (error: any) {
    return { error: `MongoDB query failed: ${error.message}` };
  }
}

// ============================================================================
// AWS TOOLS - S3, Lambda
// ============================================================================

async function awsS3List(args: any) {
  const { bucket, prefix, maxKeys } = args;
  
  try {
    const aws = await import('@aws-sdk/client-s3' as any).catch(() => null) as any;
    if (!aws) {
      return { error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-s3' };
    }
    
    const client = new aws.S3Client({});
    const command = new aws.ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys || 100,
    });
    
    const response = await client.send(command);
    return {
      bucket,
      prefix,
      count: response.KeyCount,
      objects: response.Contents?.map((obj: any) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
      })),
    };
  } catch (error: any) {
    return { error: `S3 list failed: ${error.message}` };
  }
}

async function awsLambdaInvoke(args: any) {
  const { functionName, payload, region } = args;
  
  try {
    const aws = await import('@aws-sdk/client-lambda' as any).catch(() => null) as any;
    if (!aws) {
      return { error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-lambda' };
    }
    
    const client = new aws.LambdaClient({ region: region || 'us-east-1' });
    const command = new aws.InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload || {}),
    });
    
    const response = await client.send(command);
    const responsePayload = response.Payload 
      ? JSON.parse(new TextDecoder().decode(response.Payload))
      : null;
    
    return {
      statusCode: response.StatusCode,
      functionError: response.FunctionError,
      payload: responsePayload,
    };
  } catch (error: any) {
    return { error: `Lambda invoke failed: ${error.message}` };
  }
}

// ============================================================================
// MORE DATABASE TOOLS - DynamoDB, Redis, MySQL
// ============================================================================

async function queryDynamodb(args: any) {
  const { tableName, operation, key, item, filterExpression, expressionValues, region } = args;
  
  try {
    const aws = await import('@aws-sdk/client-dynamodb' as any).catch(() => null) as any;
    const util = await import('@aws-sdk/util-dynamodb' as any).catch(() => null) as any;
    if (!aws || !util) {
      return { error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb' };
    }
    
    const client = new aws.DynamoDBClient({ region: region || 'us-east-1' });
    let result;
    
    switch (operation) {
      case 'get':
        const getCmd = new aws.GetItemCommand({ TableName: tableName, Key: util.marshall(key) });
        const getRes = await client.send(getCmd);
        result = getRes.Item ? util.unmarshall(getRes.Item) : null;
        break;
      case 'put':
        const putCmd = new aws.PutItemCommand({ TableName: tableName, Item: util.marshall(item) });
        await client.send(putCmd);
        result = { success: true };
        break;
      case 'scan':
        const scanCmd = new aws.ScanCommand({
          TableName: tableName,
          FilterExpression: filterExpression,
          ExpressionAttributeValues: expressionValues ? util.marshall(expressionValues) : undefined,
          Limit: 100,
        });
        const scanRes = await client.send(scanCmd);
        result = scanRes.Items?.map((i: any) => util.unmarshall(i)) || [];
        break;
      case 'query':
        const queryCmd = new aws.QueryCommand({
          TableName: tableName,
          KeyConditionExpression: filterExpression,
          ExpressionAttributeValues: expressionValues ? util.marshall(expressionValues) : undefined,
          Limit: 100,
        });
        const queryRes = await client.send(queryCmd);
        result = queryRes.Items?.map((i: any) => util.unmarshall(i)) || [];
        break;
      default:
        result = { error: 'Unknown operation. Use: get, put, scan, query' };
    }
    
    return result;
  } catch (error: any) {
    return { error: `DynamoDB operation failed: ${error.message}` };
  }
}

async function queryRedis(args: any) {
  const { url, command, key, value, field, ttl } = args;
  
  try {
    const redis = await import('redis' as any).catch(() => null) as any;
    if (!redis) {
      return { error: 'Redis client not installed. Run: npm install redis' };
    }
    
    const client = redis.createClient({ url: url || 'redis://localhost:6379' });
    await client.connect();
    
    let result;
    switch (command) {
      case 'get': result = await client.get(key); break;
      case 'set': result = ttl ? await client.setEx(key, ttl, value) : await client.set(key, value); break;
      case 'del': result = await client.del(key); break;
      case 'hget': result = await client.hGet(key, field); break;
      case 'hset': result = await client.hSet(key, field, value); break;
      case 'hgetall': result = await client.hGetAll(key); break;
      case 'lpush': result = await client.lPush(key, value); break;
      case 'lrange': result = await client.lRange(key, 0, -1); break;
      case 'keys': result = await client.keys(key || '*'); break;
      case 'ttl': result = await client.ttl(key); break;
      default: result = { error: 'Unknown command' };
    }
    
    await client.quit();
    return result;
  } catch (error: any) {
    return { error: `Redis operation failed: ${error.message}` };
  }
}

async function queryMysql(args: any) {
  const { host, user, password, database, query, params } = args;
  
  try {
    const mysql = await import('mysql2/promise' as any).catch(() => null) as any;
    if (!mysql) {
      return { error: 'MySQL client not installed. Run: npm install mysql2' };
    }
    
    const connection = await mysql.createConnection({ host, user, password, database });
    const [rows, fields] = await connection.execute(query, params || []);
    await connection.end();
    
    return {
      rows: Array.isArray(rows) ? rows.slice(0, 100) : rows,
      fields: fields?.map((f: any) => ({ name: f.name, type: f.type })),
    };
  } catch (error: any) {
    return { error: `MySQL query failed: ${error.message}` };
  }
}

// ============================================================================
// MORE AWS TOOLS - EC2, SQS, SNS
// ============================================================================

async function awsEc2Describe(args: any) {
  const { instanceIds, filters, region } = args;
  
  try {
    const aws = await import('@aws-sdk/client-ec2' as any).catch(() => null) as any;
    if (!aws) {
      return { error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-ec2' };
    }
    
    const client = new aws.EC2Client({ region: region || 'us-east-1' });
    const command = new aws.DescribeInstancesCommand({
      InstanceIds: instanceIds,
      Filters: filters,
    });
    
    const response = await client.send(command);
    const instances = response.Reservations?.flatMap((r: any) => r.Instances) || [];
    
    return instances.map((i: any) => ({
      instanceId: i.InstanceId,
      state: i.State?.Name,
      type: i.InstanceType,
      publicIp: i.PublicIpAddress,
      privateIp: i.PrivateIpAddress,
      launchTime: i.LaunchTime,
      tags: i.Tags,
    }));
  } catch (error: any) {
    return { error: `EC2 describe failed: ${error.message}` };
  }
}

async function awsSqsSend(args: any) {
  const { queueUrl, messageBody, delaySeconds, messageAttributes, region } = args;
  
  try {
    const aws = await import('@aws-sdk/client-sqs' as any).catch(() => null) as any;
    if (!aws) {
      return { error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-sqs' };
    }
    
    const client = new aws.SQSClient({ region: region || 'us-east-1' });
    const command = new aws.SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
      DelaySeconds: delaySeconds,
      MessageAttributes: messageAttributes,
    });
    
    const response = await client.send(command);
    return { messageId: response.MessageId, sequenceNumber: response.SequenceNumber };
  } catch (error: any) {
    return { error: `SQS send failed: ${error.message}` };
  }
}

async function awsSqsReceive(args: any) {
  const { queueUrl, maxMessages, waitTimeSeconds, region } = args;
  
  try {
    const aws = await import('@aws-sdk/client-sqs' as any).catch(() => null) as any;
    if (!aws) {
      return { error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-sqs' };
    }
    
    const client = new aws.SQSClient({ region: region || 'us-east-1' });
    const command = new aws.ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages || 10,
      WaitTimeSeconds: waitTimeSeconds || 0,
    });
    
    const response = await client.send(command);
    return response.Messages?.map((m: any) => ({
      messageId: m.MessageId,
      body: m.Body,
      receiptHandle: m.ReceiptHandle,
    })) || [];
  } catch (error: any) {
    return { error: `SQS receive failed: ${error.message}` };
  }
}

// ============================================================================
// GCP TOOLS - Storage, BigQuery
// ============================================================================

async function gcpStorageList(args: any) {
  const { bucket, prefix, maxResults } = args;
  
  try {
    const { Storage } = await import('@google-cloud/storage' as any).catch(() => ({ Storage: null })) as any;
    if (!Storage) {
      return { error: 'GCP SDK not installed. Run: npm install @google-cloud/storage' };
    }
    
    const storage = new Storage();
    const [files] = await storage.bucket(bucket).getFiles({ prefix, maxResults: maxResults || 100 });
    
    return files.map((f: any) => ({
      name: f.name,
      size: f.metadata.size,
      updated: f.metadata.updated,
      contentType: f.metadata.contentType,
    }));
  } catch (error: any) {
    return { error: `GCP Storage list failed: ${error.message}` };
  }
}

async function gcpBigQuery(args: any) {
  const { query, projectId, location } = args;
  
  try {
    const { BigQuery } = await import('@google-cloud/bigquery' as any).catch(() => ({ BigQuery: null })) as any;
    if (!BigQuery) {
      return { error: 'GCP SDK not installed. Run: npm install @google-cloud/bigquery' };
    }
    
    const bigquery = new BigQuery({ projectId, location });
    const [rows] = await bigquery.query({ query, location });
    
    return { rows: rows.slice(0, 100), count: rows.length };
  } catch (error: any) {
    return { error: `BigQuery failed: ${error.message}` };
  }
}

// ============================================================================
// AI MODEL TOOLS - OpenAI, Anthropic, Groq
// ============================================================================

async function aiComplete(args: any) {
  const { provider, model, prompt, systemPrompt, maxTokens, temperature } = args;
  
  try {
    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      return { error: `${provider.toUpperCase()}_API_KEY not set in environment` };
    }
    
    let response;
    
    if (provider === 'openai') {
      response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: model || 'gpt-4o-mini',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens || 1000,
        temperature: temperature || 0.7,
      }, { headers: { Authorization: `Bearer ${apiKey}` } });
      return { content: response.data.choices[0].message.content, usage: response.data.usage };
    }
    
    if (provider === 'anthropic') {
      response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: model || 'claude-3-haiku-20240307',
        max_tokens: maxTokens || 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } });
      return { content: response.data.content[0].text, usage: response.data.usage };
    }
    
    if (provider === 'groq') {
      response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: model || 'llama-3.1-8b-instant',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens || 1000,
        temperature: temperature || 0.7,
      }, { headers: { Authorization: `Bearer ${apiKey}` } });
      return { content: response.data.choices[0].message.content, usage: response.data.usage };
    }
    
    return { error: 'Unknown provider. Use: openai, anthropic, groq' };
  } catch (error: any) {
    return { error: `AI completion failed: ${error.response?.data?.error?.message || error.message}` };
  }
}

async function aiEmbed(args: any) {
  const { provider, model, text } = args;
  
  try {
    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      return { error: `${provider.toUpperCase()}_API_KEY not set in environment` };
    }
    
    if (provider === 'openai') {
      const response = await axios.post('https://api.openai.com/v1/embeddings', {
        model: model || 'text-embedding-3-small',
        input: text,
      }, { headers: { Authorization: `Bearer ${apiKey}` } });
      return { embedding: response.data.data[0].embedding, dimensions: response.data.data[0].embedding.length };
    }
    
    return { error: 'Unknown provider. Use: openai' };
  } catch (error: any) {
    return { error: `Embedding failed: ${error.response?.data?.error?.message || error.message}` };
  }
}

// ============================================================================
// ADVANCED FEATURES - Image Processing
// ============================================================================

const ResizeImageInputSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).default("cover"),
  quality: z.number().min(1).max(100).default(80),
});

const OptimizeImageInputSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string().optional(),
  quality: z.number().min(1).max(100).default(80),
  format: z.enum(["jpeg", "png", "webp"]).optional(),
});

const GetImageMetadataInputSchema = z.object({
  imagePath: z.string(),
});

async function resizeImage(args: any) {
  // Try to load sharp dynamically
  if (!sharpModule) {
    try {
      const sharpPath = "sharp";
      sharpModule = await import(sharpPath);
    } catch (e) {
      throw new Error("Sharp not available. Install with: npm install sharp");
    }
  }
  
  const { inputPath, outputPath, width, height, fit, quality } = ResizeImageInputSchema.parse(args);
  
  try {
    const sharp = sharpModule.default;
    const image = sharp(inputPath);
    
    if (width || height) {
      image.resize(width, height, { fit });
    }
    
    await image.jpeg({ quality }).toFile(outputPath);
    
    const info = await sharp(outputPath).metadata();
    return {
      success: true,
      outputPath,
      width: info.width,
      height: info.height,
      format: info.format,
      size: fsSync.statSync(outputPath).size,
    };
  } catch (error: any) {
    throw new Error(`Image resize failed: ${error.message}`);
  }
}

async function optimizeImage(args: any) {
  // Try to load sharp dynamically
  if (!sharpModule) {
    try {
      const sharpPath = "sharp";
      sharpModule = await import(sharpPath);
    } catch (e) {
      throw new Error("Sharp not available. Install with: npm install sharp");
    }
  }
  
  const { inputPath, outputPath, quality, format } = OptimizeImageInputSchema.parse(args);
  
  try {
    const sharp = sharpModule.default;
    const output = outputPath || inputPath;
    const image = sharp(inputPath);
    
    if (format === "webp") {
      await image.webp({ quality }).toFile(output);
    } else if (format === "png") {
      await image.png({ quality }).toFile(output);
    } else {
      await image.jpeg({ quality }).toFile(output);
    }
    
    const originalSize = fsSync.statSync(inputPath).size;
    const newSize = fsSync.statSync(output).size;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(2);
    
    return {
      success: true,
      originalSize,
      newSize,
      savings: `${savings}%`,
      outputPath: output,
    };
  } catch (error: any) {
    throw new Error(`Image optimization failed: ${error.message}`);
  }
}

async function getImageMetadata(args: any) {
  // Try to load sharp dynamically
  if (!sharpModule) {
    try {
      const sharpPath = "sharp";
      sharpModule = await import(sharpPath);
    } catch (e) {
      throw new Error("Sharp not available. Install with: npm install sharp");
    }
  }
  
  const { imagePath } = GetImageMetadataInputSchema.parse(args);
  
  try {
    const sharp = sharpModule.default;
    const metadata = await sharp(imagePath).metadata();
    const stats = await fs.stat(imagePath);
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
    };
  } catch (error: any) {
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
}

// ============================================================================
// ADVANCED FEATURES - Data Analysis
// ============================================================================

const AnalyzeCsvInputSchema = z.object({
  filePath: z.string(),
  operations: z.array(z.enum(["stats", "preview", "columns", "types", "summary"])),
  limit: z.number().default(10),
});

const MergeDatasetsInputSchema = z.object({
  file1: z.string(),
  file2: z.string(),
  outputPath: z.string(),
  joinType: z.enum(["inner", "left", "right", "outer"]).default("inner"),
  joinKey: z.string(),
});

const DataValidationInputSchema = z.object({
  filePath: z.string(),
  schema: z.record(z.any()),
  format: z.enum(["csv", "json"]).default("json"),
});

async function analyzeCsv(args: any) {
  const { filePath, operations, limit } = AnalyzeCsvInputSchema.parse(args);
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    
    const result: any = {};
    
    if (operations.includes("preview")) {
      result.preview = parsed.data.slice(0, limit);
    }
    
    if (operations.includes("columns")) {
      result.columns = parsed.meta.fields || [];
      result.columnCount = result.columns.length;
    }
    
    if (operations.includes("stats")) {
      result.stats = {
        totalRows: parsed.data.length,
        totalColumns: parsed.meta.fields?.length || 0,
      };
    }
    
    if (operations.includes("types")) {
      const types: any = {};
      const sample = parsed.data[0] as any;
      
      for (const key in sample) {
        const value = sample[key];
        if (!isNaN(value)) types[key] = "number";
        else if (value === "true" || value === "false") types[key] = "boolean";
        else types[key] = "string";
      }
      result.types = types;
    }
    
    if (operations.includes("summary")) {
      const summary: any = {};
      const fields = parsed.meta.fields || [];
      
      for (const field of fields) {
        const values = parsed.data.map((row: any) => row[field]).filter(Boolean);
        summary[field] = {
          count: values.length,
          unique: new Set(values).size,
          sample: values.slice(0, 3),
        };
      }
      result.summary = summary;
    }
    
    return result;
  } catch (error: any) {
    throw new Error(`CSV analysis failed: ${error.message}`);
  }
}

async function mergeDatasets(args: any) {
  const { file1, file2, outputPath, joinType, joinKey } = MergeDatasetsInputSchema.parse(args);
  
  try {
    const content1 = await fs.readFile(file1, "utf-8");
    const content2 = await fs.readFile(file2, "utf-8");
    
    const data1 = Papa.parse(content1, { header: true }).data as any[];
    const data2 = Papa.parse(content2, { header: true }).data as any[];
    
    // Create lookup map for data2
    const lookup = new Map();
    for (const row of data2) {
      lookup.set(row[joinKey], row);
    }
    
    const merged: any[] = [];
    
    for (const row1 of data1) {
      const key = row1[joinKey];
      const row2 = lookup.get(key);
      
      if (joinType === "inner" && row2) {
        merged.push({ ...row1, ...row2 });
      } else if (joinType === "left") {
        merged.push({ ...row1, ...(row2 || {}) });
      }
    }
    
    const csv = Papa.unparse(merged);
    await fs.writeFile(outputPath, csv, "utf-8");
    
    return {
      success: true,
      outputPath,
      rows: merged.length,
      columns: Object.keys(merged[0] || {}).length,
    };
  } catch (error: any) {
    throw new Error(`Dataset merge failed: ${error.message}`);
  }
}

async function dataValidation(args: any) {
  const { filePath, schema, format } = DataValidationInputSchema.parse(args);
  
  try {
    let data: any[];
    
    if (format === "json") {
      const content = await fs.readFile(filePath, "utf-8");
      data = JSON.parse(content);
    } else {
      const content = await fs.readFile(filePath, "utf-8");
      data = Papa.parse(content, { header: true }).data as any[];
    }
    
    const errors: any[] = [];
    const valid: any[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowErrors: any[] = [];
      
      for (const [key, rules] of Object.entries(schema)) {
        const value = row[key];
        const ruleObj = rules as any;
        
        if (ruleObj.required && !value) {
          rowErrors.push({ field: key, error: "Required field missing" });
        }
        
        if (ruleObj.type && typeof value !== ruleObj.type) {
          rowErrors.push({ field: key, error: `Expected ${ruleObj.type}, got ${typeof value}` });
        }
        
        if (ruleObj.min && value < ruleObj.min) {
          rowErrors.push({ field: key, error: `Value below minimum: ${ruleObj.min}` });
        }
        
        if (ruleObj.max && value > ruleObj.max) {
          rowErrors.push({ field: key, error: `Value above maximum: ${ruleObj.max}` });
        }
      }
      
      if (rowErrors.length > 0) {
        errors.push({ row: i, errors: rowErrors });
      } else {
        valid.push(row);
      }
    }
    
    return {
      success: errors.length === 0,
      totalRows: data.length,
      validRows: valid.length,
      errorRows: errors.length,
      errors: errors.slice(0, 10), // First 10 errors
      validationRate: ((valid.length / data.length) * 100).toFixed(2) + "%",
    };
  } catch (error: any) {
    throw new Error(`Data validation failed: ${error.message}`);
  }
}

// ============================================================================
// ADVANCED FEATURES - Code Intelligence
// ============================================================================

const FindFunctionsInputSchema = z.object({
  filePath: z.string(),
  language: z.enum(["javascript", "typescript", "python", "go", "rust"]).optional(),
});

const CountLocInputSchema = z.object({
  directory: z.string(),
  extensions: z.array(z.string()).optional(),
});

const ComplexityAnalysisInputSchema = z.object({
  filePath: z.string(),
});

async function findFunctions(args: any) {
  const { filePath, language } = FindFunctionsInputSchema.parse(args);
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const functions: any[] = [];
    
    // JavaScript/TypeScript patterns
    const jsPatterns = [
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/g,
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/g,
      /async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    ];
    
    // Python patterns
    const pyPatterns = [
      /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      /async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    ];
    
    const patterns = language === "python" ? pyPatterns : jsPatterns;
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        functions.push({
          name: match[1],
          line: content.substring(0, match.index).split("\n").length,
          type: pattern.toString().includes("async") ? "async" : "sync",
        });
      }
    }
    
    return {
      totalFunctions: functions.length,
      functions: functions.slice(0, 50), // First 50
      asyncCount: functions.filter(f => f.type === "async").length,
      syncCount: functions.filter(f => f.type === "sync").length,
    };
  } catch (error: any) {
    throw new Error(`Function extraction failed: ${error.message}`);
  }
}

async function countLoc(args: any) {
  const { directory, extensions } = CountLocInputSchema.parse(args);
  
  try {
    const exts = extensions || ["js", "ts", "py", "go", "rs", "java", "cpp"];
    const pattern = `**/*.{${exts.join(",")}}`;
    
    const files = await fg(pattern, {
      cwd: directory,
      ignore: ["node_modules/**", "dist/**", "build/**", ".git/**"],
    });
    
    const stats: any = {
      totalFiles: files.length,
      totalLines: 0,
      totalCode: 0,
      totalComments: 0,
      totalBlank: 0,
      byExtension: {},
    };
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n");
      
      const ext = path.extname(file).substring(1);
      if (!stats.byExtension[ext]) {
        stats.byExtension[ext] = { files: 0, lines: 0, code: 0 };
      }
      
      let code = 0, comments = 0, blank = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) blank++;
        else if (trimmed.startsWith("//") || trimmed.startsWith("#")) comments++;
        else code++;
      }
      
      stats.totalLines += lines.length;
      stats.totalCode += code;
      stats.totalComments += comments;
      stats.totalBlank += blank;
      
      stats.byExtension[ext].files++;
      stats.byExtension[ext].lines += lines.length;
      stats.byExtension[ext].code += code;
    }
    
    return stats;
  } catch (error: any) {
    throw new Error(`LOC count failed: ${error.message}`);
  }
}

async function complexityAnalysis(args: any) {
  const { filePath } = ComplexityAnalysisInputSchema.parse(args);
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    
    // Simple cyclomatic complexity calculation
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\?\s*.*\s*:/g,
    ];
    
    let complexity = 1; // Base complexity
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    }
    
    const lines = content.split("\n").length;
    const functions = (content.match(/function\s+\w+|=>\s*{|def\s+\w+/g) || []).length;
    
    return {
      cyclomaticComplexity: complexity,
      complexityPerFunction: functions > 0 ? (complexity / functions).toFixed(2) : 0,
      totalLines: lines,
      totalFunctions: functions,
      rating: complexity < 10 ? "Simple" : complexity < 20 ? "Moderate" : complexity < 50 ? "Complex" : "Very Complex",
    };
  } catch (error: any) {
    throw new Error(`Complexity analysis failed: ${error.message}`);
  }
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const tools: any[] = [
  {
    name: "fetch_url",
    description: "Fetches content from a URL using various HTTP methods.",
    inputSchema: FetchUrlInputSchema,
  },
  {
    name: "scrape_webpage",
    description: "Scrapes a webpage using CSS selectors to extract data.",
    inputSchema: ScrapeWebpageInputSchema,
  },
  {
    name: "search_files",
    description: "Searches for files in the filesystem.",
    inputSchema: SearchFilesInputSchema,
  },
  {
    name: "read_file_content",
    description: "Reads the content of a file.",
    inputSchema: ReadFileContentInputSchema,
  },
  {
    name: "write_file_content",
    description: "Writes content to a file.",
    inputSchema: WriteFileContentInputSchema,
  },
  {
    name: "watch_directory",
    description: "Watches a directory for changes.",
    inputSchema: WatchDirectoryInputSchema,
  },
  {
    name: "process_json",
    description: "Processes JSON data.",
    inputSchema: ProcessJsonInputSchema,
  },
  {
    name: "convert_format",
    description: "Converts data from one format to another.",
    inputSchema: ConvertFormatInputSchema,
  },
  {
    name: "hash_data",
    description: "Hashes data using various algorithms.",
    inputSchema: HashDataInputSchema,
  },
  {
    name: "encrypt_decrypt",
    description: "Encrypts or decrypts data.",
    inputSchema: EncryptDecryptInputSchema,
  },
  {
    name: "generate_code",
    description: "Generates various types of code or data.",
    inputSchema: GenerateCodeInputSchema,
  },
  {
    name: "analyze_code",
    description: "Analyzes source code for various properties.",
    inputSchema: AnalyzeCodeInputSchema,
  },
  {
    name: "get_system_info",
    description: "Gets information about the system.",
    inputSchema: GetSystemInfoInputSchema,
  },
  {
    name: "execute_command",
    description: "Executes a shell command.",
    inputSchema: ExecuteCommandInputSchema,
  },
  {
    name: "query_sqlite",
    description: "Queries a SQLite database.",
    inputSchema: QuerySqliteInputSchema,
  },
  {
    name: "time_operations",
    description: "Performs time-related operations.",
    inputSchema: TimeOperationsInputSchema,
  },
  {
    name: "git_clone",
    description: "Clones a git repository.",
    inputSchema: GitCloneInputSchema,
  },
  {
    name: "git_status",
    description: "Gets the status of a git repository.",
    inputSchema: GitStatusInputSchema,
  },
  {
    name: "git_add",
    description: "Adds files to a git repository.",
    inputSchema: GitAddInputSchema,
  },
  {
    name: "git_commit",
    description: "Commits changes to a git repository.",
    inputSchema: GitCommitInputSchema,
  },
  {
    name: "git_diff",
    description: "Shows the differences in a git repository.",
    inputSchema: GitDiffInputSchema,
  },
  {
    name: "git_log",
    description: "Shows commit history with various formats and limits.",
    inputSchema: GitLogInputSchema,
  },
  {
    name: "git_branch",
    description: "Manages git branches (list, create, delete, switch).",
    inputSchema: GitBranchInputSchema,
  },
  {
    name: "git_push",
    description: "Pushes changes to a remote repository.",
    inputSchema: GitPushInputSchema,
  },
  {
    name: "git_pull",
    description: "Pulls changes from a remote repository.",
    inputSchema: GitPullInputSchema,
  },
  {
    name: "batch_read_files",
    description: "Reads multiple files matching patterns with file info.",
    inputSchema: BatchReadFilesInputSchema,
  },
  {
    name: "batch_process",
    description: "Batch file operations (rename, move, delete, copy).",
    inputSchema: BatchProcessInputSchema,
  },
  {
    name: "find_duplicates",
    description: "Finds duplicate files by content hash.",
    inputSchema: FindDuplicatesInputSchema,
  },
  {
    name: "download_file",
    description: "Downloads a file from a URL to local filesystem.",
    inputSchema: DownloadFileInputSchema,
  },
  {
    name: "text_search",
    description: "Searches for text patterns across multiple files with context.",
    inputSchema: TextSearchInputSchema,
  },
  {
    name: "text_replace",
    description: "Replaces text in a file with support for regex and dry-run.",
    inputSchema: TextReplaceInputSchema,
  },
  {
    name: "resize_image",
    description: "Resize and compress images with quality control.",
    inputSchema: ResizeImageInputSchema,
  },
  {
    name: "optimize_image",
    description: "Optimize images for web (reduce file size).",
    inputSchema: OptimizeImageInputSchema,
  },
  {
    name: "get_image_metadata",
    description: "Extract metadata from images (dimensions, format, EXIF).",
    inputSchema: GetImageMetadataInputSchema,
  },
  {
    name: "analyze_csv",
    description: "Analyze CSV files (stats, preview, column types).",
    inputSchema: AnalyzeCsvInputSchema,
  },
  {
    name: "merge_datasets",
    description: "Merge two datasets with join operations.",
    inputSchema: MergeDatasetsInputSchema,
  },
  {
    name: "data_validation",
    description: "Validate data against schema rules.",
    inputSchema: DataValidationInputSchema,
  },
  {
    name: "find_functions",
    description: "Extract all functions from code files.",
    inputSchema: FindFunctionsInputSchema,
  },
  {
    name: "count_loc",
    description: "Count lines of code by language/extension.",
    inputSchema: CountLocInputSchema,
  },
  {
    name: "complexity_analysis",
    description: "Analyze code complexity (cyclomatic complexity).",
    inputSchema: ComplexityAnalysisInputSchema,
  },
  {
    name: "search_web",
    description: "Search the web using DuckDuckGo, Google, or Bing (no API key needed).",
    inputSchema: SearchWebInputSchema,
  },
  {
    name: "search_reddit",
    description: "Search Reddit posts and discussions (no API key needed).",
    inputSchema: SearchRedditInputSchema,
  },
  {
    name: "search_github",
    description: "Search GitHub repositories, code, issues, and users.",
    inputSchema: SearchGitHubInputSchema,
  },
  {
    name: "search_stackoverflow",
    description: "Search Stack Overflow questions and answers.",
    inputSchema: SearchStackOverflowInputSchema,
  },
  {
    name: "search_npm",
    description: "Search npm packages with scores and metadata.",
    inputSchema: SearchNpmInputSchema,
  },
  {
    name: "get_npm_package",
    description: "Get detailed information about an npm package.",
    inputSchema: GetNpmPackageInputSchema,
  },
  {
    name: "search_docs",
    description: "Search developer documentation (MDN, DevDocs, Node.js, Python, React).",
    inputSchema: SearchDocsInputSchema,
  },
  {
    name: "get_github_repo",
    description: "Get detailed GitHub repository information.",
    inputSchema: GetGitHubRepoInputSchema,
  },
  {
    name: "get_github_issues",
    description: "Get issues from a GitHub repository.",
    inputSchema: GetGitHubIssuesInputSchema,
  },
  {
    name: "crawl_webpage",
    description: "Crawl a website and extract links and content from multiple pages (no API key needed).",
    inputSchema: CrawlWebpageInputSchema,
  },
  {
    name: "extract_links",
    description: "Extract all links from a webpage with filtering options.",
    inputSchema: ExtractLinksInputSchema,
  },
  {
    name: "search_pypi",
    description: "Search Python packages on PyPI (no API key needed).",
    inputSchema: SearchPyPiInputSchema,
  },
  {
    name: "get_pypi_package",
    description: "Get detailed information about a PyPI package.",
    inputSchema: GetPyPiPackageInputSchema,
  },
  {
    name: "search_crates_io",
    description: "Search Rust crates on Crates.io (no API key needed).",
    inputSchema: SearchCratesIoInputSchema,
  },
  {
    name: "get_crate",
    description: "Get detailed information about a Rust crate.",
    inputSchema: GetCrateInputSchema,
  },
  {
    name: "search_docker_hub",
    description: "Search Docker images on Docker Hub (no API key needed).",
    inputSchema: SearchDockerHubInputSchema,
  },
  {
    name: "get_docker_image",
    description: "Get detailed information about a Docker image.",
    inputSchema: GetDockerImageInputSchema,
  },
  {
    name: "search_openrouter",
    description: "Search AI models on OpenRouter (no API key needed).",
    inputSchema: SearchOpenRouterInputSchema,
  },
  {
    name: "get_model_info",
    description: "Get detailed information about AI models from OpenRouter or Hugging Face.",
    inputSchema: GetModelInfoInputSchema,
  },
  {
    name: "search_huggingface",
    description: "Search models, datasets, and spaces on Hugging Face (no API key needed).",
    inputSchema: SearchHuggingFaceInputSchema,
  },
  {
    name: "search_devto",
    description: "Search dev.to articles and tutorials (no API key needed).",
    inputSchema: SearchDevToInputSchema,
  },
  {
    name: "search_medium",
    description: "Search Medium articles by query or tag.",
    inputSchema: SearchMediumInputSchema,
  },
  {
    name: "search_awesome_lists",
    description: "Search GitHub awesome lists for curated resources.",
    inputSchema: SearchAwesomeListsInputSchema,
  },
  {
    name: "get_github_trending",
    description: "Get trending repositories on GitHub by language and time period.",
    inputSchema: GetGitHubTrendingInputSchema,
  },
  {
    name: "search_packagist",
    description: "Search PHP packages on Packagist (no API key needed).",
    inputSchema: SearchPackagistInputSchema,
  },
  {
    name: "search_maven",
    description: "Search Java artifacts on Maven Central (no API key needed).",
    inputSchema: SearchMavenInputSchema,
  },
  {
    name: "search_go_packages",
    description: "Search Go packages on pkg.go.dev (no API key needed).",
    inputSchema: SearchGoPackagesInputSchema,
  },
  {
    name: "get_api_info",
    description: "Get information about public APIs from various sources.",
    inputSchema: GetApiInfoInputSchema,
  },
  {
    name: "query_postgres",
    description: "Execute a query on a PostgreSQL database. Requires connection string.",
    inputSchema: {
      type: "object",
      properties: {
        connectionString: { type: "string", description: "PostgreSQL connection string (postgres://user:pass@host:port/db)" },
        query: { type: "string", description: "SQL query to execute" },
        params: { type: "array", items: { type: "string" }, description: "Query parameters" },
      },
      required: ["connectionString", "query"],
    },
  },
  {
    name: "query_mongodb",
    description: "Execute a query on a MongoDB database. Requires connection string.",
    inputSchema: {
      type: "object",
      properties: {
        connectionString: { type: "string", description: "MongoDB connection string (mongodb://...)" },
        database: { type: "string", description: "Database name" },
        collection: { type: "string", description: "Collection name" },
        operation: { type: "string", enum: ["find", "findOne", "count", "aggregate"], description: "Operation type" },
        query: { type: "object", description: "Query filter object" },
        options: { type: "object", description: "Query options (limit, sort, etc.)" },
      },
      required: ["connectionString", "database", "collection", "operation"],
    },
  },
  {
    name: "aws_s3_list",
    description: "List objects in an AWS S3 bucket. Requires AWS credentials in environment.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "S3 bucket name" },
        prefix: { type: "string", description: "Object key prefix filter" },
        maxKeys: { type: "number", description: "Maximum number of keys to return" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "aws_lambda_invoke",
    description: "Invoke an AWS Lambda function. Requires AWS credentials in environment.",
    inputSchema: {
      type: "object",
      properties: {
        functionName: { type: "string", description: "Lambda function name or ARN" },
        payload: { type: "object", description: "JSON payload to send to the function" },
        region: { type: "string", description: "AWS region (default: us-east-1)" },
      },
      required: ["functionName"],
    },
  },
  // New Database Tools
  {
    name: "query_dynamodb",
    description: "Query AWS DynamoDB table. Operations: get, put, scan, query.",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "DynamoDB table name" },
        operation: { type: "string", enum: ["get", "put", "scan", "query"], description: "Operation type" },
        key: { type: "object", description: "Primary key for get operation" },
        item: { type: "object", description: "Item to put" },
        filterExpression: { type: "string", description: "Filter/KeyCondition expression" },
        expressionValues: { type: "object", description: "Expression attribute values" },
        region: { type: "string", description: "AWS region" },
      },
      required: ["tableName", "operation"],
    },
  },
  {
    name: "query_redis",
    description: "Execute Redis commands. Commands: get, set, del, hget, hset, hgetall, lpush, lrange, keys, ttl.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Redis connection URL (default: redis://localhost:6379)" },
        command: { type: "string", enum: ["get", "set", "del", "hget", "hset", "hgetall", "lpush", "lrange", "keys", "ttl"] },
        key: { type: "string", description: "Redis key" },
        value: { type: "string", description: "Value for set operations" },
        field: { type: "string", description: "Hash field for hget/hset" },
        ttl: { type: "number", description: "TTL in seconds for setEx" },
      },
      required: ["command", "key"],
    },
  },
  {
    name: "query_mysql",
    description: "Execute MySQL queries.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "MySQL host" },
        user: { type: "string", description: "MySQL user" },
        password: { type: "string", description: "MySQL password" },
        database: { type: "string", description: "Database name" },
        query: { type: "string", description: "SQL query to execute" },
        params: { type: "array", description: "Query parameters" },
      },
      required: ["host", "user", "database", "query"],
    },
  },
  // More AWS Tools
  {
    name: "aws_ec2_describe",
    description: "Describe EC2 instances.",
    inputSchema: {
      type: "object",
      properties: {
        instanceIds: { type: "array", items: { type: "string" }, description: "Instance IDs to describe" },
        filters: { type: "array", description: "Filters for the query" },
        region: { type: "string", description: "AWS region" },
      },
    },
  },
  {
    name: "aws_sqs_send",
    description: "Send a message to an SQS queue.",
    inputSchema: {
      type: "object",
      properties: {
        queueUrl: { type: "string", description: "SQS queue URL" },
        messageBody: { type: "string", description: "Message body" },
        delaySeconds: { type: "number", description: "Delay in seconds" },
        region: { type: "string", description: "AWS region" },
      },
      required: ["queueUrl", "messageBody"],
    },
  },
  {
    name: "aws_sqs_receive",
    description: "Receive messages from an SQS queue.",
    inputSchema: {
      type: "object",
      properties: {
        queueUrl: { type: "string", description: "SQS queue URL" },
        maxMessages: { type: "number", description: "Max messages to receive (1-10)" },
        waitTimeSeconds: { type: "number", description: "Long polling wait time" },
        region: { type: "string", description: "AWS region" },
      },
      required: ["queueUrl"],
    },
  },
  // GCP Tools
  {
    name: "gcp_storage_list",
    description: "List objects in a GCP Cloud Storage bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "GCS bucket name" },
        prefix: { type: "string", description: "Object prefix filter" },
        maxResults: { type: "number", description: "Max results to return" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "gcp_bigquery",
    description: "Execute a BigQuery SQL query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL query to execute" },
        projectId: { type: "string", description: "GCP project ID" },
        location: { type: "string", description: "BigQuery location (e.g., US, EU)" },
      },
      required: ["query"],
    },
  },
  // AI Model Tools
  {
    name: "ai_complete",
    description: "Generate text completion using AI models (OpenAI, Anthropic, Groq).",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["openai", "anthropic", "groq"], description: "AI provider" },
        model: { type: "string", description: "Model name (optional, uses default)" },
        prompt: { type: "string", description: "User prompt" },
        systemPrompt: { type: "string", description: "System prompt (optional)" },
        maxTokens: { type: "number", description: "Max tokens to generate" },
        temperature: { type: "number", description: "Temperature (0-2)" },
      },
      required: ["provider", "prompt"],
    },
  },
  {
    name: "ai_embed",
    description: "Generate text embeddings using AI models.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["openai"], description: "AI provider" },
        model: { type: "string", description: "Embedding model name" },
        text: { type: "string", description: "Text to embed" },
      },
      required: ["provider", "text"],
    },
  },
];

const server = new Server(
  {
    name: "eternos",
    version: "2.4.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case "fetch_url":
        result = await fetchUrl(args);
        break;
      case "scrape_webpage":
        result = await scrapeWebpage(args);
        break;
      case "search_files":
        result = await searchFiles(args);
        break;
      case "read_file_content":
        result = await readFileContent(args);
        break;
      case "write_file_content":
        result = await writeFileContent(args);
        break;
      case "watch_directory":
        result = await watchDirectory(args);
        break;
      case "process_json":
        result = await processJson(args);
        break;
      case "convert_format":
        result = await convertFormat(args);
        break;
      case "hash_data":
        result = await hashData(args);
        break;
      case "encrypt_decrypt":
        result = await encryptDecrypt(args);
        break;
      case "generate_code":
        result = await generateCode(args);
        break;
      case "analyze_code":
        result = await analyzeCode(args);
        break;
      case "get_system_info":
        result = await getSystemInfo(args);
        break;
      case "time_operations":
        result = await timeOperations(args);
        break;
      case "execute_command":
        result = await executeCommand(args);
        break;
      case "query_sqlite":
        result = await querySqlite(args);
        break;
      case "git_clone":
        result = await gitClone(args);
        break;
      case "git_status":
        result = await gitStatus(args);
        break;
      case "git_add":
        result = await gitAdd(args);
        break;
      case "git_commit":
        result = await gitCommit(args);
        break;
      case "git_diff":
        result = await gitDiff(args);
        break;
      case "git_log":
        result = await gitLog(args);
        break;
      case "git_branch":
        result = await gitBranch(args);
        break;
      case "git_push":
        result = await gitPush(args);
        break;
      case "git_pull":
        result = await gitPull(args);
        break;
      case "batch_read_files":
        result = await batchReadFiles(args);
        break;
      case "batch_process":
        result = await batchProcess(args);
        break;
      case "find_duplicates":
        result = await findDuplicates(args);
        break;
      case "download_file":
        result = await downloadFile(args);
        break;
      case "text_search":
        result = await textSearch(args);
        break;
      case "text_replace":
        result = await textReplace(args);
        break;
      case "resize_image":
        result = await resizeImage(args);
        break;
      case "optimize_image":
        result = await optimizeImage(args);
        break;
      case "get_image_metadata":
        result = await getImageMetadata(args);
        break;
      case "analyze_csv":
        result = await analyzeCsv(args);
        break;
      case "merge_datasets":
        result = await mergeDatasets(args);
        break;
      case "data_validation":
        result = await dataValidation(args);
        break;
      case "find_functions":
        result = await findFunctions(args);
        break;
      case "count_loc":
        result = await countLoc(args);
        break;
      case "complexity_analysis":
        result = await complexityAnalysis(args);
        break;
      case "search_web":
        result = await searchWeb(args);
        break;
      case "crawl_webpage":
        result = await crawlWebpage(args);
        break;
      case "extract_links":
        result = await extractLinks(args);
        break;
      case "search_reddit":
        result = await searchReddit(args);
        break;
      case "search_github":
        result = await searchGitHub(args);
        break;
      case "search_stackoverflow":
        result = await searchStackOverflow(args);
        break;
      case "search_npm":
        result = await searchNpm(args);
        break;
      case "get_npm_package":
        result = await getNpmPackage(args);
        break;
      case "search_docs":
        result = await searchDocs(args);
        break;
      case "get_github_repo":
        result = await getGitHubRepo(args);
        break;
      case "get_github_issues":
        result = await getGitHubIssues(args);
        break;
      case "search_pypi":
        result = await searchPyPi(args);
        break;
      case "get_pypi_package":
        result = await getPyPiPackage(args);
        break;
      case "search_crates_io":
        result = await searchCratesIo(args);
        break;
      case "get_crate":
        result = await getCrate(args);
        break;
      case "search_docker_hub":
        result = await searchDockerHub(args);
        break;
      case "get_docker_image":
        result = await getDockerImage(args);
        break;
      case "search_openrouter":
        result = await searchOpenRouter(args);
        break;
      case "get_model_info":
        result = await getModelInfo(args);
        break;
      case "search_huggingface":
        result = await searchHuggingFace(args);
        break;
      case "search_devto":
        result = await searchDevTo(args);
        break;
      case "search_medium":
        result = await searchMedium(args);
        break;
      case "search_awesome_lists":
        result = await searchAwesomeLists(args);
        break;
      case "get_github_trending":
        result = await getGitHubTrending(args);
        break;
      case "search_packagist":
        result = await searchPackagist(args);
        break;
      case "search_maven":
        result = await searchMaven(args);
        break;
      case "search_go_packages":
        result = await searchGoPackages(args);
        break;
      case "get_api_info":
        result = await getApiInfo(args);
        break;
      case "query_postgres":
        result = await queryPostgres(args);
        break;
      case "query_mongodb":
        result = await queryMongodb(args);
        break;
      case "aws_s3_list":
        result = await awsS3List(args);
        break;
      case "aws_lambda_invoke":
        result = await awsLambdaInvoke(args);
        break;
      case "query_dynamodb":
        result = await queryDynamodb(args);
        break;
      case "query_redis":
        result = await queryRedis(args);
        break;
      case "query_mysql":
        result = await queryMysql(args);
        break;
      case "aws_ec2_describe":
        result = await awsEc2Describe(args);
        break;
      case "aws_sqs_send":
        result = await awsSqsSend(args);
        break;
      case "aws_sqs_receive":
        result = await awsSqsReceive(args);
        break;
      case "gcp_storage_list":
        result = await gcpStorageList(args);
        break;
      case "gcp_bigquery":
        result = await gcpBigQuery(args);
        break;
      case "ai_complete":
        result = await aiComplete(args);
        break;
      case "ai_embed":
        result = await aiEmbed(args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("╔════════════════════════════════════════════════════════════╗");
  console.error("║   🚀 Eternos MCP Server v2.4 - Advanced Developer Tools   ║");
  console.error("║   📦 81 Powerful Tools for AI Assistants                  ║");
  console.error("║   🌟 By Recoder - https://recoder.xyz                     ║");
  console.error("╚════════════════════════════════════════════════════════════╝");
  console.error("📡 Connected via stdio transport");
  console.error("✨ Ready to assist!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
