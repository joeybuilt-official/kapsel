/**
 * Agent extension entry point.
 * Replace this with your actual implementation.
 */

import type {
  KapselSDK,
  TaskSummary,
  Task,
  Plan,
  StepResult,
  ShouldActivateResult,
} from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  // Agents don't need to register tools here unless providing them to other agents.
  // Planning and execution happen in shouldActivate / plan / executeStep.
}

export async function shouldActivate(
  task: TaskSummary,
  sdk: KapselSDK
): Promise<ShouldActivateResult> {
  // Return true + confidence if this agent should handle this task.
  // Be specific — the host picks the highest confidence agent.
  const handled = ['ops', 'deployment', 'monitoring'].includes(task.type);
  return { activate: handled, confidence: handled ? 0.85 : 0.0 };
}

export async function plan(task: Task, sdk: KapselSDK): Promise<Plan> {
  return {
    goalRestatement: `Handle: ${task.title}`,
    steps: [
      {
        index: 0,
        description: 'Execute the task',
        tools: [],
        dependsOnPrevious: false,
        isOneWayDoor: false,
      },
    ],
    confidence: 0.8,
    oneWayDoors: [],
    risks: [],
  };
}

export async function executeStep(
  task: Task,
  _plan: Plan,
  stepIndex: number,
  sdk: KapselSDK
): Promise<StepResult> {
  return {
    stepIndex,
    success: true,
    summary: `Completed step ${stepIndex}`,
    toolCalls: [],
    canContinue: true,
  };
}

export async function deactivate(): Promise<void> {}
