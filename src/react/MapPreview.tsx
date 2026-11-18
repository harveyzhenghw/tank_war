import { useEffect, useRef } from 'react'
import type { MapDef } from '../engine/types'

interface Props {
  map: MapDef
  className?: string
}

/** Small static top-down preview used on selection screens. */
export function MapPreview({ map, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 260
    const h = Math.round((w * map.height) / map.width)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.aspectRatio = `${w} / ${h}`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const sx = w / map.width
    const sy = h / map.height

    ctx.fillStyle = map.theme.ground
    ctx.fillRect(0, 0, w, h)

    ctx.globalAlpha = 0.45
    for (const decor of map.decor) {
      ctx.fillStyle = map.theme.groundAlt
      ctx.beginPath()
      ctx.arc(decor.x * sx, decor.y * sy, decor.r * sx, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    for (const water of map.water) {
      ctx.fillStyle = map.theme.water
      ctx.fillRect(water.x * sx, water.y * sy, water.w * sx, water.h * sy)
    }

    for (const obstacle of map.obstacles) {
      ctx.fillStyle =
        obstacle.kind === 'crate'
          ? map.theme.crate
          : obstacle.kind === 'rock'
            ? map.theme.rock
            : map.theme.wall
      ctx.fillRect(obstacle.x * sx, obstacle.y * sy, obstacle.w * sx, obstacle.h * sy)
    }

    const spawn = map.playerSpawns[0]
    if (spawn) {
      ctx.fillStyle = '#63d1b4'
      ctx.beginPath()
      ctx.arc(spawn.x * sx, spawn.y * sy, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
  }, [map])

  return <canvas ref={ref} className={`map-preview ${className ?? ''}`} aria-hidden="true" />
}