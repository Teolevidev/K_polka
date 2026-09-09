import { describe, it, expect } from 'vitest';
import {
  classifyCallbackError,
  parseFailure,
  FAILURE_MESSAGES,
} from '@/lib/auth/failure';

describe('разбор ошибки входа', () => {
  it('просроченная ссылка распознается по error_code', () => {
    expect(classifyCallbackError('access_denied', 'otp_expired')).toBe('expired');
  });

  it('отказ в окне провайдера отличается от просроченной ссылки', () => {
    // Supabase на оба случая отдает access_denied, различает только код.
    expect(classifyCallbackError('access_denied', null)).toBe('denied');
  });

  it('сбой провайдера не предлагает запросить новую ссылку', () => {
    expect(classifyCallbackError('server_error', null)).toBe('provider');
    expect(classifyCallbackError('unauthorized_client', null)).toBe('provider');
  });

  it('незнакомая ошибка сводится к общей причине', () => {
    expect(classifyCallbackError('что-то новое', null)).toBe('auth');
    expect(classifyCallbackError(null, null)).toBe('auth');
  });

  it('у каждой причины есть текст для человека', () => {
    for (const reason of Object.keys(FAILURE_MESSAGES)) {
      expect(FAILURE_MESSAGES[reason as keyof typeof FAILURE_MESSAGES].length)
        .toBeGreaterThan(20);
    }
  });
});

describe('чтение ?error= со страницы входа', () => {
  it('без параметра ошибки нет', () => {
    expect(parseFailure(undefined)).toBeNull();
    expect(parseFailure('')).toBeNull();
  });

  it('известная причина проходит как есть', () => {
    expect(parseFailure('expired')).toBe('expired');
    expect(parseFailure('provider')).toBe('provider');
  });

  it('чужое значение в адресе не роняет страницу', () => {
    expect(parseFailure('<script>')).toBe('auth');
  });
});
