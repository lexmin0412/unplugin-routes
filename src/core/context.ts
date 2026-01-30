import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import type { OptionsResolved } from './options'

interface RouteNode {
  segment: string
  component?: string
  children: Map<string, RouteNode>
}

export class Context {
  options: OptionsResolved
  root: string

  constructor(options: OptionsResolved, root: string = process.cwd()) {
    this.options = options
    this.root = root
  }

  log(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[unplugin-routes] ${message}`, ...args)
    }
  }

  async searchGlob(): Promise<string[]> {
    const dirs = Array.isArray(this.options.dirs)
      ? this.options.dirs
      : [this.options.dirs]
    const exts = this.options.extensions.map((e) => `.${e}`)

    const files: string[] = []

    for (const dir of dirs) {
      // Use array of patterns to avoid brace expansion issues with single extension
      const patterns = exts.map((e) => `**/*${e}`)
      const result = await fg(patterns, {
        ignore: ['node_modules', '.git', '**/__*__/*'],
        onlyFiles: true,
        cwd: path.resolve(this.root, dir),
        absolute: true,
      })
      files.push(...result)
    }

    return files
  }

  resolveRoutePath(relativePath: string): string {
    const ext = path.extname(relativePath)
    // Support extensions like .page.tsx
    const exts = this.options.extensions.map((e) => `.${e}`)
    let route = relativePath
    for (const e of exts) {
      if (route.endsWith(e)) {
        route = route.slice(0, -e.length)
        break
      }
    }
    if (route === relativePath) {
      route = relativePath.slice(0, -ext.length)
    }

    // Normalize path separators for Windows
    route = route.replaceAll('\\', '/')

    // Remove 'index' from end
    if (route.endsWith('/index') || route === 'index') {
      route = route.replace(/\/?index$/, '')
    }

    // Handle dynamic routes [id] -> :id
    route = route.replaceAll(/\[(.+?)\]/g, ':$1')

    // Ensure starting with /
    if (!route.startsWith('/')) {
      route = `/${route}`
    }

    return route
  }

  async generateRoutesCode(): Promise<string> {
    const files = await this.searchGlob()
    const dirs = Array.isArray(this.options.dirs)
      ? this.options.dirs
      : [this.options.dirs]

    const rootNode: RouteNode = { segment: '', children: new Map() }

    // Sort files to ensure deterministic order, though tree structure handles hierarchy
    files.sort()

    for (const file of files) {
      const dir = dirs.find((d) => file.startsWith(path.resolve(this.root, d)))
      if (!dir) continue

      const relativePath = path.relative(path.resolve(this.root, dir), file)
      // Normalize path separators
      const exts = this.options.extensions.map((e) => `.${e}`)
      let pathWithoutExt = relativePath

      // Match extension accurately
      for (const e of exts) {
        if (pathWithoutExt.endsWith(e)) {
          pathWithoutExt = pathWithoutExt.slice(0, -e.length)
          break
        }
      }
      // If no custom extension matched, fallback to standard behavior (though glob should ensure match)
      if (pathWithoutExt === relativePath) {
        const ext = path.extname(relativePath)
        pathWithoutExt = relativePath.slice(0, -ext.length)
      }

      pathWithoutExt = pathWithoutExt.replaceAll('\\', '/')

      const parts = pathWithoutExt.split('/')

      let currentNode = rootNode
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i]
        // Handle dynamic routes [id] -> :id
        part = part.replaceAll(/\[(.+?)\]/g, ':$1')

        // Handle index files
        if (i === parts.length - 1 && part === 'index') {
          part = ''
        }

        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, { segment: part, children: new Map() })
        }
        currentNode = currentNode.children.get(part)!
      }
      currentNode.component = file
    }

    if (this.options.routeStyle === 'vue-router') {
      return this.generateVueRoutes(rootNode)
    }
    return this.generateReactRoutes(rootNode)
  }

  generateReactRoutes(rootNode: RouteNode): string {
    const imports: string[] = []

    const generateRoutes = (node: RouteNode, isRoot = false): string => {
      let code = '{\n'

      // Determine path
      let routePath = node.segment
      if (isRoot && routePath === '') {
        routePath = '/'
      }

      code += `    path: '${routePath}',\n`

      if (node.component) {
        const index = imports.length
        const componentName = `Page_${index}`
        const importPath = node.component.replaceAll('\\', '/')
        imports.push(
          `const ${componentName} = React.lazy(() => import('${importPath}'))`,
        )
        code += `    element: React.createElement(${componentName}),\n`
      }

      if (node.children.size > 0) {
        const sortedChildren = Array.from(node.children.values()).toSorted(
          (a, b) => {
            if (a.segment === b.segment) return 0
            const aIsDynamic = a.segment.startsWith(':')
            const bIsDynamic = b.segment.startsWith(':')
            if (aIsDynamic && !bIsDynamic) return 1
            if (!aIsDynamic && bIsDynamic) return -1
            return a.segment.length > b.segment.length ? -1 : 1
          },
        )

        code += `    children: [\n`
        sortedChildren.forEach((child) => {
          code += `${generateRoutes(child)
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n')},\n`
        })
        code += `    ],\n`
      }

      code += '  }'
      return code
    }

    const routeDefinitions = Array.from(rootNode.children.values())
      .toSorted((a, b) => {
        if (a.segment === b.segment) return 0
        const aIsDynamic = a.segment.startsWith(':')
        const bIsDynamic = b.segment.startsWith(':')
        if (aIsDynamic && !bIsDynamic) return 1
        if (!aIsDynamic && bIsDynamic) return -1
        return a.segment.length > b.segment.length ? -1 : 1
      })
      .map((node) => generateRoutes(node, true))

    return `
import React from 'react'

${imports.join('\n')}

const routes = [
${routeDefinitions.join(',\n')}
]

export default routes
`
  }

  generateVueRoutes(rootNode: RouteNode): string {
    const generateRoutes = (node: RouteNode, isRoot = false): string => {
      let code = '{\n'

      // Determine path
      let routePath = node.segment
      if (isRoot && routePath === '') {
        routePath = '/'
      }

      code += `    path: '${routePath}',\n`

      if (node.component) {
        const importPath = node.component.replaceAll('\\', '/')
        code += `    component: () => import('${importPath}'),\n`
      }

      if (node.children.size > 0) {
        const sortedChildren = Array.from(node.children.values()).toSorted(
          (a, b) => {
            if (a.segment === b.segment) return 0
            const aIsDynamic = a.segment.startsWith(':')
            const bIsDynamic = b.segment.startsWith(':')
            if (aIsDynamic && !bIsDynamic) return 1
            if (!aIsDynamic && bIsDynamic) return -1
            return a.segment.length > b.segment.length ? -1 : 1
          },
        )

        code += `    children: [\n`
        sortedChildren.forEach((child) => {
          code += `${generateRoutes(child)
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n')},\n`
        })
        code += `    ],\n`
      }

      code += '  }'
      return code
    }

    const routeDefinitions = Array.from(rootNode.children.values())
      .toSorted((a, b) => {
        if (a.segment === b.segment) return 0
        const aIsDynamic = a.segment.startsWith(':')
        const bIsDynamic = b.segment.startsWith(':')
        if (aIsDynamic && !bIsDynamic) return 1
        if (!aIsDynamic && bIsDynamic) return -1
        return a.segment.length > b.segment.length ? -1 : 1
      })
      .map((node) => generateRoutes(node, true))

    return `
const routes = [
${routeDefinitions.join(',\n')}
]

export default routes
`
  }
}
