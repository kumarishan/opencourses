export type CourseModeRoute = 'learn' | 'create'

export function encodeSectionFile(sectionFile: string): string {
  return encodeURIComponent(sectionFile)
}

export function decodeSectionParam(sectionParam: string): string {
  return decodeURIComponent(sectionParam)
}

export function buildCourseRoute(
  mode: CourseModeRoute,
  courseName: string,
  chapterId: string,
  sectionFile: string
): string {
  return `/${mode}/course/${courseName}/ch/${chapterId}/sec/${encodeSectionFile(sectionFile)}`
}
