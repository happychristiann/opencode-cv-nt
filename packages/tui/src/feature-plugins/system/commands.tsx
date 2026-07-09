import type { TuiPlugin, TuiPluginApi, TuiRouteCurrent } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { CustomCommandEditor } from "../../component/commands-page"

const id = "internal:commands"
const ROUTE = "commands"

function navigateBack(api: TuiPluginApi, route: TuiRouteCurrent | undefined) {
  if (!route) {
    api.route.navigate("home")
    return
  }
  api.route.navigate(route.name, "params" in route ? route.params : undefined)
}

function routeParams(value: Record<string, unknown> | undefined) {
  const returnRoute = value?.returnRoute
  if (!returnRoute || typeof returnRoute !== "object" || !("name" in returnRoute) || typeof returnRoute.name !== "string") {
    return undefined
  }
  return returnRoute as TuiRouteCurrent
}

const tui: TuiPlugin = async (api) => {
  api.route.register([
    {
      name: ROUTE,
      render: (input) => <CustomCommandEditor onClose={() => navigateBack(api, routeParams(input.params))} />,
    },
  ])

  api.keymap.registerLayer({
    commands: [
      {
        name: "commands.edit",
        title: "Edit custom commands",
        category: "Command",
        slashName: "commands",
        slashAliases: ["command"],
        namespace: "palette",
        run() {
          api.route.navigate(ROUTE, { returnRoute: api.route.current })
          api.ui.dialog.clear()
        },
      },
    ],
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
