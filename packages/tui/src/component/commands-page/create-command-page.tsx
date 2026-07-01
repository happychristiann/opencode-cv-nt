import { RGBA, TextareaRenderable, TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { For, Show, createSignal, onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useProject } from "../../context/project"
import { useExit } from "../../context/exit"
import { useSDK } from "../../context/sdk"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import { useBindings } from "../../keymap"
import { useToast } from "../../ui/toast"
import { buildCommandMarkdown, commandScopePath, commandScopeRoot, normalizeCommandName } from "./paths"
import { COMMAND_SCOPES } from "./types"
import type { CommandScope } from "./types"

type FocusField = "name" | "scope" | "description" | "content"

const FOCUS_FIELDS = ["name", "scope", "description", "content"] as const

export function CreateCommandPage(props: { onBack: () => void; onCreated: () => void }) {
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const project = useProject()
  const exit = useExit()
  const sync = useSync()
  const sdk = useSDK()
  const toast = useToast()
  const [state, setState] = createStore({
    saving: false,
    error: undefined as string | undefined,
  })
  let nameInput: TextareaRenderable | undefined
  let descriptionInput: TextareaRenderable | undefined
  let contentInput: TextareaRenderable | undefined
  const [focusedField, setFocusedField] = createSignal<FocusField>("name")
  const [scope, setScope] = createSignal<CommandScope>(COMMAND_SCOPES[0])
  const [scopeOpen, setScopeOpen] = createSignal(false)

  onMount(() => {
    setTimeout(() => nameInput?.focus(), 1)
  })

  const focusField = (field: FocusField) => {
    setFocusedField(field)
    if (field !== "scope") setScopeOpen(false)
    if (field === "name") nameInput?.focus()
    if (field === "description") descriptionInput?.focus()
    if (field === "content") contentInput?.focus()
  }

  useBindings(() => ({
    mode: "modal",
    target: () => {
      if (focusedField() === "description") return descriptionInput
      if (focusedField() === "content") return contentInput
      return nameInput
    },
    enabled: true,
    priority: 2,
    bindings: [
      {
        key: "ctrl+c",
        desc: "Exit",
        group: "Command",
        cmd: () => exit(),
      },
      {
        key: "up",
        desc: "Previous field",
        group: "Command",
        cmd: () => {
          if (focusedField() === "scope" && scopeOpen()) {
            setScope(scope() === "project" ? "user" : "project")
            return
          }
          if (focusedField() === "name") return
          focusField(FOCUS_FIELDS[FOCUS_FIELDS.indexOf(focusedField()) - 1])
        },
      },
      {
        key: "down",
        desc: "Next field",
        group: "Command",
        cmd: () => {
          if (focusedField() === "scope" && scopeOpen()) {
            setScope(scope() === "project" ? "user" : "project")
            return
          }
          if (focusedField() === "content") return
          focusField(FOCUS_FIELDS[FOCUS_FIELDS.indexOf(focusedField()) + 1])
        },
      },
      {
        key: "escape",
        desc: "Back to commands",
        group: "Command",
        cmd: () => {
          if (scopeOpen()) {
            setScopeOpen(false)
            return
          }
          props.onBack()
        },
      },
      {
        key: "ctrl+s",
        desc: "Save command",
        group: "Command",
        cmd: () => void create(),
      },
    ],
  }))

  const create = async () => {
    if (state.saving) return
    const name = normalizeCommandName(nameInput?.plainText ?? "")
    if (!name) {
      setState("error", "Name is required")
      return
    }
    const directory = commandScopeRoot(scope(), project.instance.directory())
    if (!directory) {
      setState("error", "No active directory")
      return
    }

    try {
      setState({ saving: true, error: undefined })
      const absolute = commandScopePath(scope(), directory, name)
      await mkdir(path.dirname(absolute), { recursive: true })
      await writeFile(absolute, buildCommandMarkdown(descriptionInput?.plainText ?? "", contentInput?.plainText ?? ""))
      const result = await sdk.client.command.list({ workspace: project.workspace.current() })
      sync.set("command", reconcile(result.data ?? []))
      toast.show({ variant: "success", message: `Custom command created successfully. Restart to use.` })
      props.onCreated()
    } catch (error) {
      setState({ saving: false, error: error instanceof Error ? error.message : String(error) })
      return
    }

    setState("saving", false)
  }

  return (
    <box
      width="100%"
      height="100%"
      flexGrow={1}
      minHeight={0}
      gap={1}
      backgroundColor={RGBA.fromInts(0, 0, 0, 255)}
    >
      <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingLeft={2} paddingRight={2} paddingTop={1} alignItems="center">
        <box flexDirection="column">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            New custom command
          </text>
          <text fg={theme.textMuted}>Create a markdown-backed command for this project or your user config</text>
        </box>
        <box onMouseDown={() => undefined} onMouseUp={props.onBack}>
          <text fg={theme.textMuted}>esc</text>
        </box>
      </box>
      <box flexDirection="column" gap={1} flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2} backgroundColor={RGBA.fromInts(0, 0, 0, 255)}>
        <Field label="Name" ref={(value) => (nameInput = value)} value="" onFocus={() => focusField("name")} />
        <ScopeField value={scope()} open={scopeOpen()} onOpenChange={setScopeOpen} onSelect={setScope} onFocus={() => focusField("scope")} />
        <Field label="Description" ref={(value) => (descriptionInput = value)} value="" onFocus={() => focusField("description")} />
        <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
          <text fg={theme.textMuted}>Content</text>
          <textarea
            ref={(value: TextareaRenderable) => {
              contentInput = value
            }}
            height={Math.max(8, dimensions().height - 18)}
            initialValue=""
            backgroundColor={theme.backgroundElement}
            focusedBackgroundColor={theme.backgroundElement}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.primary}
            placeholderColor={theme.textMuted}
            placeholder=""
            onMouseDown={() => focusField("content")}
          />
        </box>
        <Show when={state.error}>
          <text fg={theme.error}>{state.error}</text>
        </Show>
      </box>
      <box flexDirection="row" justifyContent="flex-end" gap={2} flexShrink={0} paddingLeft={2} paddingRight={2} paddingBottom={1} backgroundColor={RGBA.fromInts(0, 0, 0, 255)}>
        <box onMouseDown={() => undefined} onMouseUp={props.onBack}>
          <text fg={theme.textMuted}>cancel</text>
        </box>
        <box onMouseDown={() => undefined} onMouseUp={() => void create()}>
          <text fg={state.saving ? theme.textMuted : theme.text}>create</text>
        </box>
      </box>
      <Show when={scopeOpen()}>
        <box position="absolute" left={2} right={2} top={9} zIndex={5000} flexDirection="column" border={true} borderColor={theme.backgroundElement} backgroundColor={theme.backgroundElement}>
          <For each={COMMAND_SCOPES}>
            {(option) => (
              <box
                width="100%"
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={scope() === option ? theme.backgroundPanel : theme.backgroundElement}
                onMouseUp={() => {
                  setScope(option)
                  setScopeOpen(false)
                  focusField("scope")
                }}
              >
                <text fg={theme.text}>{option}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}

function Field(props: { label: string; value: string; ref?: (value: TextareaRenderable) => void; onFocus: () => void }) {
  const { theme } = useTheme()
  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.textMuted}>{props.label}</text>
      <textarea
        ref={(value: TextareaRenderable) => {
          props.ref?.(value)
        }}
        height={1}
        initialValue={props.value}
        backgroundColor={theme.backgroundElement}
        focusedBackgroundColor={theme.backgroundElement}
        textColor={theme.text}
        focusedTextColor={theme.text}
        cursorColor={theme.primary}
        placeholderColor={theme.textMuted}
        placeholder=""
        onMouseDown={() => props.onFocus()}
      />
    </box>
  )
}

function ScopeField(props: {
  value: CommandScope
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (value: CommandScope) => void
  onFocus: () => void
}) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" gap={0} width="100%" position="relative">
      <text fg={theme.textMuted}>Scope</text>
      <box flexDirection="column" gap={0} width="100%">
        <box
          width="100%"
          flexDirection="row"
          alignItems="center"
          paddingLeft={1}
          paddingRight={1}
          height={1}
          backgroundColor={theme.backgroundElement}
          onMouseDown={() => props.onFocus()}
          onMouseUp={() => {
            props.onFocus()
            props.onOpenChange(!props.open)
          }}
        >
          <text fg={theme.text}>{props.value}</text>
        </box>
      </box>
    </box>
  )
}
