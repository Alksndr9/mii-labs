import { useState } from 'react'

interface MealImageProps {
  src: string
  alt: string
  className?: string
}

/** Фото рациона с заглушкой, если картинка не загрузилась (нет сети, блокировка CDN, битая ссылка). */
export function MealImage({ src, alt, className = '' }: MealImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed || !src)
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-lime-100 text-5xl ${className}`}>
        🥗
      </div>
    )
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`bg-lime-100 object-cover ${className}`} />
}
