import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import './ImageLightbox.css'

type Point = { x: number; y: number }

type ImageLightboxProps = {
  src: string | null
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 4

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const pinchRef = useRef<{
    startDist: number
    startScale: number
    startOffset: Point
  } | null>(null)
  const panRef = useRef<{ start: Point; origin: Point } | null>(null)
  const lastTapRef = useRef(0)

  const applyTransform = useCallback((nextScale: number, nextOffset: Point) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
    const offsetClamped = clamped <= 1 ? { x: 0, y: 0 } : nextOffset
    scaleRef.current = clamped
    offsetRef.current = offsetClamped
    setScale(clamped)
    setOffset(offsetClamped)
  }, [])

  useEffect(() => {
    if (!src) return
    lockAppScroll()
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    setScale(1)
    setOffset({ x: 0, y: 0 })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlockAppScroll()
      window.removeEventListener('keydown', onKey)
    }
  }, [src, onClose])

  if (!src) return null

  const onWheel = (event: ReactWheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.15 : 0.15
    applyTransform(scaleRef.current + delta, offsetRef.current)
  }

  const onDoubleTap = () => {
    if (scaleRef.current > 1.05) {
      applyTransform(1, { x: 0, y: 0 })
      return
    }
    applyTransform(2.2, { x: 0, y: 0 })
  }

  const onPointerDown = (event: ReactPointerEvent) => {
    const stage = stageRef.current
    if (!stage) return
    stage.setPointerCapture(event.pointerId)

    const now = Date.now()
    if (now - lastTapRef.current < 280 && event.isPrimary) {
      onDoubleTap()
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now

    if (scaleRef.current <= 1) return
    panRef.current = {
      start: { x: event.clientX, y: event.clientY },
      origin: { ...offsetRef.current },
    }
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const pan = panRef.current
    if (!pan || pinchRef.current) return
    applyTransform(scaleRef.current, {
      x: pan.origin.x + (event.clientX - pan.start.x),
      y: pan.origin.y + (event.clientY - pan.start.y),
    })
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    panRef.current = null
    const stage = stageRef.current
    if (stage?.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId)
    }
  }

  const onTouchStart = (event: ReactTouchEvent) => {
    if (event.touches.length === 2) {
      panRef.current = null
      const a = { x: event.touches[0].clientX, y: event.touches[0].clientY }
      const b = { x: event.touches[1].clientX, y: event.touches[1].clientY }
      pinchRef.current = {
        startDist: distance(a, b),
        startScale: scaleRef.current,
        startOffset: { ...offsetRef.current },
      }
    }
  }

  const onTouchMove = (event: ReactTouchEvent) => {
    const pinch = pinchRef.current
    if (!pinch || event.touches.length < 2) return
    event.preventDefault()
    const a = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    const b = { x: event.touches[1].clientX, y: event.touches[1].clientY }
    const ratio = distance(a, b) / Math.max(1, pinch.startDist)
    applyTransform(pinch.startScale * ratio, pinch.startOffset)
  }

  const onTouchEnd = (event: ReactTouchEvent) => {
    if (event.touches.length < 2) {
      pinchRef.current = null
    }
  }

  return createPortal(
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="نمایش تصویر">
      <div className="image-lightbox__bar">
        <p className="image-lightbox__hint">دوبار ضربه یا پینچ برای زوم</p>
        <button type="button" className="image-lightbox__close" onClick={onClose} aria-label="بستن">
          ×
        </button>
      </div>
      <div
        ref={stageRef}
        className="image-lightbox__stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(event) => {
          if (event.target === event.currentTarget && scaleRef.current <= 1.05) {
            onClose()
          }
        }}
      >
        <img
          src={src}
          alt=""
          className="image-lightbox__img"
          draggable={false}
          style={{
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
