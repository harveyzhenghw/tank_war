import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BoosterId, SkinId, WeaponId } from '../engine/types'
import type { Progress } from '../settings'
import {
  CORE_WEAPONS,
  PURCHASABLE_WEAPONS,
  WEAPONS,
  WEAPON_PRICES,
  WEAPON_ORDER,
} from '../data/weapons'
import { BOOSTERS, BOOSTER_ORDER, MAX_EQUIPPED_BOOSTERS } from '../data/boosters'
import { SKINS, SKIN_ORDER } from '../data/skins'

type StoreTab = 'weapons' | 'boosters' | 'skins'

const TABS: Array<{ id: StoreTab; label: string; hint: string }> = [
  { id: 'weapons', label: 'Weapons', hint: 'New guns for your loadout' },
  { id: 'boosters', label: 'Boosters', hint: 'Permanent upgrades, two slots' },
  { id: 'skins', label: 'Skins', hint: 'Cosmetic paint jobs' },
]

const WEAPON_BLURB: Record<WeaponId, string> = {
  cannon: 'Reliable mid-range damage with unlimited ammunition.',
  mg: 'Fast, low-damage rounds that chew through armour at range.',
  rocket: 'Slow and heavy. Splash damage that also breaks crates.',
  spread: 'Five pellets. Devastating up close, useless at distance.',
  rail: 'A hyper-velocity slug that punches through two tanks in a line.',
  plasma: 'A slow orb that erupts into a wide splash of superheated gas.',
  flame: 'A short-range automatic stream that punishes anything that gets close.',
}

interface Props {
  progress: Progress
  onBuyWeapon: (id: WeaponId) => void
  onBuySkin: (id: SkinId) => void
  onEquipSkin: (id: SkinId) => void
  onBuyBooster: (id: BoosterId) => void
  onToggleBooster: (id: BoosterId) => void
  onBack: () => void
}

