import { MouseEvent, TextareaRenderable, TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { readFile, writeFile } from "node:fs/promises"
import { Show, createMemo, createSignal, onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useProject } from "../../context/project"
import { useExit } from "../../context/exit"
import { useSDK } from "../../context/sdk"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import { useBindings } from "../../keymap"
import { useToast } from "../../ui/toast"
import type { CommandFile } from "./types"

export function CommandMarkdownEditor(props: { file: CommandFile; onBack: () => void; onSaved: () => void }) {
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const sdk = useSDK()
  const exit = useExit()
  const sync = useSync()
  const project = useProject()
  const toast = useToast()
  const [state, setState] = createStore({
    content: "",
    loading: true,
    saving: false,
    error: undefined as string | undefined,
  })
  const [textareaTarget, setTextareaTarget] = createSignal<TextareaRenderable>()
  let textarea: TextareaRenderable | undefined

  const bodyHeight = createMemo(() => Math.max(8, dimensions().height - 6))
  const editorHeight = createMemo(() => bodyHeight())

  const load = async () => {
    try {
      setState({ loading: true, error: undefined })
      setState({ content: await readFile(props.file.absolute, "utf8"), loading: false })
      setTimeout(() => textarea?.focus(), 1)
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const save = async () => {
    if (!textarea || state.saving || state.loading) return
    try {
      setState("saving", true)
      await writeFile(props.file.absolute, textarea.plainText)
      const result = await sdk.client.command.list({ workspace: project.workspace.current() })
      sync.set("command", reconcile(result.data ?? []))
      toast.show({ variant: "success", message: `Command saved successfully. Restart to apply changes.` })
      props.onSaved()
    } catch (error) {
      toast.error(error)
    } finally {
      setState("saving", false)
    }
  }

  useBindings(() => ({
    mode: "modal",
    target: textareaTarget,
    enabled: textareaTarget() !== undefined && !state.loading && !state.saving,
    priority: 2,
    bindings: [
      {
        key: "ctrl+c",
        desc: "Exit",
        group: "Command",
        cmd: () => exit(),
      },
      {
        key: "escape",
        desc: "Back to commands",
        group: "Command",
        cmd: props.onBack,
      },
      {
        key: "ctrl+s",
        desc: "Save command",
        group: "Command",
        cmd: () => void save(),
      },
    ],
  }))

  onMount(() => {
    void load()
  })

  return (
    <box
      width="100%"
      height="100%"
      flexGrow={1}
      minHeight={0}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      gap={1}
      backgroundColor={theme.background}
    >
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <box flexDirection="column">
          <text fg={theme.text} attributes={TextAttributes.BOLD} height={1}>
            {props.file.name}
          </text>
          <text fg={theme.textMuted}>{props.file.scope}</text>
        </box>
      </box>
      <box width="100%" flexGrow={1} minHeight={0}>
        <box width="100%" flexDirection="column">
          <Show when={!state.error} fallback={<text fg={theme.error}>{state.error}</text>}>
            <Show when={!state.loading} fallback={<text fg={theme.textMuted}>Loading command...</text>}>
              <textarea
                ref={(value: TextareaRenderable) => {
                  textarea = value
                  setTextareaTarget(value)
                  value.traits = { status: state.saving ? "SAVING" : "COMMAND" }
                }}
                width="100%"
                height={editorHeight()}
                initialValue={state.content}
                textColor={theme.text}
                focusedTextColor={theme.text}
                cursorColor={theme.primary}
                placeholderColor={theme.textMuted}
                onMouseDown={(event: MouseEvent) => event.target?.focus()}
              />
            </Show>
          </Show>
          <box flexDirection="row" gap={2} flexShrink={0}>
            <text fg={state.saving ? theme.textMuted : theme.text}>
              ctrl+s <span style={{ fg: theme.textMuted }}>{state.saving ? "saving" : "save"}</span>
            </text>
            <text fg={theme.text}>
              esc <span style={{ fg: theme.textMuted }}>close</span>
            </text>
          </box>
        </box>
      </box>
    </box>
  )
}
