import { useId } from 'react';

function Bloom({ x, y, color, scale = 1, turn = 0 }: { x: number; y: number; color: string; scale?: number; turn?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => <path key={angle} transform={`rotate(${angle})`} d="M-7-9C-22-24-9-45 0-36C12-46 22-23 7-9Z" fill={color} />)}
    <circle r="11" fill="#ffcf68" />
    <circle cx="-3" cy="-1" r="1.2" fill="#704a35" />
    <circle cx="3" cy="-1" r="1.2" fill="#704a35" />
    <path d="M-3 4Q0 7 3 4" fill="none" stroke="#704a35" strokeWidth="1.2" strokeLinecap="round" />
  </g>;
}

export function ConnectionMark() {
  return <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none">
    <path d="M24 40C24 29 14 29 14 17M24 40C24 28 34 28 34 19" stroke="#527650" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M23 34C14 34 11 29 13 27C18 25 22 30 23 34ZM25 34C33 35 38 29 36 27C31 26 27 30 25 34Z" fill="#8aa57a" />
    <g fill="#cf6b91"><ellipse cx="14" cy="11" rx="4" ry="6" /><ellipse cx="8" cy="17" rx="6" ry="4" /><ellipse cx="20" cy="17" rx="6" ry="4" /><ellipse cx="14" cy="23" rx="4" ry="6" /></g>
    <g fill="#aaa4da"><ellipse cx="34" cy="13" rx="3.5" ry="5" /><ellipse cx="29" cy="19" rx="5" ry="3.5" /><ellipse cx="39" cy="19" rx="5" ry="3.5" /><ellipse cx="34" cy="25" rx="3.5" ry="5" /></g>
    <circle cx="14" cy="17" r="4" fill="#f9d482" /><circle cx="34" cy="19" r="3.5" fill="#f9d482" />
  </svg>;
}

export function FloralSticker({ className = '', color = '#efadc9' }: { className?: string; color?: string }) {
  return <svg className={className} viewBox="0 0 100 110" width="58" height="64" fill="none" aria-hidden="true">
    <path d="M49 98Q59 73 50 41" stroke="#65835a" strokeWidth="4" strokeLinecap="round" />
    <path d="M53 83Q26 77 28 63Q45 63 53 83M53 80Q71 57 82 63Q80 79 53 87" fill="#a5b98b" />
    <Bloom x={49} y={39} color={color} scale={.82} turn={8} />
  </svg>;
}

export function FloralBorder() {
  const id = useId();
  return <svg className="card-floral-border" viewBox="0 0 400 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><pattern id={id} width="67" height="24" patternUnits="userSpaceOnUse">
      <path d="M0 15Q17 6 34 15T67 15" fill="none" stroke="#6a865b" strokeWidth="1.2" />
      <path d="M8 11Q6 2 15 5Q15 11 8 11M44 15Q48 23 54 18Q51 12 44 15" fill="#9bae7b" />
      <g fill="#ca7194"><ellipse cx="31" cy="6" rx="2.7" ry="4" /><ellipse cx="26" cy="10" rx="4" ry="2.7" /><ellipse cx="36" cy="10" rx="4" ry="2.7" /><ellipse cx="31" cy="14" rx="2.7" ry="4" /></g><circle cx="31" cy="10" r="2.5" fill="#f5cf75" />
    </pattern></defs><rect width="400" height="24" fill={`url(#${id})`} />
  </svg>;
}

export function BotanicalArt({ className = '', variant = 'bouquet' }: { className?: string; variant?: 'bouquet' | 'sprig' }) {
  return <svg className={className} viewBox="0 0 280 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {variant === 'bouquet' ? <>
      <path d="M135 273Q139 197 82 99M139 274Q162 181 199 63M139 276Q130 204 139 150" stroke="#acc38c" strokeWidth="6" strokeLinecap="round" />
      <path d="M113 172Q60 132 49 159Q71 190 119 189M151 200Q194 149 222 169Q204 206 147 219M137 239Q86 211 76 233Q96 258 139 254M167 142Q179 98 203 107Q204 136 163 158" fill="#c4d299" />
      <path d="M116 183Q79 168 59 163M154 208Q187 185 213 177M138 249Q108 236 83 238" stroke="#647d48" strokeWidth="2" strokeLinecap="round" />
      <Bloom x={81} y={94} color="#f8a9c5" turn={-14} />
      <Bloom x={199} y={62} color="#f6a352" scale={.81} turn={18} />
      <Bloom x={141} y={151} color="#c5c9f4" scale={.74} turn={9} />
      <path d="M111 260Q136 248 163 260L153 283L126 289Z" fill="#f3b2ca" />
      <path d="M136 266Q102 240 98 259Q101 279 136 266ZM139 266Q169 239 178 254Q180 275 139 266Z" fill="#f8d488" />
      <path d="M139 267L125 294M141 268L155 293" stroke="#f8d488" strokeWidth="7" strokeLinecap="round" />
      <path d="M39 76L42 65L46 77L57 81L45 85L41 97L38 84L27 80Z" fill="#f5cf7b" />
      <path d="M232 121L236 112L239 123L249 127L238 130L234 140L231 128L222 125Z" fill="#f5cf7b" />
    </> : <>
      <path d="M134 278C157 206 102 162 143 87M135 226Q178 190 202 143M132 195Q91 174 74 127" stroke="#53743d" strokeWidth="6" strokeLinecap="round" />
      <path d="M138 254Q92 215 76 238Q92 267 138 266M150 216Q181 231 200 207Q177 188 150 216M126 177Q94 150 78 169Q93 190 130 192M142 131Q183 112 179 92Q149 91 142 131" fill="#8fa56c" />
      <Bloom x={147} y={69} color="#ef80ac" scale={.9} turn={17} />
      <Bloom x={207} y={130} color="#f09b3e" scale={.68} turn={-14} />
      <Bloom x={69} y={112} color="#b4bde9" scale={.65} />
      <path d="M53 212Q28 197 31 212Q33 224 53 221Q73 224 75 211Q73 197 53 212Z" fill="#ef80ac" />
      <path d="M53 210L53 225" stroke="#9b5472" strokeWidth="2" strokeLinecap="round" />
      <path d="M219 228L223 217L227 229L238 232L226 236L222 248L219 235L208 231Z" fill="#f6b951" />
    </>}
  </svg>;
}
