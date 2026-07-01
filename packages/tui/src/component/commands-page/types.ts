export type CommandScope = "project" | "user"

export const COMMAND_SCOPES: readonly CommandScope[] = ["project", "user"]

export type CommandFile = {
  name: string
  relative: string
  absolute: string
  description?: string
  scope: CommandScope
}
