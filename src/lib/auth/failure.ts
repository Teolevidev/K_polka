/**
 * Причина неудачного входа - в понятных приложению словах.
 *
 * Раньше любая осечка сводилась к одному «ссылка устарела»: и просроченное
 * письмо, и не включенный в Supabase провайдер, и отказ в окне Google
 * выглядели одинаково. Человек видел совет «запросите новую ссылку» там,
 * где новая ссылка ничего не меняла.
 */
export type SignInFailure =
  | 'expired' // письмо просрочено или ссылку уже использовали
  | 'denied' // человек отказался в окне провайдера
  | 'provider' // провайдер не включен или настроен неверно
  | 'exchange' // код пришел, но обменять его на сессию не вышло
  | 'auth'; // причина неизвестна

/** Переводит ответ Supabase в причину, понятную странице входа. */
export function classifyCallbackError(
  error: string | null,
  errorCode: string | null,
): SignInFailure {
  if (errorCode === 'otp_expired' || error === 'expired_token') return 'expired';
  // Supabase отдает access_denied и на отказ пользователя, и на
  // просроченную ссылку - различает их только error_code.
  if (error === 'access_denied') return 'denied';
  if (error === 'server_error' || error === 'unauthorized_client') return 'provider';
  return 'auth';
}

/** Текст для страницы входа: что случилось и что с этим делать. */
export const FAILURE_MESSAGES: Record<SignInFailure, string> = {
  expired:
    'Ссылка для входа устарела или уже была использована. Запросите новую - она действует час.',
  denied: 'Вход отменен в окне провайдера. Попробуйте еще раз или войдите по почте.',
  provider:
    'Провайдер входа сейчас недоступен. Попробуйте войти по ссылке на почту.',
  exchange:
    'Не удалось завершить вход. Проверьте, что открываете ссылку в том же браузере, где ее запрашивали.',
  auth: 'Не удалось завершить вход. Попробуйте еще раз.',
};

/** Разбирает значение из ?error=... в известную причину. */
export function parseFailure(value: string | undefined): SignInFailure | null {
  if (!value) return null;
  return value in FAILURE_MESSAGES ? (value as SignInFailure) : 'auth';
}
