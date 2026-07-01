import { RGBA, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { For, Show, createEffect, createMemo } from "solid-js"
import { useTuiConfig } from "../../config"
import { selectedForeground } from "../../context/theme"
import type { Theme } from "../../context/theme"
import { getScrollAcceleration } from "../../util/scroll"
import type { CommandFile } from "./types"

export function gridColumns(width: number) {
  const contentWidth = Math.max(24, width - 8)
  return Math.max(1, Math.floor((contentWidth + 2) / 28))
}

export function CommandGrid(props: {
  theme: Theme
  width: number
  height: number
  loading: boolean
  error?: string
  files: CommandFile[]
  selected: number
  input: "keyboard" | "mouse"
  onInputChange: (input: "keyboard" | "mouse") => void
  onHover: (index: number) => void
  onOpen: (file: CommandFile) => void
  onDelete: (file: CommandFile) => void
}) {
  const renderer = useRenderer()
  const tuiConfig = useTuiConfig()
  let scroll: ScrollBoxRenderable | undefined
  const contentWidth = createMemo(() => Math.max(24, props.width - 8))
  const cardHeight = createMemo(() => (props.height < 24 ? 7 : 9))
  const gap = 2
  const columns = createMemo(() => Math.max(1, Math.floor((contentWidth() + gap) / 28)))
  const cardWidth = createMemo(() => Math.max(18, Math.floor((contentWidth() - gap * (columns() - 1)) / columns())))
  const rows = createMemo(() =>
    Array.from({ length: Math.ceil(props.files.length / columns()) }, (_, index) =>
      props.files.slice(index * columns(), index * columns() + columns()),
    ),
  )
  const gridHeight = createMemo(() => Math.max(6, props.height - 8))
  const descriptionLines = createMemo(() => (props.height < 24 ? 2 : 3))
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  createEffect(() => {
    if (props.input === "mouse") return
    const row = Math.floor(props.selected / columns())
    if (!scroll) return
    const y = row * (cardHeight() + 1)
    if (y < scroll.scrollTop) scroll.scrollTo(y)
    if (y + cardHeight() >= scroll.scrollTop + scroll.height) scroll.scrollTo(y - scroll.height + cardHeight() + 1)
  })

  return (
    <Show
      when={!props.loading && !props.error && props.files.length > 0}
      fallback={
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text fg={props.error ? props.theme.error : props.theme.textMuted}>
            {props.loading ? "Loading custom commands..." : (props.error ?? "No custom command markdown files found")}
          </text>
        </box>
      }
      >
      <scrollbox
        ref={(value: ScrollBoxRenderable) => (scroll = value)}
        width="100%"
        height={gridHeight()}
        scrollAcceleration={scrollAcceleration()}
        verticalScrollbarOptions={{
          trackOptions: {
            backgroundColor: props.theme.background,
            foregroundColor: props.theme.borderActive,
          },
        }}
      >
        <box width={contentWidth()} flexDirection="column" gap={1} paddingBottom={1} flexShrink={0}>
          <For each={rows()}>
            {(row, rowIndex) => (
              <box flexDirection="row" gap={gap} height={cardHeight()} flexShrink={0}>
                <For each={row}>
                  {(file, columnIndex) => {
                    const index = createMemo(() => rowIndex() * columns() + columnIndex())
                    const active = createMemo(() => props.selected === index())
                    const activeBg = createMemo(() => props.theme.info)
                    const activeFg = createMemo(() => selectedForeground(props.theme, activeBg()))
                    const description = createMemo(() => {
                      const value = file.description ?? "No description"
                      const charsPerLine = Math.max(12, cardWidth() - 6)
                      const maxChars = descriptionLines() * charsPerLine
                      if (value.length <= maxChars) return value
                      return value.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "..."
                    })
                    const moveToCard = () => props.onHover(index())
                    const startMouseInput = () => props.onInputChange("mouse")
                    const hover = () => {
                      if (props.input !== "mouse") return
                      moveToCard()
                    }
                    const open = (event: { stopPropagation(): void }) => {
                      event.stopPropagation()
                      moveToCard()
                      if (renderer.getSelection()?.getSelectedText()) return
                      props.onOpen(file)
                    }
                    return (
                      <box
                        width={cardWidth()}
                        height={cardHeight()}
                        flexShrink={0}
                        paddingLeft={2}
                        paddingRight={2}
                        paddingTop={1}
                        paddingBottom={1}
                        flexDirection="column"
                        justifyContent="space-between"
                        backgroundColor={active() ? activeBg() : props.theme.backgroundElement}
                        onMouseMove={startMouseInput}
                        onMouseOver={hover}
                        onMouseDown={moveToCard}
                        onMouseUp={open}
                      >
                        <box flexDirection="row" justifyContent="space-between" gap={1}>
                          <text fg={active() ? activeFg() : props.theme.text} attributes={TextAttributes.BOLD} wrapMode="none" overflow="hidden">
                            {file.name}
                          </text>
                          <CommandCardDeleteButton
                            theme={props.theme}
                            onHover={hover}
                            onDelete={() => props.onDelete(file)}
                          />
                        </box>
                        <box flexDirection="column" gap={1}>
                          <text
                            fg={active() ? activeFg() : props.theme.textMuted}
                            wrapMode="word"
                            height={descriptionLines()}
                            overflow="hidden"
                          >
                            {description()}
                          </text>
                        </box>
                        <text fg={active() ? activeFg() : props.theme.textMuted} wrapMode="none" overflow="hidden">
                          {file.scope}
                        </text>
                      </box>
                    )
                  }}
                </For>
                <For each={Array.from({ length: columns() - row.length })}>
                  {() => <box width={cardWidth()} height={cardHeight()} flexShrink={0} backgroundColor={RGBA.fromInts(0, 0, 0, 0)} />}
                </For>
              </box>
            )}
          </For>
        </box>
      </scrollbox>
    </Show>
  )
}

export function DeleteCommandOverlay({ width, height, theme, file, onCancel, onDelete }: {
  width: number
  height: number
  theme: Theme
  file: CommandFile
  onCancel: () => void
  onDelete: () => void
}) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
      backgroundColor={RGBA.fromInts(0, 0, 0, 120)}
      zIndex={20}
    >
      <box width={48} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1} backgroundColor={theme.backgroundPanel}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Delete command?
          </text>
        </box>
        <text fg={theme.textMuted}>This will permanently remove `{file.name}`.</text>
        <box flexDirection="row" justifyContent="flex-end" gap={2}>
          <box onMouseDown={() => undefined} onMouseUp={onCancel}>
            <text fg={theme.textMuted}>cancel</text>
          </box>
          <box onMouseDown={() => undefined} onMouseUp={onDelete}>
            <text fg={theme.error}>delete</text>
          </box>
        </box>
      </box>
    </box>
  )
}

function CommandCardDeleteButton({ theme, onHover, onDelete }: { theme: Theme; onHover: () => void; onDelete: () => void }) {
  return (
    <text
      fg={theme.textMuted}
      onMouseMove={onHover}
      onMouseOver={onHover}
      onMouseDown={(e: { stopPropagation(): void }) => {
        e.stopPropagation()
        onHover()
      }}
      onMouseUp={(e: { stopPropagation(): void }) => {
        e.stopPropagation()
        onDelete()
      }}
    >
      x
    </text>
  )
}
