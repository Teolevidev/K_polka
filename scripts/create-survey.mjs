#!/usr/bin/env node
/**
 * Книжный клуб - генератор опроса в Tally (form-as-code).
 *
 * Что делает: одним POST-запросом к Tally API создает готовую форму -
 * обложку, 12 вопросов по одному на экран, прогресс-бар и премиум-тему.
 *
 * Запуск (ключ не попадает в историю оболочки):
 *   node --env-file=.env.local scripts/create-survey.mjs      // Node 20.6+
 * либо:
 *   TALLY_API_KEY=tly-xxxxx node scripts/create-survey.mjs
 * либо просто отдай этот файл Claude Code и скажи запустить -
 *   ключ он возьмет из .env.local сам.
 *
 * Ключ берется из переменной окружения TALLY_API_KEY. В сам файл его не вписывай.
 */

import { randomUUID } from 'node:crypto';

const API_KEY = process.env.TALLY_API_KEY;
if (!API_KEY) {
  console.error('Нет TALLY_API_KEY. Задай переменную окружения и запусти снова.');
  process.exit(1);
}

// ─── Опрос: единственное, что нужно править ───────────────────────────────────
const COVER = {
  title: 'Книжный клуб. Помоги собрать его правильно',
  intro:
    'Мы читаем похожее и сидим в одном офисе - грех этим не воспользоваться. ' +
    'Хочу запустить закрытый клуб и трекер прочитанного и собрать его под нас, ' +
    'а не по шаблону. 3 минуты - и ты влияешь на то, каким он будет. - Тео',
};

// type: 'single' (один ответ) | 'multi' (несколько) | 'text' | 'name'
// max: для 'multi' - максимум выбираемых вариантов
const QUESTIONS = [
  { type: 'single', required: true,
    title: 'Насколько тебе интересно участвовать в закрытом книжном клубе с коллегами?',
    options: ['Точно да', 'Скорее да', 'Пока не уверен, зависит от формата', 'Скорее нет'] },

  { type: 'single', required: true,
    title: 'Сколько книг ты в среднем прочитываешь за месяц?',
    options: ['Меньше одной', 'Примерно одну', '2-3', '4 и больше'] },

  { type: 'multi', required: true,
    title: 'В каком формате читаешь чаще всего?',
    options: ['Бумага', 'Электронка', 'Аудиокниги'] },

  { type: 'single', required: true,
    title: 'Сколько времени в неделю уходит на чтение?',
    options: ['До часа', '1-3 часа', '3-6 часов', 'Больше 6'] },

  { type: 'multi', required: true, max: 3,
    title: 'Какие жанры тебе ближе всего? (до трех)',
    options: ['Современная проза', 'Классика', 'Нон-фикшн и наука', 'Бизнес и саморазвитие',
      'Фантастика и фэнтези', 'Детективы и триллеры', 'История и биографии', 'Психология',
      'Поэзия', 'Другое'] },

  { type: 'multi', required: true, max: 3,
    title: 'Что для тебя было бы главной ценностью клуба? (до трех)',
    options: ['Обсуждать прочитанное', 'Получать рекомендации', 'Открывать новое',
      'Держать ритм и мотивацию', 'Общаться с близкими по духу', 'Вести свою полку прочитанного'] },

  { type: 'single', required: true,
    title: 'Какой формат встреч тебе ближе?',
    options: ['Полностью онлайн', 'В основном онлайн, редкие живые встречи',
      'Поровну онлайн и вживую', 'Побольше живого'] },

  { type: 'multi', required: true,
    title: 'Как удобнее обсуждать книги?',
    options: ['Текстом в чате, когда есть минута', 'Голосовые или видеосозвоны', 'Живые встречи'] },

  { type: 'single', required: true,
    title: 'Какой темп чтения комфортен?',
    options: ['Книга в месяц', 'Книга раз в 2 недели', 'Одна книга на 2-3 месяца', 'Без жестких сроков'] },

  { type: 'text', required: false,
    title: 'Был ли опыт книжных клубов или читательских чатов? Если да - почему перестал участвовать?',
    placeholder: 'Пара слов, если есть что вспомнить' },

  { type: 'text', required: true,
    title: 'Представь: завал на работе, читать почти некогда. Что удержало бы тебя в клубе, а не заставило тихо выпасть?',
    placeholder: 'Здесь самый ценный ответ' },

  { type: 'name', required: false,
    title: 'Если хочешь войти в круг основателей - оставь имя.',
    placeholder: 'Имя' },
];

