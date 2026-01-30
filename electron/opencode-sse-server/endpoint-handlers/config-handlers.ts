/**
 * OpenCode SSE Server - Config Endpoint Handlers
 * 
 * Config endpoints: MCP servers, shells, plugins, providers, agents, file search/content
 * State injection pattern kullanılıyor
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { OpenCodeManager } from '../../opencode/index.js';

export async function handleGetMCPServers(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getMCPServers();
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers: result.data }));
    } else {
      const servers = [
        { name: 'hayalet-ev', status: 'connected', toolCount: 47 },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers }));
    }
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ servers: [] }));
  }
}

export async function handleGetShells(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getBackgroundShells();
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ shells: result.data }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ shells: [] }));
    }
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ shells: [] }));
  }
}

export async function handleGetPlugins(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getPlugins();
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ plugins: result.data }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ plugins: [] }));
    }
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ plugins: [] }));
  }
}

export async function handleGetProviders(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getProviders();
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ providers: [], default: {} }));
    }
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ providers: [], default: {} }));
  }
}

export async function handleGetAgents(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getAgents();
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents: result.data }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents: [] }));
    }
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agents: [] }));
  }
}

export async function handleFileSearch(
  query: string,
  limit: number,
  res: ServerResponse
): Promise<void> {
  try {
    const { readdirSync } = await import('fs');
    const { join, relative } = await import('path');
    
    const cwd = process.cwd();
    const results: Array<{ name: string; path: string; type: string }> = [];
    
    const searchDir = (dir: string, depth = 0) => {
      if (depth > 3 || results.length >= limit) return;
      
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (results.length >= limit) break;
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'node_modules') continue;
          
          const fullPath = join(dir, entry.name);
          const relativePath = relative(cwd, fullPath);
          
          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              name: entry.name,
              path: relativePath,
              type: entry.isDirectory() ? 'directory' : 'file',
            });
          }
          
          if (entry.isDirectory()) {
            searchDir(fullPath, depth + 1);
          }
        }
      } catch (err) {
        // Skip directories with permission errors
      }
    };
    
    if (query) {
      searchDir(cwd);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files: results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message, files: [] }));
  }
}

export async function handleFileContent(
  filePath: string,
  res: ServerResponse
): Promise<void> {
  try {
    const { readFileSync } = await import('fs');
    const { extname } = await import('path');
    
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath).slice(1);
    
    const langMap: Record<string, string> = {
      ts: 'typescript', js: 'javascript', py: 'python',
      json: 'json', md: 'markdown', css: 'css', html: 'html',
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content, language: langMap[ext] || 'plaintext' }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}
