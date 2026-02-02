import { lib } from 'tsdown-preset-sxzz'

export default lib(
  {
    entry: 'shallow',
  },
  {
    // 在这里传入 overrides 配置
    exports: {
      // 开启自动导出
      packageJson: true,
      // 使用 customExports 钩子追加自定义导出
      customExports: (exports) => {
        // 这里的 exports 是 tsdown 自动生成的导出对象
        // 我们直接给它追加一行 client 的映射
        exports['./client'] = './dist/client.d.ts'
        return exports
      },
    },
  },
)
