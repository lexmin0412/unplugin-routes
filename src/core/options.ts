import process from 'node:process'
import type { FilterPattern } from 'unplugin'

export interface Options {
  /**
   * Paths to the pages directory
   * @default 'src/pages'
   */
  dirs?: string | string[]

  /**
   * File extensions to resolve
   * @default ['tsx', 'jsx', 'ts', 'js']
   */
  extensions?: string[]

  /**
   * Root directory
   * @default process.cwd()
   */
  root?: string

  include?: FilterPattern
  exclude?: FilterPattern
  enforce?: 'pre' | 'post' | undefined
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Route style
   * @default 'react-router'
   */
  routeStyle?: 'react-router' | 'vue-router'

  /**
   * Custom route path transformation
   * @param path Relative path without extension
   * @returns Transformed path
   */
  transformRoutePath?: (path: string) => string
}

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

export type OptionsResolved = Overwrite<
  Required<Options>,
  Pick<Options, 'enforce' | 'transformRoutePath'>
>

export function resolveOptions(options: Options): OptionsResolved {
  return {
    dirs: options.dirs || 'src/pages',
    extensions: options.extensions || ['tsx', 'jsx', 'ts', 'js'],
    root: options.root ?? process.cwd(),
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude || [/node_modules/],
    enforce: 'enforce' in options ? options.enforce : 'pre',
    debug: options.debug || false,
    routeStyle: options.routeStyle || 'react-router',
    transformRoutePath: options.transformRoutePath,
  }
}
