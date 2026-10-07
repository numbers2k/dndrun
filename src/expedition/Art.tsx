import type { HeroId } from './types'

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    sword: 'm4 20 4-4m-3-3 6 6M8 16 19 5l1-3-3 1L6 14',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z',
    heart: 'M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z',
    spark: 'm13 2-9 12h7l-1 8 10-12h-7z',
    cards: 'M7 3h12v16H7zM4 7v15h11',
    coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5v10m-3-8h4a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h4',
    leaf: 'M20 3C4 1 2 10 7 17c7 5 15-4 13-14ZM5 21 17 7',
    drop: 'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
    fire: 'M13 2c2 8-7 8-4 13 1-4 4-3 5-6 8 9 4 13-2 13-8 0-12-10 1-20Z',
    flag: 'M5 22V3h14l-3 5 3 5H5',
    map: 'm3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3Zm6-3v17m6-14v17',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    camp: 'm2 20 10-16 10 16Zm6 0 4-8 4 8',
    star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
    bag: 'M5 7h14l2 14H3Zm3 0V5a4 4 0 0 1 8 0v2',
    book: 'M12 5C8 2 3 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-1-1-6-2-10 1Zm0 0v16',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm4 12 5 5L20 6',
    skull: 'M4 10a8 8 0 1 1 16 0v5l-4 2v4H8v-4l-4-2Zm4 0h1m6 0h1m-5 7h2',
    bow: 'M5 3c16 6 16 12 0 18L9 12Zm4 9h12m-4-3 4 3-4 3',
    music: 'M10 17V4l10-2v13M10 17a3 3 0 1 1-3-3h3m10 1a3 3 0 1 1-3-3h3',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    plus: 'M12 4v16M4 12h16',
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.star} />
    </svg>
  )
}

export function Portrait({ hero, small = false }: { hero: HeroId; small?: boolean }) {
  const colors: Record<HeroId, string> = {
    warden: '#a48766',
    ranger: '#6a8878',
    mage: '#81788e',
    rogue: '#8d6f74',
    priest: '#a49773',
    bard: '#6b858c',
  }
  return (
    <svg className={small ? 'portrait small' : 'portrait'} viewBox="0 0 120 140" aria-hidden="true">
      <circle cx="60" cy="62" r="45" fill={colors[hero]} opacity=".13" />
      <path d="M19 138c2-27 16-44 41-44s40 17 42 44" fill={colors[hero]} opacity=".8" />
      <path d="m45 90 15 23 15-23" fill="#263132" />
      <path d="M41 59c0-23 38-23 38 0v16c0 26-38 26-38 0z" fill="#aa9784" />
      <path d="M39 62c-8-26 5-40 23-40 21 0 29 20 18 41l-5-13-30 2z" fill="#293537" />
      <path d="M51 69h3m13 0h3" stroke="#354041" strokeWidth="3" strokeLinecap="round" />
      <path d="m57 82 7 0" stroke="#9c786a" strokeWidth="2" strokeLinecap="round" />
      {hero === 'warden' && (
        <>
          <path d="m35 52 8-27 17-8 18 8 8 27-26-9z" fill="#758b90" />
          <path d="M55 19h10v30H55z" fill="#afbdba" />
          <path d="m15 96 30 7v27l-15 10-15-10z" fill="#526871" stroke="#b2a181" strokeWidth="3" />
          <path d="M30 107v23m-8-16h16" stroke="#b2a181" strokeWidth="3" />
        </>
      )}
      {hero === 'ranger' && (
        <>
          <path d="M29 67c-4-49 45-62 62-4L76 50 60 37 43 55z" fill="#446e52" />
          <path d="M92 80c22 16 22 38 0 55l5-28z" fill="none" stroke="#a78b65" strokeWidth="3" />
          <path d="m97 107 12-3" stroke="#e1c48d" strokeWidth="2" />
        </>
      )}
      {hero === 'mage' && (
        <>
          <path d="m30 46 32-43 17 44 18 7H26z" fill="#756290" />
          <path d="m34 42 44 2" stroke="#bbaacb" strokeWidth="3" />
          <path d="m23 137 5-66" stroke="#97795e" strokeWidth="5" />
          <path d="m28 56 9 11-9 12-9-12z" fill="#b9d4de" />
          <circle cx="28" cy="67" r="17" fill="#b9d4de" opacity=".1" />
        </>
      )}
      {hero === 'rogue' && (
        <>
          <path d="M32 65c-5-47 56-59 58-2L72 46 60 34 42 53z" fill="#6d4754" />
          <path d="m41 75 20 7 17-7-2 15-15 7-16-7z" fill="#473946" />
          <path d="m93 92-8 33 8-4 6-26z" fill="#b5c2c3" />
          <path d="m79 121 21 5" stroke="#a38263" strokeWidth="3" />
        </>
      )}
      {hero === 'priest' && (
        <>
          <path d="m35 60 6-27 38 0 7 27-12-10-28 0z" fill="#e0d3b3" />
          <circle cx="60" cy="35" r="5" fill="#ad8e45" />
          <path d="M89 99v38m-9-29h18" stroke="#dbbb66" strokeWidth="5" />
          <circle cx="60" cy="117" r="6" fill="#e9cc7c" />
        </>
      )}
      {hero === 'bard' && (
        <>
          <path d="m30 47 21-22 28 10 8 16z" fill="#568894" />
          <path d="m65 32 13-17" stroke="#d1b783" strokeWidth="4" />
          <ellipse cx="91" cy="120" rx="16" ry="19" fill="#ad875c" />
          <path d="m91 120 5-41" stroke="#806245" strokeWidth="7" />
          <path d="m87 107 2 27m5-27-2 27" stroke="#d2bc97" />
        </>
      )}
    </svg>
  )
}

