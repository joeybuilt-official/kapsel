/**
 * Agent: DevOps Agent
 * Handles deployment tasks and responds to failing CI builds.
 * Demonstrates: shouldActivate, plan with one-way doors, executeStep, onEscalation.
 */

import type {
  KapselSDK,
  TaskSummary,
  Task,
  Plan,
  StepResult,
  ShouldActivateResult,
  EscalationReason,
  EscalationResponse,
} from '@kapsel/sdk';
import { TOPICS } from '@kapsel/sdk';

const HANDLED_TASK_TYPES = new Set(['deployment', 'ops', 'build-fix']);

export async function activate(sdk: KapselSDK): Promise<void> {
  // Subscribe to build failure events
  sdk.events.subscribe(TOPICS.TASK_FAILED, async (payload) => {
    const p = payload as { taskId: string; reason: string };
    await sdk.memory.write({
      content: `Task ${p.taskId} failed: ${p.reason}`,
      tags: ['failure', 'history'],
    });
  });
}

export async function shouldActivate(
  task: TaskSummary,
  _sdk: KapselSDK
): Promise<ShouldActivateResult> {
  const isMatch = HANDLED_TASK_TYPES.has(task.type);
  const hasDevOpsKeywords =
    task.title.toLowerCase().includes('deploy') ||
    task.title.toLowerCase().includes('build') ||
    task.title.toLowerCase().includes('ci') ||
    task.title.toLowerCase().includes('rollback');

  if (isMatch) return { activate: true, confidence: 0.9, reason: `Task type "${task.type}" handled` };
  if (hasDevOpsKeywords) return { activate: true, confidence: 0.7, reason: 'Task title matches devops keywords' };
  return { activate: false, confidence: 0.0 };
}

export async function plan(task: Task, sdk: KapselSDK): Promise<Plan> {
  const isRollback = task.title.toLowerCase().includes('rollback');
  const isDeploy = task.type === 'deployment';

  if (isDeploy && !isRollback) {
    return {
      goalRestatement: `Deploy: ${task.title}`,
      steps: [
        { index: 0, description: 'Verify build is green', tools: ['check_build_status'], dependsOnPrevious: false, isOneWayDoor: false },
        { index: 1, description: 'Trigger Vercel deployment', tools: ['trigger_vercel_deploy'], dependsOnPrevious: true, isOneWayDoor: true },
        { index: 2, description: 'Wait for deployment and verify /health', tools: ['verify_deployment_health'], dependsOnPrevious: true, isOneWayDoor: false },
      ],
      confidence: 0.85,
      oneWayDoors: [{
        stepIndex: 1,
        type: 'service_restart',
        description: 'Triggering a Vercel deployment restarts the service.',
      }],
      risks: ['Deployment may fail if build has errors not caught by CI', 'Zero-downtime depends on Vercel configuration'],
    };
  }

  // Generic ops plan
  return {
    goalRestatement: task.title,
    steps: [
      { index: 0, description: 'Assess current state', tools: [], dependsOnPrevious: false, isOneWayDoor: false },
      { index: 1, description: 'Execute operation', tools: [], dependsOnPrevious: true, isOneWayDoor: false },
    ],
    confidence: 0.6,
    oneWayDoors: [],
    risks: ['Task type is broad; verify steps carefully before approving'],
  };
}

export async function executeStep(
  task: Task,
  plan: Plan,
  stepIndex: number,
  sdk: KapselSDK
): Promise<StepResult> {
  const step = plan.steps[stepIndex];
  if (!step) {
    return { stepIndex, success: false, summary: `Step ${stepIndex} not found in plan`, toolCalls: [], canContinue: false };
  }

  const toolCalls = [];

  try {
    if (step.tools.includes('check_build_status')) {
      const result = await sdk.tools.invoke<{ passing: boolean; sha: string }>(
        'check_build_status', { repo: extractRepo(task) }
      );
      toolCalls.push({ toolName: 'check_build_status', params: {}, result, durationMs: 500, success: true });
      if (!result.passing) {
        return { stepIndex, success: false, summary: 'Build is failing. Aborting deployment.', toolCalls, canContinue: false };
      }
    }

    if (step.tools.includes('trigger_vercel_deploy')) {
      const result = await sdk.tools.invoke<{ deploymentId: string; url: string }>(
        'trigger_vercel_deploy', { project: extractProject(task) }
      );
      toolCalls.push({ toolName: 'trigger_vercel_deploy', params: {}, result, durationMs: 2000, success: true });
      await sdk.storage.set('last_deployment_id', result.deploymentId);
    }

    if (step.tools.includes('verify_deployment_health')) {
      const deploymentId = await sdk.storage.get<string>('last_deployment_id');
      const result = await sdk.tools.invoke<{ healthy: boolean; statusCode: number }>(
        'verify_deployment_health', { deploymentId }
      );
      toolCalls.push({ toolName: 'verify_deployment_health', params: {}, result, durationMs: 5000, success: true });
      if (!result.healthy) {
        return { stepIndex, success: false, summary: `Health check failed (HTTP ${result.statusCode})`, toolCalls, canContinue: false };
      }
    }

    return {
      stepIndex,
      success: true,
      summary: `Completed: ${step.description}`,
      toolCalls,
      canContinue: true,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { stepIndex, success: false, summary: `Step failed: ${error}`, toolCalls, canContinue: false };
  }
}

export async function onEscalation(
  task: Task,
  reason: EscalationReason,
  sdk: KapselSDK
): Promise<EscalationResponse> {
  await sdk.channel.send({
    text: `⚠️ DevOps agent escalation on task "${task.title}": ${reason}`,
    priority: 'high',
  });

  await sdk.memory.write({
    content: `Escalation on task ${task.id} (${task.title}): ${reason}`,
    tags: ['escalation', 'devops'],
  });

  return { retry: false };
}

export async function deactivate(): Promise<void> {}

function extractRepo(task: Task): string {
  return (task.context as Record<string, string> | undefined)?.['repo'] ?? 'unknown';
}

function extractProject(task: Task): string {
  return (task.context as Record<string, string> | undefined)?.['project'] ?? 'unknown';
}
