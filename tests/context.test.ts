import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { Context } from '../src/core/context'
import { resolveOptions } from '../src/core/options'

describe('Context', () => {
  const root = path.resolve(__dirname, 'fixtures')
  const options = resolveOptions({
    dirs: 'pages',
  })
  const ctx = new Context(options, root)

  it('debug mode', async () => {
    const options = resolveOptions({
      dirs: 'pages',
      debug: true,
    })
    const ctx = new Context(options, root)
    // Here we just ensure it runs without error
    await ctx.generateRoutesCode()
  })

  it('searchGlob with custom extension', async () => {
    const options = resolveOptions({
      dirs: 'pages',
      extensions: ['page.tsx'],
    })
    const ctx = new Context(options, root)
    const files = await ctx.searchGlob()
    const relativeFiles = files.map((f) => path.relative(root, f))
    expect(relativeFiles).toEqual(['pages/blog.page.tsx'])
  })

  it('searchGlob', async () => {
    const files = await ctx.searchGlob()
    const relativeFiles = files.map((f) => path.relative(root, f))
    relativeFiles.sort()
    expect(relativeFiles).toEqual([
      'pages/about.tsx',
      'pages/blog.page.tsx',
      'pages/index.tsx',
      'pages/users.tsx',
      'pages/users/[id].tsx',
      'pages/users/list.tsx',
    ])
  })

  it('resolveRoutePath', () => {
    expect(ctx.resolveRoutePath('index.tsx')).toBe('/')
    expect(ctx.resolveRoutePath('about.tsx')).toBe('/about')
    expect(ctx.resolveRoutePath('users/[id].tsx')).toBe('/users/:id')
  })

  it('generateRoutesCode', async () => {
    const code = await ctx.generateRoutesCode()
    // console.log(code)
    expect(code).toContain("path: '/',")
    expect(code).toContain("path: 'about',")
    // Should have nested structure for users
    expect(code).toContain("path: 'users',")
    expect(code).toContain('children: [')
    expect(code).toContain("path: 'list',")
    expect(code).toContain("path: ':id',")
    expect(code).toMatchSnapshot()
  })

  it('generateRoutesCode vue', async () => {
    const options = resolveOptions({
      dirs: 'pages',
      routeStyle: 'vue-router',
    })
    const ctx = new Context(options, root)
    const code = await ctx.generateRoutesCode()
    // console.log(code)
    expect(code).toContain("path: '/',")
    expect(code).toContain("path: 'about',")
    expect(code).toContain('component: () => import(')
    // Should have nested structure for users
    expect(code).toContain("path: 'users',")
    expect(code).toContain('children: [')
    expect(code).toContain("path: 'list',")
    expect(code).toContain("path: ':id',")
    expect(code).toMatchSnapshot()
  })
})
