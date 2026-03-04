/**
 * Kapsel Task Types
 * Corresponds to §7.2 of the Kapsel Protocol Specification
 */

import type { ToolCall } from './agent.js';

export type TaskStatus =
  | 'queued'
  | 'routed'
  | 'planning'
  | 'confirmed'
  | 'executing'
  | 'verifying'
  | 'complete'
  | 'blocked'
  | 'escalated';

export type TaskType =
  | 'coding'
  | 'deployment'
  | 'research'
  | 'ops'
  | 'automation'
  | 'monitoring'
  | 'report'
  | string; // extensible

export interface TaskSummary {
  id: string;
  title: string;
  type: TaskType;
  context?: unknown;
}

export interface Task extends TaskSummary {
  status: TaskStatus;
  assignedAgentId?: string;
  plan?: import('./agent.js').Plan;
  steps: TaskStep[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  qualityScore?: number;
}

export interface TaskStep {
  index: number;
  description: string;
  toolCalls: ToolCall[];
  status: 'pending' | 'executing' | 'complete' | 'failed';
  verificationResult?: VerificationResult;
  startedAt?: number;
  completedAt?: number;
}

export interface VerificationResult {
  verified: boolean;
  method: string;
  evidence: string;
  confidence: number;
}
