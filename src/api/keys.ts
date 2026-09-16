import { queryOptions } from '@tanstack/vue-query'
import {
  fetchAssignmentDescription,
  fetchAssignments,
  fetchCourses,
  fetchModules,
  fetchNextDueAssignment,
  fetchPageBody,
} from './canvas'

/**
 * Hierarchical query keys for Canvas data, all nested under a shared
 * `['better-canvas']` namespace and per-Course `['better-canvas',
 * 'courses', courseId]` node, so any Course-owned query can be targeted
 * collectively with that prefix.
 */
export function courseQueryKey(courseId: number, ...scope: readonly unknown[]) {
  return ['better-canvas', 'courses', courseId, ...scope] as const
}

export const canvasQueryOptions = {
  courses: (token: string) =>
    queryOptions({
      queryKey: ['better-canvas', 'courses'] as const,
      queryFn: () => fetchCourses(token),
    }),
  modules: (courseId: number, token: string) =>
    queryOptions({
      queryKey: courseQueryKey(courseId, 'modules'),
      queryFn: () => fetchModules(token, courseId),
    }),
  assignments: (courseId: number, token: string) =>
    queryOptions({
      queryKey: courseQueryKey(courseId, 'assignments'),
      queryFn: () => fetchAssignments(token, courseId),
    }),
  nextDueAssignment: (courseId: number, token: string) =>
    queryOptions({
      queryKey: courseQueryKey(courseId, 'assignments', 'next-due'),
      queryFn: () => fetchNextDueAssignment(token, courseId),
    }),
  pageBody: (courseId: number, pageUrl: string, token: string) =>
    queryOptions({
      queryKey: courseQueryKey(courseId, 'pages', pageUrl),
      queryFn: () => fetchPageBody(token, courseId, pageUrl),
    }),
  assignmentDescription: (
    courseId: number,
    assignmentId: number,
    token: string,
  ) =>
    queryOptions({
      queryKey: courseQueryKey(
        courseId,
        'assignments',
        assignmentId,
        'description',
      ),
      queryFn: () => fetchAssignmentDescription(token, courseId, assignmentId),
    }),
}
