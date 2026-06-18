const PROJECT_KEY = "veyra_project_id";

export function getStoredProjectId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(PROJECT_KEY);
}

export function setStoredProjectId(projectId: string) {
  window.localStorage.setItem(PROJECT_KEY, projectId);
}