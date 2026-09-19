import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 演示的节奏：点一下 → 一步步报进度 → 成果出现。
 *
 * 客户信不信这事能做成，靠的就是这几秒。直接把结果闪出来，他会觉得是张假图；
 * 一步步报「正在做什么」，他会觉得后面真有个东西在跑。
 *
 * steps 写成 AI 员工的口吻报自己在干什么，用甲方行业的词，不写技术名词。
 */
export function useGeneration(steps: string[], stepMs = 800) {
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
  }

  useEffect(() => clear, [])

  const start = useCallback(() => {
    clear()
    setRunning(true)
    setDone(false)
    setStep(0)
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      if (i < steps.length) {
        setStep(i)
      } else {
        clear()
        setRunning(false)
        setDone(true)
      }
    }, stepMs)
  }, [steps.length, stepMs])

  const reset = useCallback(() => {
    clear()
    setRunning(false)
    setDone(false)
    setStep(0)
  }, [])

  return { running, done, step, label: steps[step], start, reset }
}
