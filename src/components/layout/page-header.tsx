import { SectionBand } from './section-band';
import { BackButton } from './back-button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Действия или подсказка под заголовком. */
  children?: React.ReactNode;
  /** Узкая шапка - для страниц, где заголовок вспомогательный. */
  compact?: boolean;
}

/**
 * Зеленая шапка внутренней страницы.
 *
 * Главная открывается зеленой лентой, а внутри до сих пор все было
 * бежевым: провалившись в раздел, читатель попадал будто в другое
 * приложение. Одинаковая шапка на всех страницах связывает их обратно -
 * и это дешевле, чем красить каждый раздел по-своему.
 *
 * Она же решает практическую задачу: заголовки разделов были набраны
 * гротеском вперемешку с серифом. Здесь он один на все страницы.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  compact = false,
}: PageHeaderProps) {
  return (
    <SectionBand
      tone="forest"
      className={compact ? 'py-7 sm:py-8' : 'py-9 sm:py-12'}
    >
      <div className="mb-3">
        <BackButton onBand />
      </div>
      <div className="max-w-3xl space-y-3">
        <h1
          className={
            compact
              ? 'font-serif text-2xl leading-tight sm:text-3xl'
              : 'font-serif text-3xl leading-tight sm:text-4xl'
          }
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-base leading-relaxed opacity-85">{subtitle}</p>
        )}
        {children}
      </div>
    </SectionBand>
  );
}
