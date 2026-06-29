async function createMailTmInbox() {
  const domainsResponse = await fetch('https://api.mail.tm/domains');
  const domains = await domainsResponse.json();
  const domain = domains['hydra:member'][0].domain;

  const address = `test-${Date.now()}@${domain}`;
  const password = `Test-${Date.now()}!`;

  await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });

  const tokenResponse = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });

  const { token } = await tokenResponse.json();

  return { address, token };
}

export { createMailTmInbox };
