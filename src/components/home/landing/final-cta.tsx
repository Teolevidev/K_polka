import Link from 'next/link';
import { SectionBand } from '@/components/layout/section-band';
import { LandingIllustration } from '@/components/layout/landing-illustration';
import { Button } from '@/components/ui/button';

/**
 * Последний экран перед подвалом.
 *
 * Одна кнопка и ничего больше. Гость дочитал страницу до конца - это
 * самый заинтересованный читатель, какой у нас будет, и предлагать ему
 * выбор из трех действий здесь незачем.
 *
 * Лента светлая: перед ней зеленый «Выбор администратора», после нее
 * темный подвал. Две ленты одного цвета подряд в системе не идут, и
 * зеленый CTA слился бы с каталогом в одну длинную полосу.
 */
export function FinalCta({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <SectionBand tone="cream" className="py-14 sm:py-20">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <LandingIllustration
          name="illo-book-stack"
          frameClassName="w-28 sm:w-36"
        />

        <h2 className="font-serif text-2xl leading-tight text-balance sm:text-3xl">
          {signedIn ? 'С возвращением' : 'Читать интереснее вместе'}
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          {signedIn
            ? 'Ваша полка, цели и обсуждения ждут в кабинете.'
            : 'Небольшой закрытый клуб, своя полка и разговор о прочитанном. Вступление занимает минуту.'}
        </p>

        <Button size="lg" asChild>
          <Link href={signedIn ? '/profile' : '/signin'}>
            {signedIn ? 'В мой кабинет' : 'Вступить в клуб'}
          </Link>
        </Button>
      </div>
    </SectionBand>
  );
}