export function Landscape({ area = 0, compact = false }: { area?: number; compact?: boolean }) {
  return (
    <svg
      className={`landscape${compact ? ' compact' : ''}`}
      viewBox="0 0 1100 380"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky-${area}`} x2="0" y2="1">
          <stop stopColor={['#344447', '#393641', '#2e3c49'][area]} />
          <stop offset="1" stopColor={['#222b2e', '#25252c', '#232b33'][area]} />
        </linearGradient>
        <linearGradient id={`ground-${area}`} x2="0" y2="1">
          <stop stopColor="#40514c" />
          <stop offset="1" stopColor="#1a2927" />
        </linearGradient>
      </defs>
      <rect width="1100" height="380" fill={`url(#sky-${area})`} />
      <circle cx="760" cy="82" r="34" fill="#b5bbc0" opacity=".75" />
      <path
        d="m0 210 180-120 105 65 129-91 162 149 157-124 93 55 102-70 172 150v156H0z"
        fill="#4c5b5e"
        opacity=".55"
      />
      <path
        d="m0 245 210-121 195 146 149-115 198 97 201-112 147 108v132H0z"
        fill="#344a49"
        opacity=".55"
      />
      <path d="M0 280q240-85 480 0t620-8v108H0z" fill={`url(#ground-${area})`} />
      <path d="M440 380c90-50 200-84 134-124l-9-5c115 25 76 71 103 129" fill="#6e6a59" />
      <path
        d="M0 339q200-60 360 30m430-5q180-77 310-52"
        fill="none"
        stroke="#49695b"
        strokeWidth="25"
      />
      {area === 0 && (
        <>
          {[30, 100, 185, 255, 855, 938, 1020].map((x, i) => (
            <g key={x} transform={`translate(${x},${170 + (i % 3) * 24})`}>
              <path d="M0 170V45" stroke="#536d59" strokeWidth="10" />
              <path d="m0 0-38 77h20l-33 52h102L18 77h20z" fill={i % 2 ? '#436956' : '#537c62'} />
            </g>
          ))}
          <path
            d="m360 280 10-51h42l10 51m-54-52 23-18 25 18"
            fill="#718571"
            stroke="#526a59"
            strokeWidth="4"
          />
        </>
      )}
      {area === 1 && (
        <>
          <path d="M260 301V165h40v24h60v-24h40v136M307 300v-68q22-37 45 0v68" fill="#697f79" />
          <path d="M746 310V152h35v27h35v-27h35v160M755 146l-12-29h41l-5 29" fill="#82948b" />
          <path d="m296 164 7-69h39l17 70" fill="#83968a" />
          <path d="M209 325h249m252 0h167" stroke="#536e64" strokeWidth="12" />
        </>
      )}
      {area === 2 && (
        <>
          <path d="m29 314 160-221 139 221m344-20 160-245 190 251" fill="#53747c" />
          <path
            d="m139 165 50-72 47 75-30-9-17-22-21 24zM775 142l57-93 65 105-36-25-27-26-25 37z"
            fill="#e2e6db"
          />
          <path d="m908 97 24-32 40 17 45-16-24 40-44-3-28 23-18-7z" fill="#54717b" opacity=".8" />
        </>
      )}
      <g fill="#aba58e">
        <circle cx="548" cy="291" r="5" />
        <path d="m545 297-6 20h16l-4-20z" />
        <circle cx="570" cy="298" r="4" />
        <path d="m567 302-4 17h13l-4-17z" />
        <circle cx="531" cy="302" r="4" />
        <path d="m528 306-4 17h13l-4-17z" />
      </g>
      <path
        d="M0 375q200-30 400 0m340 0q190-40 360-10"
        stroke="#34574e"
        strokeWidth="22"
        fill="none"
      />
    </svg>
  )
}

export function EnemyArt({ id }: { id: string }) {
  return (
    <svg className="enemy-art" viewBox="0 0 110 110" aria-hidden="true">
      <circle cx="55" cy="58" r="45" fill="currentColor" opacity=".08" />
      {id === 'wolf' ? (
        <>
          <path d="m21 64 11-34 18 10 16-4 18-18 4 41-18 29-33-5z" fill="#708888" />
          <path d="m36 48 7 9m26-7-7 7" stroke="#edd9a6" strokeWidth="4" />
          <path d="m50 66 14 0-7 10z" fill="#344b50" />
        </>
      ) : id === 'dragon' ? (
        <>
          <path d="m13 73 5-49 23 20 14-29 13 30 24-22 4 55-28-6-11 24-17-25z" fill="#607d88" />
          <path d="m33 58 15 5m17 0 14-5" stroke="#ecc57d" strokeWidth="4" />
          <path d="m43 79 14 8 15-9" stroke="#c0c4ac" strokeWidth="3" fill="none" />
        </>
      ) : id === 'guardian' ? (
        <>
          <path d="m31 23 47 0 15 70H18z" fill="#7a8d88" />
          <path d="m39 43 12 2m9 0 13-2" stroke="#dec798" strokeWidth="5" />
          <path d="M47 65h17v14H47z" fill="#485d58" />
          <path d="m20 65-12 25m81-26 13 25" stroke="#7a8d88" strokeWidth="13" />
        </>
      ) : (
        <>
          <path d="M23 100c2-30 14-44 32-44s33 14 33 44" fill="#8a7b6b" />
          <path d="M37 49V27l18-12 18 12v22L55 68z" fill="#ad9b81" />
          <path d="m36 33 19-8 19 8v13H36z" fill="#526b70" />
          <path d="M51 28h8v35h-8z" fill="#788b88" />
          <path d="m89 29-8 58" stroke="#b7c2b5" strokeWidth="5" />
        </>
      )}
    </svg>
  )
}
