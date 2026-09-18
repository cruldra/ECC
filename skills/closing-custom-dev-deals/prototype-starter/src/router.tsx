import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router'
import { lazy } from 'react'

/**
 * 路由即菜单：加一屏就在 SCENES 里加一条，组件放 scenes/<id>/index.tsx。
 *
 * 顺序就是当面演示的顺序，按客户的业务链路排，不按功能模块排。
 * 一条路由一屏，一屏一个场景 —— 不要把两个场景塞进同一页往下滚。
 */

const Scene1 = lazy(() => import('./scenes/scene1'))

const SCENES = [
  { id: 'scene1', path: '/scene1', label: '01 场景标题', desc: '一句话说清这屏给谁看', color: 'bg-blue-500' },
] as const

function RootLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-72 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-6">
          <h1 className="text-lg font-bold text-gray-900">项目名称</h1>
          <p className="mt-1 text-xs text-gray-500">交互原型 · 用于需求对齐</p>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {SCENES.map((scene) => (
            <Link
              key={scene.id}
              to={scene.path}
              className="group block rounded-xl p-3 transition-all hover:bg-gray-50"
              activeProps={{ className: 'block rounded-xl p-3 bg-gray-50 ring-1 ring-gray-200' }}
            >
              {({ isActive }) => (
                <div className="flex items-start gap-3">
                  <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${scene.color} ${isActive ? 'ring-2 ring-gray-300 ring-offset-2' : ''}`} />
                  <div>
                    <div className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                      {scene.label}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">{scene.desc}</div>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
        <div className="border-t border-gray-100 p-4 text-center text-xs text-gray-400">
          本原型用于对齐需求，不构成报价或交付承诺
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

function IndexPage() {
  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800">项目名称 · 交互原型</h2>
        <p className="text-gray-500">
          左侧选一个场景，每屏都可以直接点。
          <br />
          界面上的数据都是示例，等贵司确认后替换。
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {SCENES.map((scene) => (
            <Link
              key={scene.id}
              to={scene.path}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-400"
            >
              <div className={`h-2 w-2 rounded-full ${scene.color}`} />
              {scene.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const rootRoute = createRootRoute({ component: RootLayout })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: IndexPage })
const scene1Route = createRoute({ getParentRoute: () => rootRoute, path: '/scene1', component: Scene1 })

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, scene1Route]) })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
