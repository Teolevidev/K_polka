/**
 * Заглушка Telegram-доставки.
 *
 * Полная схема: пользователь /start-ит нашего бота, бот по webhook
 * записывает chat_id в profile.telegram_chat_id, мы шлём через
 * https://api.telegram.org/bot{TOKEN}/sendMessage. Эта инфраструктура
 * подключается в следующем чанке.
 */
export async function sendTelegram(_input: {
  username: string;
  text: string;
}): Promise<boolean> {
  // Логируем намерение — реальная отправка появится после настройки бота.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[telegram] reminder pending bot setup for', _input.username);
  }
  return false;
}