export function StoreScreen({
  progress,
  onBuyWeapon,
  onBuySkin,
  onEquipSkin,
  onBuyBooster,
  onToggleBooster,
  onBack,
}: Props) {
  const [tab, setTab] = useState<StoreTab>('weapons')
  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0]

  return (
    <div className="screen store-screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Store</h2>
        <div className="spacer" />
        <span className="coin-balance">◈ {progress.coins} coins</span>
      </div>

      <div className="store-hero">
        <div>
          <h1 style={{ fontSize: 30 }}>Armoury</h1>
          <p className="sub">
            Every hostile tank you destroy earns <strong>10 coins</strong>. Spend them on
            new weapons, permanent boosters and paint jobs.
          </p>
        </div>
        <div className="store-summary">
          <span className="tag accent">{progress.ownedWeapons.length} weapons</span>
          <span className="tag cyan">
            {progress.equippedBoosters.length}/{MAX_EQUIPPED_BOOSTERS} boosters
          </span>
          <span className="tag">{progress.totalKills} kills</span>
        </div>
      </div>

      <div className="seg store-tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={tab === entry.id ? 'active' : ''}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className="store-hint">{active.hint}</p>

      {tab === 'weapons' && (
        <div className="store-grid">
          {WEAPON_ORDER.map((id) => (
            <WeaponCard
              key={id}
              id={id}
              owned={progress.ownedWeapons.includes(id)}
              coins={progress.coins}
              onBuy={() => onBuyWeapon(id)}
            />
          ))}
        </div>
      )}

      {tab === 'boosters' && (
        <div className="store-grid">
          {BOOSTER_ORDER.map((id) => {
            const def = BOOSTERS[id]
            const owned = progress.ownedBoosters.includes(id)
            const equipped = progress.equippedBoosters.includes(id)
            const full =
              !equipped &&
              progress.equippedBoosters.length >= MAX_EQUIPPED_BOOSTERS
            return (
              <StoreCard
                key={id}
                accent={equipped ? 'var(--cyan)' : undefined}
                badge={equipped ? 'Equipped' : owned ? 'Owned' : 'Booster'}
                title={def.name}
                icon={def.short}
                description={def.description}
              >
                {owned ? (
                  <button
                    className={`btn btn-sm ${equipped ? 'btn-ghost' : 'btn-primary'}`}
                    disabled={full}
                    onClick={() => onToggleBooster(id)}
                  >
                    {equipped ? 'Unequip' : full ? 'Slots full' : 'Equip'}
                  </button>
                ) : (
                  <BuyButton
                    price={def.price}
                    affordable={progress.coins >= def.price}
                    onClick={() => onBuyBooster(id)}
                  />
                )}
              </StoreCard>
            )
          })}
        </div>
      )}

      {tab === 'skins' && (
        <div className="store-grid">
          {SKIN_ORDER.map((id) => {
            const def = SKINS[id]
            const owned = progress.ownedSkins.includes(id)
            const equipped = progress.equippedSkin === id
            return (
              <StoreCard
                key={id}
                accent={equipped ? 'var(--cyan)' : undefined}
                badge={equipped ? 'Equipped' : owned ? 'Owned' : 'Skin'}
                title={def.name}
                icon={def.name.slice(0, 2).toUpperCase()}
                description={def.description}
                preview={
                  <div
                    className="skin-preview"
                    style={{
                      background: `radial-gradient(circle at 50% 45%, ${def.turret}22, transparent 65%), linear-gradient(145deg, ${def.tread}, #0b0f0a)`,
                    }}
                  >
                    <span
                      className="skin-preview-tread"
                      style={{ background: def.tread }}
                    />
                    <span className="skin-preview-hull" style={{ background: def.body }}>
                      <i style={{ background: def.turret }} />
                    </span>
                    <span className="skin-preview-barrel" style={{ background: def.barrel }} />
                  </div>
                }
              >
                {owned ? (
                  <button
                    className={`btn btn-sm ${equipped ? 'btn-ghost' : 'btn-primary'}`}
                    disabled={equipped}
                    onClick={() => onEquipSkin(id)}
                  >
                    {equipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <BuyButton
                    price={def.price}
                    affordable={progress.coins >= def.price}
                    onClick={() => onBuySkin(id)}
                  />
                )}
              </StoreCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WeaponCard({
  id,
  owned,
  coins,
  onBuy,
}: {
  id: WeaponId
  owned: boolean
  coins: number
  onBuy: () => void
}) {
  const def = WEAPONS[id]
  const price = WEAPON_PRICES[id]
  const core = CORE_WEAPONS.includes(id)
  const stats = [
    `DMG ${def.damage}`,
    def.ammo === null ? 'AMMO ∞' : `AMMO ${def.ammo}`,
    `ROF ${(1 / def.cooldown).toFixed(1)}/s`,
    def.pierce > 0 ? `PIERCE ${def.pierce}` : def.splash > 0 ? `SPLASH ${def.splash}` : null,
  ].filter(Boolean) as string[]

  return (
    <StoreCard
      badge={core ? 'Standard issue' : owned ? 'Owned' : 'Weapon'}
      title={def.name}
      icon={def.short}
      description={WEAPON_BLURB[id]}
    >
      <div className="store-stats">
        {stats.map((stat) => (
          <span key={stat}>{stat}</span>
        ))}
      </div>
      {core ? (
        <span className="store-state">Always available</span>
      ) : owned ? (
        <span className="store-state owned">In your loadout</span>
      ) : (
        <BuyButton
          price={price ?? 0}
          affordable={coins >= (price ?? 0)}
          onClick={onBuy}
          blockedLabel={!PURCHASABLE_WEAPONS.includes(id) ? 'Unavailable' : undefined}
          blocked={!PURCHASABLE_WEAPONS.includes(id)}
        />
      )}
    </StoreCard>
  )
}

function StoreCard({
  title,
  icon,
  description,
  badge,
  accent,
  preview,
  children,
}: {
  title: string
  icon: string
  description: string
  badge?: string
  accent?: string
  preview?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="store-card" style={accent ? { borderColor: accent } : undefined}>
      <div className="store-card-head">
        <span className="store-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          {badge && <span className="tag">{badge}</span>}
        </div>
      </div>
      {preview}
      <p className="store-desc">{description}</p>
      {children}
    </div>
  )
}

function BuyButton({
  price,
  affordable,
  onClick,
  blocked,
  blockedLabel,
}: {
  price: number
  affordable: boolean
  onClick: () => void
  blocked?: boolean
  blockedLabel?: string
}) {
  return (
    <div className="store-price-row">
      <span className={`store-price ${affordable ? '' : 'short'}`}>◈ {price}</span>
      <button
        className="btn btn-sm btn-primary"
        disabled={!affordable || blocked}
        onClick={onClick}
      >
        {blocked ? blockedLabel ?? 'Unavailable' : affordable ? 'Buy' : 'Not enough'}
      </button>
    </div>
  )
}
