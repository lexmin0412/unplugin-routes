import { createUnplugin, type UnpluginInstance } from 'unplugin'
import { Context } from './core/context'
import { resolveOptions, type Options } from './core/options'

export const Starter: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const ctx = new Context(options, options.root)

    const name = 'unplugin-routes'
    const virtualModuleId = 'virtual:routes'
    const resolvedVirtualModuleId = `\0${virtualModuleId}`

    return {
      name,
      enforce: options.enforce,

      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId
        }
      },

      async load(id) {
        if (id === resolvedVirtualModuleId) {
          return await ctx.generateRoutesCode()
        }
      },
    }
  })
