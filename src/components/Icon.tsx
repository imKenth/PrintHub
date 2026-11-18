type IconName =
  | 'printer'
  | 'home'
  | 'clipboard'
  | 'clock'
  | 'users'
  | 'settings'
  | 'logout'
  | 'arrow'
  | 'plus'
  | 'check'
  | 'close'
  | 'search'
  | 'package'
  | 'file'
  | 'upload'
  | 'download'
  | 'chevron'
  | 'menu'
  | 'phone'
  | 'mail'
  | 'calendar'
  | 'filter'
  | 'eye'
  | 'eyeOff'
  | 'sparkles'
  | 'shield'
  | 'star'
  | 'wallet'
  | 'trend'
  | 'copy'
  | 'info'
  | 'lock'
  | 'photo'
  | 'palette'
  | 'document'
  | 'heart'
  | 'external'
  | 'minus'

const iconUrls = import.meta.glob<string>('../assets/icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?url&no-inline',
})

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <use href={`${iconUrls[`../assets/icons/${name}.svg`]}#icon`} />
    </svg>
  )
}
