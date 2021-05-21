import { dirname } from 'https://deno.land/std@0.96.0/path/mod.ts'
import { getAlephPkgUri, toRelativePath, toLocalPath } from '../../server/helper.ts'
import type { ServerApplication } from '../../types.ts'

export async function init(app: ServerApplication) {
  if (app.mode === 'development') {
    const alephPkgUri = getAlephPkgUri()
    app.injectCode('hmr', (specifier: string, code: string) => {
      if (code.includes('$RefreshReg$(')) {
        const refreshModuleSpecifier = toRelativePath(
          dirname(toLocalPath(specifier)),
          toLocalPath(`${alephPkgUri}/framework/react/refresh.js`)
        )
        return [
          `import { RefreshRuntime, performReactRefresh } from ${JSON.stringify(refreshModuleSpecifier)};`,
          '',
          'const prevRefreshReg = window.$RefreshReg$;',
          'const prevRefreshSig = window.$RefreshSig$;',
          `window.$RefreshReg$ = (type, id) => RefreshRuntime.register(type, ${JSON.stringify(specifier)} + "#" + id);`,
          'window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;',
          '',
          code,
          'window.$RefreshReg$ = prevRefreshReg;',
          'window.$RefreshSig$ = prevRefreshSig;',
          'import.meta.hot.accept(performReactRefresh);'
        ].join('\n')
      }
      return code
    })
    app.injectCode('compilation', (specifier: string, code: string) => {
      if (specifier === '/main.js') {
        return [
          `import ".${toLocalPath(`${alephPkgUri}/framework/react/refresh.js`)}";`,
          code
        ].join('\n')
      }
      return code
    })
    await app.addModule(`${alephPkgUri}/framework/react/refresh.ts`)
    Object.assign(globalThis, {
      $RefreshReg$: () => { },
      $RefreshSig$: () => (type: any) => type,
    })
  }
}
