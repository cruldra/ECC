import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-gray-400">加载中...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
)
