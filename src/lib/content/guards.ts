/**
 * Проверки текста перед сохранением.
 *
 * Дешевая часть контроля качества: правила проекта и очевидные признаки
 * брака ловятся кодом, а не глазами. Человеку остается то, ради чего
 * он и нужен, - решить, интересно ли написано.
 *
 * Модуль намеренно без зависимостей: те же функции гоняются в тестах и
 * могут зваться из скрипта.
 */

/** Правило проекта: всегда обычная «е». */
const YO_RE = /[ёЁ]/g;

/** Правило проекта: длинного и среднего тире не бывает, только дефис. */
const DASH_RE = /[—–]/g;

/**
 * Приводит текст к правилам проекта.
 *
 * Не «проверяет и ругается», а чинит: модель ставит «ё» и длинное тире
 * в каждом втором абзаце, и возвращать из-за этого весь текст на
 * переписывание - дороже и бессмысленнее, чем заменить два символа.
 */
export function applyTextRules(input: string): string {
  return input
    .replace(YO_RE, (m) => (m === 'Ё' ? 'Е' : 'е'))
    .replace(DASH_RE, '-')
    // Модель любит неразрывные пробелы после замены тире.
    .replace(/\u00a0/g, ' ')
    // Три и больше пустых строк подряд - следы генерации, а не верстка.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Остались ли в тексте нарушения правил. Для тестов и отчета. */
export function findTextRuleViolations(input: string): string[] {
  const problems: string[] = [];
  if (YO_RE.test(input)) problems.push('в тексте есть «е» с точками');
  YO_RE.lastIndex = 0;
  if (DASH_RE.test(input)) problems.push('в тексте есть длинное тире');
  DASH_RE.lastIndex = 0;
  return problems;
}

/** Таблица транслитерации для slug. */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch',
  ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Адрес статьи из заголовка.
 *
 * Латиница, потому что slug попадает в URL и в ссылки, которыми
 * делятся: кириллический адрес в мессенджере превращается в
 * процентную кашу на пол-экрана.
 */
export function slugify(input: string, maxLength = 60): string {
  const base = input
    .toLowerCase()
    .replace(YO_RE, 'е')
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= maxLength) return base;
  // Режем по границе слова, чтобы не получить обрубок посреди слова.
  const cut = base.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut;
}

/** Тот же формат slug, что требует saveArticle. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;

export interface DraftCheckInput {
  title: string;
  excerpt: string;
  bodyMd: string;
  /** Книга, о которой текст. Нужна, чтобы поймать выдуманные факты. */
  book?: { title: string; authors: string[] } | null;
  minBodyLength?: number;
  maxBodyLength?: number;
}

export interface DraftCheck {
  /** Ошибки: с ними черновик не сохраняется. */
  errors: string[];
  /** Замечания: сохраняем, но показываем человеку в админке. */
  warnings: string[];
}

/**
 * Проверяет черновик статьи.
 *
 * Главное здесь - не длина и не пунктуация, а последняя проверка:
 * текст о книге обязан называть ее автора. Модель, которая не удержала
 * в голове, о чьей книге пишет, наверняка придумала и все остальное.
 */
export function checkArticleDraft(input: DraftCheckInput): DraftCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = input.title.trim();
  const body = input.bodyMd.trim();
  const excerpt = input.excerpt.trim();
  const minBody = input.minBodyLength ?? 800;
  const maxBody = input.maxBodyLength ?? 20_000;

  if (title.length < 5) errors.push('заголовок короче пяти знаков');
  if (title.length > 140) errors.push('заголовок длиннее 140 знаков');
  if (body.length < minBody) {
    errors.push(`текст короче ${minBody} знаков (${body.length})`);
  }
  if (body.length > maxBody) {
    errors.push(`текст длиннее ${maxBody} знаков (${body.length})`);
  }
  if (!excerpt) warnings.push('нет короткого описания');
  else if (excerpt.length > 300) warnings.push('описание длиннее 300 знаков');

  errors.push(...findTextRuleViolations(title));
  errors.push(...findTextRuleViolations(body));

  // Заголовок первого уровня в теле не нужен: его рисует страница
  // статьи, и в тексте он дает вторую «шапку».
  if (/^#\s/m.test(body)) {
    warnings.push('в тексте есть заголовок первого уровня');
  }

  // Следы генерации, по которым текст видно сразу.
  if (/^(Конечно|Вот|Разумеется)[,!]/.test(body)) {
    errors.push('текст начинается с ответа ассистента, а не с самой статьи');
  }
  if (/\bкак (?:ии|языковая модель|искусственный интеллект)\b/i.test(body)) {
    errors.push('модель говорит о себе - это не редакционный текст');
  }

  if (input.book) {
    const haystack = `${title}\n${body}`.toLowerCase();

    // Фамилия автора: последнее слово имени. У «Габриэль Гарсиа Маркес»
    // это «Маркес» - именно так его называют в тексте.
    const surnames = input.book.authors
      .map((a) => a.trim().split(/\s+/).pop() ?? '')
      .filter((s) => s.length > 2)
      .map((s) => s.toLowerCase());

    if (surnames.length > 0 && !surnames.some((s) => haystack.includes(s))) {
      errors.push(
        `в тексте не назван автор книги (${input.book.authors.join(', ')})`,
      );
    }

    // Название: сверяем по самому длинному слову - падежи и кавычки
    // делают точное сравнение бесполезным.
    const titleWord = input.book.title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 4)
      .sort((a, b) => b.length - a.length)[0];
    if (titleWord && !haystack.includes(titleWord.slice(0, -1))) {
      warnings.push(`в тексте не упомянуто название книги «${input.book.title}»`);
    }
  }

  return { errors, warnings };
}
