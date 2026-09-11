import { LoadingPill } from '@/components/ui/grid-loader';
import { PageHeader } from '@/components/layout/page-header';

/**
 * Экран ожидания выдачи.
 *
 * Поиск опрашивает три каталога и ждет самый медленный из них, поэтому
 * пауза заметная. Без этого экрана страница просто замирала на старой
 * выдаче, и было непонятно, идет ли что-нибудь вообще.
 *
 * Шапка повторяет настоящую, чтобы при появлении результатов страница
 * не прыгала.
 */
export default function SearchLoading() {
  return (
    <div>
      <PageHeader
        title="Поиск книг"
        subtitle="Ищите по названию, автору или ISBN. Поиск понимает опечатки."
        compact
      />
      <div className="container flex justify-center py-16">
        <LoadingPill pattern="wave">Ищу в каталогах</LoadingPill>
      </div>
    </div>
  );
}
