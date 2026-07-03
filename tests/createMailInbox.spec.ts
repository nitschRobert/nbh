import { test, expect } from '@playwright/test';
import {
  createMailTmInbox,
  extractVerificationLink,
  waitForMailTmMessage,
} from './createMailInbox';

test.describe('createMailTmInbox', () => {
  test('creates an inbox using Mail.tm API responses', async () => {
    const originalFetch = globalThis.fetch;
    const originalDateNow = Date.now;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

    Date.now = () => 1782575034745;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      fetchCalls.push({ url, init });

      if (url === 'https://api.mail.tm/domains') {
        return new Response(
          JSON.stringify({
            'hydra:member': [{ domain: 'example.test' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'https://api.mail.tm/accounts') {
        return new Response(JSON.stringify({ id: 'account-id' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://api.mail.tm/token') {
        return new Response(JSON.stringify({ token: 'mail-tm-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    };

    try {
      const inbox = await createMailTmInbox();

      expect(inbox).toEqual({
        address: 'test-1782575034745@example.test',
        token: 'mail-tm-token',
      });

      expect(fetchCalls).toHaveLength(3);
      expect(fetchCalls[0].url).toBe('https://api.mail.tm/domains');
      expect(fetchCalls[1]).toMatchObject({
        url: 'https://api.mail.tm/accounts',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      });
      expect(JSON.parse(fetchCalls[1].init?.body as string)).toEqual({
        address: 'test-1782575034745@example.test',
        password: 'Test-1782575034745!',
      });
      expect(fetchCalls[2]).toMatchObject({
        url: 'https://api.mail.tm/token',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      });
      expect(JSON.parse(fetchCalls[2].init?.body as string)).toEqual({
        address: 'test-1782575034745@example.test',
        password: 'Test-1782575034745!',
      });
    } finally {
      globalThis.fetch = originalFetch;
      Date.now = originalDateNow;
    }
  });

  test('waits for a matching message and extracts the verification link', async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      fetchCalls.push({ url, init });

      if (url === 'https://api.mail.tm/messages') {
        return new Response(
          JSON.stringify({
            'hydra:member': [
              {
                id: 'message-id',
                subject: 'Potwierdź swój adres email - No Bad Hire',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'https://api.mail.tm/messages/message-id') {
        return new Response(
          JSON.stringify({
            id: 'message-id',
            subject: 'Potwierdź swój adres email - No Bad Hire',
            html: [
              '<a href="https://nobadhire.com/verify-email?token=abc&amp;source=email">Verify</a>',
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    };

    try {
      const message = await waitForMailTmMessage('mail-tm-token', 'Potwierdź swój adres email');
      const activationUrl = extractVerificationLink(message);

      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0]).toMatchObject({
        url: 'https://api.mail.tm/messages',
        init: { headers: { Authorization: 'Bearer mail-tm-token' } },
      });
      expect(fetchCalls[1]).toMatchObject({
        url: 'https://api.mail.tm/messages/message-id',
        init: { headers: { Authorization: 'Bearer mail-tm-token' } },
      });
      expect(activationUrl).toBe('https://nobadhire.com/verify-email?token=abc&source=email');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('creates a real Mail.tm inbox', async () => {
    test.skip(
      process.env.RUN_MAILTM_FUNCTIONAL !== '1',
      'Set RUN_MAILTM_FUNCTIONAL=1 to run this test against the real Mail.tm API.'
    );

    const inbox = await createMailTmInbox();

    expect(inbox.address).toMatch(/^test-\d+@[^@]+\.[^@]+$/);
    expect(inbox.token).toEqual(expect.any(String));
    expect(inbox.token.length).toBeGreaterThan(20);
  });
});
