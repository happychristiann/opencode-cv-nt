import { Global } from "@opencode-ai/core/global"
import path from "node:path"
import type { CommandScope } from "./types"

export function containsPath(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export function normalizeCommandName(value: string) {
  return value.trim().replace(/\.md$/i, "").replace(/^\/?/, "")
}

export function commandScopeRoot(scope: CommandScope, directory: string | undefined) {
  if (scope === "user") return Global.make().config
  return directory
}

export function commandScopePath(scope: CommandScope, directory: string, name: string) {
  const fileName = slugifyCommandName(name)
  if (scope === "user") return path.join(directory, "commands", `${fileName}.md`)
  return path.join(directory, ".opencode", "commands", `${fileName}.md`)
}

export function slugifyCommandName(name: string) {
  return name.trim().replace(/\s+/g, "-")
}

export function buildCommandMarkdown(description: string, content: string) {
  const frontmatter = description.trim() ? `---\ndescription: ${JSON.stringify(description.trim())}\n---\n` : ""
  return `${frontmatter}${content.trimStart()}`
}
