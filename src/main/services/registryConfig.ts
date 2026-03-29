const DEFAULT_REGISTRY_REPO = 'opencourses-project/opencourses-registry'

export function getRegistryRepo(): string {
  const override = process.env.OPENCOURSES_REGISTRY_REPO?.trim()
  return override && override.length > 0 ? override : DEFAULT_REGISTRY_REPO
}

export function getRegistryContentsApiPath(): string {
  return `repos/${getRegistryRepo()}/contents/registry.json`
}

export function formatRegistryFetchError(message: string): string {
  const trimmed = message.trim()

  if (trimmed.includes('Not Found (HTTP 404)')) {
    return `Registry repo "${getRegistryRepo()}" or its registry.json file was not found. gh is installed, but the configured registry target returned 404. Set OPENCOURSES_REGISTRY_REPO=owner/repo to override it, or use the GitHub URL flow instead.`
  }

  return trimmed
}
