import { RGBA, TextAttributes } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { rm } from "node:fs/promises"
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useProject } from "../../context/project"
import { useExit } from "../../context/exit"
import { useSDK } from "../../context/sdk"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import { useBindings, useOpencodeModeStack } from "../../keymap"
import { useToast } from "../../ui/toast"
import { loadCommandFiles } from "./load-commands"
import { CommandGrid, DeleteCommandOverlay, gridColumns } from "./command-grid"
import { CreateCommandPage } from "./create-command-page"
import { CommandMarkdownEditor } from "./markdown-editor"
import type { CommandFile } from "./types"

export function CustomCommandEditor(props: { onClose: () => void }) {
  const renderer = useRenderer()
  const modeStack = useOpencodeModeStack()
  const project = useProject()
  const exit = useExit()
  const sync = useSync()
  const sdk = useSDK()
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const toast = useToast()
  const [screen, setScreen] = createSignal<{ type: "list" } | { type: "create" } | { type: "edit"; file: CommandFile }>({
    type: "list",
  })
  const [state, setState] = createStore({
    loading: true,
    files: [] as CommandFile[],
    error: undefined as string | undefined,
    selected: 0,
    input: "keyboard" as "keyboard" | "mouse",
  })
  const [deletingFile, setDeletingFile] = createSignal<CommandFile | undefined>()

  const load = async () => {
    const directory = project.instance.directory()
    if (!directory) {
      setState({ loading: false, files: [], error: "No active directory" })
      return
    }

    setState({ loading: true, error: undefined })
    try {
      const commands = new Map<string, { description?: string }>(
        sync.data.command.map((command) => [command.name, { description: command.description }]),
      )
      const files = await loadCommandFiles({
        directory,
        worktree: project.data.project.worktree,
        commands,
      })
      setState({ loading: false, files, selected: 0 })
    } catch (error) {
      setState({
        loading: false,
        files: [],
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  onMount(() => {
    const popMode = modeStack.push("modal")
    const focus = renderer.currentFocusedRenderable
    renderer.clearSelection()
    focus?.blur()
    onCleanup(() => {
      popMode()
      setTimeout(() => {
        if (!focus || focus.isDestroyed) return
        focus.focus()
      }, 1)
    })
    void load()
  })

  const close = () => {
    props.onClose()
  }

  const move = (next: number) => {
    if (state.files.length === 0) return
    setState({ input: "keyboard", selected: Math.max(0, Math.min(state.files.length - 1, next)) })
  }

  const openSelected = () => {
    const file = state.files[state.selected]
    if (!file) return
    setScreen({ type: "edit", file })
  }

  const deleteCommand = async (file: CommandFile) => {
    try {
      await rm(file.absolute)
      const result = await sdk.client.command.list({ workspace: project.workspace.current() })
      sync.set("command", reconcile(result.data ?? []))
      setDeletingFile(undefined)
      await load()
    } catch (error) {
      toast.error(error)
    }
  }

  const title = createMemo(() => {
    const current = screen()
    if (current.type === "create") return "New custom command"
    if (current.type === "edit") return current.file.name
    return "Custom commands"
  })
  const editing = createMemo(() => {
    const current = screen()
    if (current.type !== "edit") return
    return current
  })

  useBindings(() => ({
    mode: "modal",
    enabled: screen().type === "list",
    priority: 2,
    bindings: [
      { key: "ctrl+c", desc: "Exit", group: "Command", cmd: () => exit() },
      { key: "escape", desc: "Close delete dialog", group: "Command", cmd: () => deletingFile() ? setDeletingFile(undefined) : close() },
      {
        key: "left",
        desc: "Previous command",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? move(state.selected - 1) : undefined,
      },
      {
        key: "right",
        desc: "Next command",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? move(state.selected + 1) : undefined,
      },
      {
        key: "up",
        desc: "Command above",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? move(state.selected - gridColumns(dimensions().width)) : undefined,
      },
      {
        key: "down",
        desc: "Command below",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? move(state.selected + gridColumns(dimensions().width)) : undefined,
      },
      {
        key: "home",
        desc: "First command",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? move(0) : undefined,
      },
      {
        key: "end",
        desc: "Last command",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? move(state.files.length - 1) : undefined,
      },
      {
        key: "return",
        desc: "Edit command",
        group: "Command",
        cmd: () => !state.loading && !deletingFile() ? openSelected() : undefined,
      },
    ],
  }))

  return (
    <>
      <Show when={screen().type === "list"}>
        <box
          width="100%"
          height="100%"
          flexGrow={1}
          minHeight={0}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          gap={1}
          backgroundColor={RGBA.fromInts(0, 0, 0, 255)}
        >
          <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
            <box flexDirection="column">
              <text fg={theme.text} attributes={TextAttributes.BOLD}>
                {title()}
              </text>
          <text fg={theme.textMuted}>Markdown-backed commands from this project and your global config</text>
        </box>
        <box flexDirection="row" gap={2} marginRight={2} alignItems="center">
              <HeaderButton label="new" marginLeft={2} onClick={() => setScreen({ type: "create" })} />
              <HeaderButton label="esc" onClick={close} />
            </box>
          </box>
          <CommandGrid
            theme={theme}
            width={dimensions().width}
            height={dimensions().height}
            loading={state.loading}
            error={state.error}
            files={state.files}
            selected={state.selected}
            input={state.input}
            onInputChange={(input) => setState("input", input)}
            onHover={(index) => setState("selected", index)}
            onOpen={(file) => setScreen({ type: "edit", file })}
            onDelete={(file) => setDeletingFile(file)}
          />
          <box flexDirection="row" gap={2} flexShrink={0}>
            <text fg={theme.text}>
              enter <span style={{ fg: theme.textMuted }}>edit</span>
            </text>
            <text fg={theme.text}>
              esc <span style={{ fg: theme.textMuted }}>close</span>
            </text>
          </box>
          {deletingFile() && (
            <DeleteCommandOverlay
              width={dimensions().width}
              height={dimensions().height}
              theme={theme}
              file={deletingFile()!}
              onCancel={() => setDeletingFile(undefined)}
              onDelete={() => void deleteCommand(deletingFile()!)}
            />
          )}
        </box>
      </Show>
      <Show when={screen().type === "create"}>
        <CreateCommandPage
          onBack={() => setScreen({ type: "list" })}
          onCreated={async () => {
            await load()
            setScreen({ type: "list" })
          }}
        />
      </Show>
      <Show when={editing()} keyed>
        {(current) => (
          <CommandMarkdownEditor
            file={current.file}
            onBack={() => setScreen({ type: "list" })}
            onSaved={async () => {
              await load()
              setScreen({ type: "list" })
            }}
          />
        )}
      </Show>
    </>
  )
}

function HeaderButton(props: { label: string; marginLeft?: number; onClick: () => void }) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)

  const click = (event: { stopPropagation(): void }) => {
    event.stopPropagation()
    props.onClick()
  }

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      height={3}
      marginLeft={props.marginLeft}
      border={true}
      borderColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
      backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
      onMouseMove={() => setHover(true)}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseDown={(event: { stopPropagation(): void }) => event.stopPropagation()}
      onMouseUp={click}
    >
      <text fg={hover() ? theme.text : theme.textMuted}>{props.label}</text>
    </box>
  )
}
