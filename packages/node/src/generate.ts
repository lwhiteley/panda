import type { LoadConfigResult } from '@css-panda/config'
import { logger } from '@css-panda/logger'
import glob from 'fast-glob'
import { ensureDir } from 'fs-extra'
import { createContext } from './create-context'
import { extractAssets } from './extract-assets'
import { extractContent } from './extract-content'
import { loadConfig } from './load-config'
import { setupSystem } from './setup-system'
import { watch } from './watchers'

export async function generate(config: LoadConfigResult) {
  const ctx = createContext(config)

  await ensureDir(ctx.paths.asset)

  async function buildOnce() {
    const globFiles = glob.sync(ctx.include, {
      cwd: ctx.cwd,
      ignore: ctx.exclude,
    })

    await Promise.all(
      globFiles.map(async (file) => {
        const css = await extractContent(ctx, file)
        await ctx.assets.write(file, css)
      }),
    )

    await extractAssets(ctx)
  }

  await buildOnce()

  if (ctx.watch) {
    await watch(ctx, {
      async onConfigChange() {
        logger.info(`Config changed. Rebuilding...`)
        const newConfig = await loadConfig(ctx.cwd)
        await setupSystem(newConfig)
        return generate(newConfig)
      },
      onAssetChange() {
        return extractAssets(ctx)
      },
      async onContentChange(file) {
        logger.info(`File changed: ${file}`)
        const css = await extractContent(ctx, file)
        await ctx.assets.write(file, css)
      },
    })
  }
}
