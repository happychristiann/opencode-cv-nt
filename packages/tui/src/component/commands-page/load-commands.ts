import { Global } from "@opencode-ai/core/global"
import { Glob } from "@opencode-ai/core/util/glob"
import path from "node:path"
import { containsPath } from "./paths"
import type { CommandFile } from "./types"

export async function loadCommandFiles(input: {
  directory: string
  worktree?: string
  commands: Map<string, { description?: string }>
}) {
  const roots = [...new Set([input.directory, input.worktree, Global.make().config].filter((root): root is string => !!root))]
  const discovered = await Promise.all(
    roots.flatMap((root) => [
      Glob.scan("{command,commands}/**/*.md", {
        cwd: root,
        absolute: true,
        dot: true,
        symlink: true,
      }),
      Glob.scan(".opencode/{command,commands}/**/*.md", {
        cwd: root,
        absolute: true,
        dot: true,
        symlink: true,
      }),
    ]),
  )

  return [...new Set(discovered.flat())]
    .map((absolute): CommandFile => {
      const root = roots.find((root) => containsPath(root, absolute)) ?? input.directory
      const relative = containsPath(input.directory, absolute)
        ? path.relative(input.directory, absolute).replaceAll("\\", "/")
        : absolute
      const name = path
        .relative(root, absolute)
        .replaceAll("\\", "/")
        .replace(/^(\.opencode\/)?(command|commands)\//, "")
        .replace(/\.md$/, "")
      return {
        name,
        relative,
        absolute,
        description: input.commands.get(name)?.description,
        scope: root === Global.make().config ? "user" : "project",
      }
    })
    .toSorted((left, right) => left.name.localeCompare(right.name))
}
