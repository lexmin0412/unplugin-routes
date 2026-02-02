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

  it('transform route path default (kebab-case)', () => {
    expect(ctx.resolveRoutePath('AboutUs.tsx')).toBe('/about-us')
    expect(ctx.resolveRoutePath('UserProfile/Settings.tsx')).toBe(
      '/user-profile/settings',
    )
    expect(ctx.resolveRoutePath('UserProfile/[id].tsx')).toBe(
      '/user-profile/:id',
    )
    expect(ctx.resolveRoutePath('MyPage.tsx')).toBe('/my-page')
  })

  it('transform route path custom', () => {
    const options = resolveOptions({
      dirs: 'pages',
      transformRoutePath: (path) => path.toUpperCase(),
    })
    const ctx = new Context(options, root)
    expect(ctx.resolveRoutePath('about.tsx')).toBe('/ABOUT')
    // Note: transform happens before [id] -> :id replacement, but [id] is part of the path
    // so [id] becomes [ID] and then :ID
    expect(ctx.resolveRoutePath('users/[id].tsx')).toBe('/USERS/:ID')
  })

  it('generateRoutesCode', async () => {
    const code = await ctx.generateRoutesCode()
    // console.log(code)
    expect(code).toContain("path: '/',")
    expect(code).toContain("path: '/about',")
    // Should have nested structure for users
    expect(code).toContain("path: '/users',")
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
    expect(code).toContain("path: '/about',")
    expect(code).toContain('component: () => import(')
    // Should have nested structure for users
    expect(code).toContain("path: '/users',")
    expect(code).toContain('children: [')
    expect(code).toContain("path: 'list',")
    expect(code).toContain("path: ':id',")
    expect(code).toMatchSnapshot()
  })

  it('indexRoute option', async () => {
    const options = resolveOptions({
      dirs: 'pages-no-index',
      indexRoute: 'about',
    })
    const ctx = new Context(options, root)
    const code = await ctx.generateRoutesCode()
    
    // Should have / route
    expect(code).toContain("path: '/',")
    // Should have /about route
    expect(code).toContain("path: '/about',")
    
    // The / route should come before /about
    const rootIndex = code.indexOf("path: '/',")
    const aboutIndex = code.indexOf("path: '/about',")
    expect(rootIndex).toBeLessThan(aboutIndex)
    
    expect(code).toMatchSnapshot()
  })
})
