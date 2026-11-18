import type { Loadout } from '../engine/api'
import type { BoosterId, SkinId, WeaponId } from '../engine/types'
import type { Progress } from '../settings'
import { BOOSTERS, MAX_EQUIPPED_BOOSTERS } from './boosters'
import { SKINS } from './skins'
import { WEAPON_PRICES, isWeaponId } from './weapons'

export function buyWeapon(progress: Progress, id: WeaponId): Progress {
  const price = WEAPON_PRICES[id]
  if (!price || !isWeaponId(id)) return progress
  if (progress.ownedWeapons.includes(id) || progress.coins < price) return progress
  return {
    ...progress,
    coins: progress.coins - price,
    ownedWeapons: [...progress.ownedWeapons, id],
  }
}

export function buySkin(progress: Progress, id: SkinId): Progress {
  const def = SKINS[id]
  if (!def || progress.ownedSkins.includes(id) || progress.coins < def.price) return progress
  return {
    ...progress,
    coins: progress.coins - def.price,
    ownedSkins: [...progress.ownedSkins, id],
    equippedSkin: id,
  }
}

export function equipSkin(progress: Progress, id: SkinId): Progress {
  if (!progress.ownedSkins.includes(id) || progress.equippedSkin === id) return progress
  return { ...progress, equippedSkin: id }
}

export function buyBooster(progress: Progress, id: BoosterId): Progress {
  const def = BOOSTERS[id]
  if (!def || progress.ownedBoosters.includes(id) || progress.coins < def.price) {
    return progress
  }
  const equippedBoosters =
    progress.equippedBoosters.length < MAX_EQUIPPED_BOOSTERS
      ? [...progress.equippedBoosters, id]
      : progress.equippedBoosters
  return {
    ...progress,
    coins: progress.coins - def.price,
    ownedBoosters: [...progress.ownedBoosters, id],
    equippedBoosters,
  }
}

export function toggleBooster(progress: Progress, id: BoosterId): Progress {
  if (!progress.ownedBoosters.includes(id)) return progress
  if (progress.equippedBoosters.includes(id)) {
    return {
      ...progress,
      equippedBoosters: progress.equippedBoosters.filter((entry) => entry !== id),
    }
  }
  if (progress.equippedBoosters.length >= MAX_EQUIPPED_BOOSTERS) return progress
  return { ...progress, equippedBoosters: [...progress.equippedBoosters, id] }
}

export function progressLoadout(progress: Progress): Loadout {
  return {
    weapons: [...progress.ownedWeapons],
    skin: progress.equippedSkin,
    boosters: [...progress.equippedBoosters],
  }
}
