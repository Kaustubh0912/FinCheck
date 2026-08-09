import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { api, errMessage, TOKEN_KEY } from './client';

describe('client utilities', () => {
  it('errMessage extracts from Error', () => {
    const err = new Error('Test error');
    expect(errMessage(err)).toBe('Test error');
  });

  it('errMessage returns fallback for unknown', () => {
    expect(errMessage(null)).toBe('Something went wrong');
  });

  it('extracts axios response messages in priority order', () => {
    expect(errMessage(new axios.AxiosError('x'))).toBe('x');
  });

  it('extracts string and nested axios error payloads', () => {
    const stringPayload = new axios.AxiosError('network');
    stringPayload.response = { data: { error: 'Invalid request' } } as never;
    expect(errMessage(stringPayload)).toBe('Invalid request');

    const nestedPayload = new axios.AxiosError('network');
    nestedPayload.response = { data: { error: { message: 'Detailed failure' } } } as never;
    expect(errMessage(nestedPayload)).toBe('Detailed failure');
  });

  it('uses axios error and custom fallback when no response message exists', () => {
    expect(errMessage(new axios.AxiosError('Network down'))).toBe('Network down');
    expect(errMessage(new axios.AxiosError(''), 'Please try again')).toBe('Please try again');
  });

  it('adds the stored token to outgoing requests', () => {
    const getItem = vi.fn().mockReturnValue('token-123');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem },
    });

    const requestInterceptor = (api.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: { headers: Record<string, string> }) => { headers: Record<string, string> } }>;
    }).handlers[0].fulfilled;
    const config = { headers: {} };

    expect(requestInterceptor(config).headers.Authorization).toBe('Bearer token-123');
    expect(getItem).toHaveBeenCalledWith(TOKEN_KEY);
  });

  it('clears the token and emits an event after a 401 response', async () => {
    const removeItem = vi.fn();
    const dispatchEvent = vi.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { removeItem },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent },
    });

    const responseInterceptor = (api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: { response?: { status: number } }) => Promise<never> }>;
    }).handlers[0].rejected;
    const error = { response: { status: 401 } };

    await expect(responseInterceptor(error)).rejects.toBe(error);
    expect(removeItem).toHaveBeenCalledWith(TOKEN_KEY);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(Event));
  });

  it('passes successful responses through unchanged', () => {
    const responseInterceptor = (api.interceptors.response as unknown as {
      handlers: Array<{ fulfilled: (response: { status: number }) => { status: number } }>;
    }).handlers[0].fulfilled;
    const response = { status: 200 };

    expect(responseInterceptor(response)).toBe(response);
  });
});
