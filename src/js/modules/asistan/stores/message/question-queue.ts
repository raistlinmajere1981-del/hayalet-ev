/**
 * Message Store - Question Queue Management
 * 
 * Question queue: upsert, remove, get active, clear
 */

import type { QuestionEntry, QuestionState } from './types.ts';

export function upsertQuestion(
  state: QuestionState,
  entry: {
    id: string;
    messageId?: string;
    question?: unknown;
  }
): void {
  const existing = state.queue.find((q) => q.id === entry.id);

  const questionEntry: QuestionEntry = {
    ...entry,
    createdAt: existing?.createdAt || Date.now(),
  };

  if (existing) {
    Object.assign(existing, questionEntry);
  } else {
    state.queue.push(questionEntry);
  }

  // Auto-activate first in queue
  if (!state.active && state.queue.length > 0) {
    state.active = state.queue[0];
  }
}

export function removeQuestion(state: QuestionState, questionId: string): void {
  const index = state.queue.findIndex((q) => q.id === questionId);
  if (index === -1) return;

  state.queue.splice(index, 1);

  if (state.active?.id === questionId) {
    state.active = state.queue[0] || null;
  }
}

export function getActiveQuestion(state: QuestionState): QuestionEntry | null {
  return state.active;
}

export function getQuestionQueue(state: QuestionState): QuestionEntry[] {
  return [...state.queue];
}

export function clearQuestions(state: QuestionState): void {
  state.queue = [];
  state.active = null;
}