// ─── Премиум-оформление (тема легко меняется под будущую айдентику приложения) ─
const SETTINGS = {
  language: 'ru',
  hasProgressBar: true,   // видимый прогресс сверху
  pageAutoJump: true,     // авто-переход после выбора - эффект Typeform
  saveForLater: true,
  styles: {
    theme: 'CUSTOM',
    color: {
      background: '#FAF7F0',        // теплая бумага
      text: '#2A2620',             // чернильный
      accent: '#7A5C3E',           // кожаный коричневый
      buttonBackground: '#7A5C3E',
      buttonText: '#FFFFFF',
    },
    direction: 'ltr',
  },
};

// ─── Сборка блоков формы ──────────────────────────────────────────────────────
const blocks = [];

const pushPageBreak = () =>
  blocks.push({ uuid: randomUUID(), type: 'PAGE_BREAK', groupUuid: randomUUID(),
    groupType: 'PAGE_BREAK', payload: {} });

const pushTitle = (html) =>
  blocks.push({ uuid: randomUUID(), type: 'TITLE', groupUuid: randomUUID(),
    groupType: 'QUESTION', payload: { html } });

// Обложка: заголовок формы + вступление
blocks.push({ uuid: randomUUID(), type: 'FORM_TITLE', groupUuid: randomUUID(),
  groupType: 'TEXT', payload: { title: COVER.title, html: COVER.title } });
blocks.push({ uuid: randomUUID(), type: 'TEXT', groupUuid: randomUUID(),
  groupType: 'TEXT', payload: { html: COVER.intro } });

for (const q of QUESTIONS) {
  pushPageBreak();          // каждый вопрос - на своем экране
  pushTitle(q.title);

  if (q.type === 'single' || q.type === 'multi') {
    const groupUuid = randomUUID();               // все опции одного вопроса делят groupUuid
    q.options.forEach((text, i) => {
      const payload = {
        index: i,
        isFirst: i === 0,
        isLast: i === q.options.length - 1,
        text,
      };
      if (i === 0) {                              // флаги задаются на первой опции группы
        payload.isRequired = !!q.required;
        if (q.type === 'multi') {
          payload.allowMultiple = true;
          if (q.max) { payload.hasMaxChoices = true; payload.maxChoices = q.max; }
        }
      }
      blocks.push({ uuid: randomUUID(), type: 'MULTIPLE_CHOICE_OPTION', groupUuid,
        groupType: 'MULTIPLE_CHOICE', payload });
    });
  } else if (q.type === 'text') {
    blocks.push({ uuid: randomUUID(), type: 'TEXTAREA', groupUuid: randomUUID(),
      groupType: 'TEXTAREA', payload: { isRequired: !!q.required, placeholder: q.placeholder || '' } });
  } else if (q.type === 'name') {
    blocks.push({ uuid: randomUUID(), type: 'INPUT_TEXT', groupUuid: randomUUID(),
      groupType: 'INPUT_TEXT', payload: { isRequired: !!q.required, placeholder: q.placeholder || '' } });
  }
}

// ─── Отправка в Tally ─────────────────────────────────────────────────────────
const body = { status: 'PUBLISHED', blocks, settings: SETTINGS };

const res = await fetch('https://api.tally.so/forms', {
  method: 'POST',
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`Tally ответил ${res.status}:`, JSON.stringify(data, null, 2));
  console.error(
    'Если это 400 - почти наверняка одна из констант groupType ' +
    '(MULTIPLE_CHOICE / PAGE_BREAK) или поле в settings.styles. ' +
    'Отдай текст ошибки Claude Code - правка на одну строку.'
  );
  process.exit(1);
}

console.log('Форма создана.');
console.log('ID:', data.id);
console.log('Ссылка для респондентов: https://tally.so/r/' + data.id);
console.log('Открой ее в дашборде Tally, проверь обложку и тему, при желании подправь.');
