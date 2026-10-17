import type { AdventureId } from './adventures';

export function RelationshipArt({ kind, variant = 0, className = '' }: { kind: string; variant?: number; className?: string }) {
  const world = kind as AdventureId;
  return <svg className={`relationship-art ${className}`} viewBox="0 0 240 150" aria-hidden="true" focusable="false">
    <rect x="13" y="10" width="214" height="130" rx="24" fill="var(--surface-yellow)" stroke="var(--brand-sage)" strokeWidth="2" />
    <path d="M26 117Q82 97 122 117T214 116" fill="none" stroke="var(--brand-sage)" strokeWidth="2" strokeDasharray="4 5" />
    <circle cx={variant % 2 ? 190 : 43} cy="35" r="11" fill="var(--brand-yellow)" />
    {kind === 'if-i-were-you' ? <g stroke="var(--brand-forest)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M46 96V55H113V96L80 120Z" fill="var(--brand-blush)" /><path d="M48 57L80 83L112 57" fill="none" />
      <path d="M127 108V67H194V108L161 128Z" fill="var(--surface-sage)" /><path d="M129 69L161 95L193 69" fill="none" />
      <path d="M92 40Q118 15 145 43M134 35L146 44L148 30" fill="none" stroke="var(--brand-pink)" />
    </g> : kind === 'when-things-get-hard' ? <g stroke="var(--brand-forest)" strokeWidth="3" strokeLinecap="round">
      <path d="M42 104Q78 44 118 103M123 103Q165 44 199 104" fill="var(--brand-blush)" />
      <path d="M63 108Q120 71 179 108M83 93V117M105 86V118M130 86V118M155 94V118" fill="none" />
      <path d="M109 47Q97 34 107 27Q116 20 121 32Q129 20 137 29Q146 41 122 55Z" fill="var(--brand-pink)" stroke="none" />
    </g> : world === 'restaurant' ? <g stroke="var(--brand-forest)" strokeWidth="3" strokeLinejoin="round">
      <path d="M52 63H190V120H52Z" fill="var(--brand-blush)" /><path d="M42 62L58 38H184L200 62Z" fill="var(--brand-pink)" /><path d="M104 120V80H137V120" fill="var(--surface-yellow)" /><circle cx="75" cy="91" r="12" fill="var(--surface-sage)" /><circle cx="166" cy="91" r="12" fill="var(--surface-sage)" />
    </g> : world === 'aliens' ? <g stroke="var(--brand-forest)" strokeWidth="3">
      <path d="M69 109Q44 83 67 60Q86 36 105 61Q127 87 102 109Z" fill="var(--brand-sage)" /><path d="M139 113Q117 77 144 60Q170 45 187 78Q202 107 175 114Z" fill="var(--brand-blush)" /><circle cx="78" cy="76" r="5" fill="var(--brand-forest)" /><circle cx="99" cy="76" r="5" fill="var(--brand-forest)" /><circle cx="150" cy="83" r="4" fill="var(--brand-forest)" /><circle cx="171" cy="83" r="4" fill="var(--brand-forest)" /><path d="M109 114Q120 92 137 112" fill="none" stroke="var(--brand-pink)" />
    </g> : world === 'spaceship' ? <g stroke="var(--brand-forest)" strokeWidth="3" strokeLinejoin="round">
      <path d="M91 109L90 66L121 28L151 66V109Z" fill="var(--brand-blush)" /><path d="M90 79L66 115L91 109M151 79L176 115L151 109" fill="var(--brand-sage)" /><circle cx="121" cy="72" r="15" fill="var(--surface-yellow)" /><path d="M109 114L121 134L133 114" fill="var(--brand-yellow)" /><path d="M181 41L185 32L189 41L198 45L189 49L185 58L181 49L172 45Z" fill="var(--brand-pink)" stroke="none" />
    </g> : <g stroke="var(--brand-forest)" strokeWidth="3" strokeLinejoin="round">
      <path d="M43 114L86 54L125 114Z" fill="var(--brand-blush)" /><path d="M86 54L101 114H125" fill="var(--brand-sage)" /><path d="M144 113L157 50M157 57Q127 28 124 55Q144 68 157 57M157 57Q179 31 194 54Q175 72 157 57" fill="var(--brand-sage)" /><path d="M125 121Q166 113 205 121" fill="none" />
    </g>}
    <path d="M207 80L211 87L218 91L211 95L207 102L203 95L196 91L203 87Z" fill="var(--brand-yellow)" />
  </svg>;
}

export function AdventureObject({ index }: { index: number }) {
  return <svg className="adventure-object" viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="12" fill="var(--surface-yellow)" stroke="var(--brand-sage)" />
    {index % 4 === 0 ? <><path d="M19 10H29V17L33 23V37H15V23L19 17Z" fill="var(--brand-blush)" stroke="var(--brand-forest)" strokeWidth="2" /><path d="M16 28Q24 23 32 28" fill="none" stroke="var(--brand-pink)" strokeWidth="2" /></>
      : index % 4 === 1 ? <path d="M9 36L24 12L39 36ZM24 12V36" fill="var(--brand-blush)" stroke="var(--brand-forest)" strokeWidth="2" />
        : index % 4 === 2 ? <><circle cx="24" cy="24" r="12" fill="var(--brand-blush)" stroke="var(--brand-forest)" strokeWidth="2" /><path d="M19 28L29 18M26 28L31 23" stroke="var(--brand-pink)" strokeWidth="2" /></>
          : <><rect x="13" y="15" width="22" height="21" rx="4" fill="var(--brand-sage)" stroke="var(--brand-forest)" strokeWidth="2" /><path d="M20 15V10H28V15M24 21V30M19 25H29" fill="none" stroke="var(--brand-blush)" strokeWidth="3" /></>}
  </svg>;
}
