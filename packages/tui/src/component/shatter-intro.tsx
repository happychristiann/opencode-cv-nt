import {
  FrameBufferRenderable,
  type OptimizedBuffer,
  type RenderContext,
  type RenderableOptions,
} from "@opentui/core"
import { extend, useRenderer } from "@opentui/solid"
import { onCleanup, onMount } from "solid-js"
import { ShatterPainter } from "./shatter-intro-render"

type ShatterIntroOptions = RenderableOptions<FrameBufferRenderable> & {
  onDone?: () => void
}

class ShatterIntroRenderable extends FrameBufferRenderable {
  private painter = new ShatterPainter()

  constructor(ctx: RenderContext, options: ShatterIntroOptions = {}) {
    const width = typeof options.width === "number" ? options.width : 1
    const height = typeof options.height === "number" ? options.height : 1
    super(ctx, {
      ...options,
      width,
      height,
      live: options.live ?? true,
      respectAlpha: true,
    })

    if (options.width !== undefined && typeof options.width !== "number") this.width = options.width
    if (options.height !== undefined && typeof options.height !== "number") this.height = options.height
    this.painter.onComplete = options.onDone
  }

  protected override renderSelf(buffer: OptimizedBuffer, deltaTime = 0): void {
    if (!this.visible || this.isDestroyed) return

    this.painter.render(this.frameBuffer, deltaTime)
    if (this.painter.done) {
      this.visible = false
      return
    }
    this._ctx.setCursorPosition(0, 0, false)
    buffer.drawFrameBuffer(this.screenX, this.screenY, this.frameBuffer)
  }
}

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    shatter_intro: typeof ShatterIntroRenderable
  }
}

extend({ shatter_intro: ShatterIntroRenderable })

interface ShatterIntroProps {
  onDone?: () => void
}

export function ShatterIntro({ onDone }: ShatterIntroProps) {
  const renderer = useRenderer()
  let targetFps = renderer.targetFps
  let maxFps = renderer.maxFps

  onMount(() => {
    targetFps = renderer.targetFps
    maxFps = renderer.maxFps
    renderer.targetFps = 60
    renderer.maxFps = 60
  })

  onCleanup(() => {
    renderer.targetFps = targetFps
    renderer.maxFps = maxFps
    renderer.requestRender()
  })

  return (
    <shatter_intro
      position="absolute"
      zIndex={6000}
      left={0}
      top={0}
      width="100%"
      height="100%"
      onDone={onDone}
      live
    />
  )
}
