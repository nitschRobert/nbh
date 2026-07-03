type MailTmInbox = {
  address: string;
  token: string;
};

type MailTmMessageSummary = {
  id: string;
  subject: string;
};

type MailTmMessage = {
  id: string;
  subject: string;
  text?: string;
  html?: string[];
};

const mailTmApiUrl = 'https://api.mail.tm';

async function readJsonResponse<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${errorMessage}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function createMailTmInbox(): Promise<MailTmInbox> {
  const domainsResponse = await fetch('https://api.mail.tm/domains');
  const domains = await readJsonResponse<{
    'hydra:member': Array<{ domain: string }>;
  }>(domainsResponse, 'Could not fetch Mail.tm domains');
  const domain = domains['hydra:member'][0].domain;

  const address = `test-${Date.now()}@${domain}`;
  const password = `Test-${Date.now()}!`;

  const accountResponse = await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });
  await readJsonResponse(accountResponse, 'Could not create Mail.tm account');

  const tokenResponse = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });

  const { token } = await readJsonResponse<{ token: string }>(
    tokenResponse,
    'Could not create Mail.tm token'
  );

  return { address, token };
}

async function waitForMailTmMessage(
  token: string,
  subjectText: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<MailTmMessage> {
  const timeout = options.timeout ?? 60000;
  const interval = options.interval ?? 3000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const messagesResponse = await fetch(`${mailTmApiUrl}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const messages = await readJsonResponse<{
      'hydra:member': MailTmMessageSummary[];
    }>(messagesResponse, 'Could not fetch Mail.tm messages');

    const matchingMessage = messages['hydra:member'].find((message) =>
      message.subject.includes(subjectText)
    );

    if (matchingMessage) {
      const messageResponse = await fetch(`${mailTmApiUrl}/messages/${matchingMessage.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return readJsonResponse<MailTmMessage>(
        messageResponse,
        `Could not fetch Mail.tm message ${matchingMessage.id}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Mail.tm message with subject "${subjectText}" was not received in time.`);
}

function deleteMessage(messageId: string, token: string): Promise<void> {
  return fetch(`${mailTmApiUrl}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(
        `Could not delete Mail.tm message ${messageId}: ${response.status} ${response.statusText}`
      );
    }
  });
}

function extractVerificationLink(message: MailTmMessage): string {
  const emailBody = [...(message.html ?? []), message.text ?? ''].join('\n');
  const linkMatch = emailBody.match(/https?:\/\/[^\s"'<>]+\/verify-email[^\s"'<>]*/);

  if (!linkMatch) {
    throw new Error(`Could not find verification link in email "${message.subject}".`);
  }

  return linkMatch[0].replace(/&amp;/g, '&');
}

function extractCode(message: MailTmMessage): string {
  const emailBody = [...(message.html ?? []), message.text ?? ''].join('\n');
  const codeMatch = emailBody.match(/Twój jednorazowy kod do logowania:\s*(\d{6})/);

  if (!codeMatch) {
    throw new Error(`Could not find login code in email "${message.subject}".`);
  }

  return codeMatch[1];
}

export {
  createMailTmInbox,
  waitForMailTmMessage,
  extractVerificationLink,
  extractCode,
  deleteMessage,
};
