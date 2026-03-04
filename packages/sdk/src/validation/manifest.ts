/**
 * Manifest validation utilities.
 * Used by the CLI and hosts to validate kapsel.json.
 */

import type { KapselManifest, ExtensionType, CapabilityToken } from '../types/manifest.js';

const VALID_TYPES: ExtensionType[] = ['agent', 'skill', 'channel', 'tool', 'mcp-server'];

const STANDARD_CAPABILITIES = new Set<string>([
  'memory:read',
  'memory:write',
  'memory:delete',
  'channel:send',
  'channel:send-direct',
  'channel:receive',
  'schedule:register',
  'schedule:manage',
  'ui:register-widget',
  'ui:notify',
  'tasks:create',
  'tasks:read',
  'tasks:read-all',
  'events:subscribe',
  'events:publish',
  'storage:read',
  'storage:write',
]);

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateManifest(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ field: 'root', message: 'Manifest must be a JSON object' }] };
  }

  const m = raw as Record<string, unknown>;

  // Required fields
  if (typeof m['kapsel'] !== 'string' || !isSemver(m['kapsel'])) {
    errors.push({ field: 'kapsel', message: 'Must be a valid semver string (e.g. "0.2.0")' });
  }

  if (typeof m['name'] !== 'string' || !isValidPackageName(m['name'])) {
    errors.push({ field: 'name', message: 'Must match @scope/name format (lowercase alphanumeric and hyphens)' });
  }

  if (typeof m['version'] !== 'string' || !isSemver(m['version'])) {
    errors.push({ field: 'version', message: 'Must be a valid semver string' });
  }

  if (!VALID_TYPES.includes(m['type'] as ExtensionType)) {
    errors.push({ field: 'type', message: `Must be one of: ${VALID_TYPES.join(', ')}` });
  }

  if (typeof m['entry'] !== 'string' || m['entry'].length === 0) {
    errors.push({ field: 'entry', message: 'Must be a non-empty string path to the entry point' });
  }

  if (!Array.isArray(m['capabilities'])) {
    errors.push({ field: 'capabilities', message: 'Must be an array of capability token strings' });
  } else {
    const caps = m['capabilities'] as unknown[];
    caps.forEach((cap, i) => {
      if (typeof cap !== 'string') {
        errors.push({ field: `capabilities[${i}]`, message: 'Each capability must be a string' });
      } else if (!isValidCapability(cap)) {
        errors.push({
          field: `capabilities[${i}]`,
          message: `Unknown capability token "${cap}". Must be a standard token or host:<hostname>:<capability> or connections:<service>`,
        });
      }
    });
  }

  if (typeof m['displayName'] !== 'string' || m['displayName'].length === 0) {
    errors.push({ field: 'displayName', message: 'Must be a non-empty string' });
  }

  if (typeof m['description'] !== 'string') {
    errors.push({ field: 'description', message: 'Must be a string' });
  } else if (m['description'].length > 280) {
    errors.push({ field: 'description', message: 'Must be 280 characters or fewer' });
  }

  if (typeof m['author'] !== 'string' || m['author'].length === 0) {
    errors.push({ field: 'author', message: 'Must be a non-empty string' });
  }

  if (typeof m['license'] !== 'string' || m['license'].length === 0) {
    errors.push({ field: 'license', message: 'Must be a valid SPDX license identifier' });
  }

  // Optional fields validation
  if (m['keywords'] !== undefined) {
    if (!Array.isArray(m['keywords'])) {
      errors.push({ field: 'keywords', message: 'Must be an array of strings' });
    } else if ((m['keywords'] as unknown[]).length > 10) {
      errors.push({ field: 'keywords', message: 'Max 10 keywords allowed' });
    }
  }

  if (m['screenshots'] !== undefined) {
    if (!Array.isArray(m['screenshots'])) {
      errors.push({ field: 'screenshots', message: 'Must be an array of HTTPS URLs' });
    } else if ((m['screenshots'] as unknown[]).length > 5) {
      errors.push({ field: 'screenshots', message: 'Max 5 screenshots allowed' });
    }
  }

  if (m['type'] === 'mcp-server' && m['mcpServer'] === undefined) {
    errors.push({ field: 'mcpServer', message: 'Required for mcp-server type extensions' });
  }

  return { valid: errors.length === 0, errors };
}

function isSemver(s: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(s);
}

function isValidPackageName(s: string): boolean {
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/.test(s);
}

function isValidCapability(token: string): boolean {
  if (STANDARD_CAPABILITIES.has(token)) return true;
  if (/^connections:[a-z0-9-]+$/.test(token)) return true;
  if (/^host:[a-z0-9-]+:[a-z0-9-:]+$/.test(token)) return true;
  return false;
}
