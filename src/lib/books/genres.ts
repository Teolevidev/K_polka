/**
 * Жанры Google Books - в человеческий вид.
 *
 * Google отдает категории в виде путей классификации BISAC на
 * английском: «Fiction / Science Fiction / Space Opera». Показывать это
 * читателю как есть нельзя - на русской странице появляются английские
 * строки со слэшами.
 *
 * На сайте Google жанры выглядят иначе («Научная фантастика, Роман»),
 * но берутся они не из API, а из их графа знаний, и через API
 * недоступны. Поэтому переводим сами: берем последний осмысленный
 * уровень пути и ищем его в словаре.
 */

/** Уровни, которые ничего не добавляют и только занимают место. */
const EMPTY_LEVELS = new Set(['general', 'other', 'miscellaneous']);

const DICTIONARY: Record<string, string> = {
  // Крупные разделы
  fiction: 'Художественная литература',
  'juvenile fiction': 'Детская литература',
  'young adult fiction': 'Подростковая литература',
  biography: 'Биографии',
  'biography & autobiography': 'Биографии',
  history: 'История',
  philosophy: 'Философия',
  psychology: 'Психология',
  science: 'Наука',
  'business & economics': 'Бизнес и экономика',
  'self-help': 'Саморазвитие',
  'literary collections': 'Литературные сборники',
  'literary criticism': 'Литературная критика',
  poetry: 'Поэзия',
  drama: 'Драматургия',
  travel: 'Путешествия',
  cooking: 'Кулинария',
  art: 'Искусство',
  religion: 'Религия',
  medical: 'Медицина',
  computers: 'Компьютеры',
  'political science': 'Политика',
  'social science': 'Общественные науки',
  education: 'Образование',
  'true crime': 'Криминальная документалистика',
  'health & fitness': 'Здоровье',
  'family & relationships': 'Семья и отношения',
  'performing arts': 'Исполнительские искусства',
  'comics & graphic novels': 'Комиксы',

  // Жанры прозы
  'science fiction': 'Научная фантастика',
  'space opera': 'Космическая опера',
  fantasy: 'Фэнтези',
  'hard science fiction': 'Твердая научная фантастика',
  dystopian: 'Антиутопия',
  'alternative history': 'Альтернативная история',
  thrillers: 'Триллер',
  suspense: 'Саспенс',
  mystery: 'Детектив',
  'mystery & detective': 'Детектив',
  horror: 'Ужасы',
  romance: 'Романтическая проза',
  historical: 'Историческая проза',
  literary: 'Современная проза',
  classics: 'Классика',
  humorous: 'Юмористическая проза',
  satire: 'Сатира',
  war: 'Военная проза',
  'coming of age': 'Взросление',
  'short stories': 'Рассказы',
  'short stories (single author)': 'Рассказы',
  essays: 'Эссе',
  adventure: 'Приключения',
  action: 'Приключения',
  psychological: 'Психологическая проза',
  'magical realism': 'Магический реализм',
};

/**
 * Один жанр в человеческом виде.
 *
 * «Fiction / Science Fiction / Space Opera» -> «Космическая опера»:
 * последний уровень точнее всего описывает книгу. Если он ничего не
 * значит («General»), поднимаемся на уровень выше.
 */
export function localizeGenre(raw: string): string {
  const levels = raw
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !EMPTY_LEVELS.has(part.toLowerCase()));

  if (levels.length === 0) return raw.trim();

  // От самого точного уровня к самому общему: первый, который знаем.
  for (let i = levels.length - 1; i >= 0; i--) {
    const translated = DICTIONARY[levels[i].toLowerCase()];
    if (translated) return translated;
  }

  // Ничего не знаем - показываем самый точный уровень как есть.
  return levels[levels.length - 1];
}

/**
 * Список жанров книги: переведенный, без повторов и без пустых.
 *
 * Повторы неизбежны: два разных пути BISAC часто сходятся в один жанр,
 * и без склейки на карточке появляются два одинаковых значка.
 */
export function localizeGenres(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const name = localizeGenre(item);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
