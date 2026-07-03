import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import {
  createMailTmInbox,
  extractCode,
  deleteMessage,
  extractVerificationLink,
  waitForMailTmMessage,
} from './createMailInbox';

test.setTimeout(120_000);

test('User can register a new company account', async ({ page, request }) => {
  const inbox = await createMailTmInbox();
  const emailAddress = inbox.address;
  const userName = faker.internet.username({ firstName: 'Test1' });
  const password = faker.internet.password({ length: 10, prefix: 'Test1' });
  const companyName = `${userName} company`;
  const nip = faker.number.int({ min: 1000000000, max: 9999999999 }).toString();
  const streetName = `${userName} street`;
  const postalCode = `00-000`;
  const city = `${userName} city`;

  await page.goto('https://nobadhire.com/?preview=34ff91f22f1df1d4fef74a0f68c42154');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByRole('button', { name: 'Zarejestruj się' }).click();

  // Krok 1
  await page.getByRole('textbox', { name: 'np. jan.kowalski' }).fill(userName);
  await page.getByRole('textbox', { name: 'firma@example.com' }).fill(emailAddress);
  await page.getByRole('textbox', { name: 'min. 6 znaków' }).fill(password);
  await page.getByRole('textbox', { name: 'Powtórz hasło' }).fill(password);
  await page.getByRole('checkbox', { name: 'Akceptuję regulamin oraz' }).check();
  await page.getByRole('checkbox', { name: 'Wyrażam zgodę na' }).check();
  await page.getByRole('button', { name: 'Dalej' }).click();

  // Krok 2
  await page.getByRole('textbox', { name: 'np. ABC Sp. z o.o.' }).fill(companyName);
  await page.getByRole('textbox', { name: 'np. 12-34567-89-' }).fill(nip);
  await page.getByRole('textbox', { name: 'ul. Główna' }).fill(streetName);
  await page.getByRole('textbox', { name: '-000' }).fill(postalCode);
  await page.getByRole('textbox', { name: 'Warszawa' }).fill(city);

  const verificationText = await page
    .locator('//p[contains(@class, "text-sm text-white/90")]')
    .textContent();
  if (!verificationText) {
    throw new Error('Verification text element not found.');
  }
  const match = verificationText.match(/^\s*(\d+)\s*([+\-*/×÷])\s*(\d+)\s*=/);
  if (!match) {
    throw new Error(`Could not parse verification text: "${verificationText}"`);
  }
  const [, num1Str, op, num2Str] = match;
  const num1 = parseInt(num1Str, 10);
  const num2 = parseInt(num2Str, 10);
  const operations: { [key: string]: (a: number, b: number) => number } = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '×': (a, b) => a * b,
    '/': (a, b) => a / b,
    '÷': (a, b) => a / b,
  };
  const result = operations[op](num1, num2);

  await page.getByPlaceholder('Wpisz odpowiedź').fill(result.toString());
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  await expect(page.getByText('✓ Weryfikacja przebiegła pomyślnie')).toBeVisible();

  await page.getByRole('button', { name: 'Zarejestruj firmę' }).click();
  await expect(page.getByRole('heading', { name: 'Rejestracja zakończona!' })).toBeVisible();

  const activationEmail = await waitForMailTmMessage(inbox.token, 'Potwierdź swój adres email');
  const activationUrl = extractVerificationLink(activationEmail);

  await page.goto(activationUrl);
  await expect(page.getByText('Email zweryfikowany')).toBeVisible();

  await page.getByRole('textbox', { name: 'ty@example.com' }).fill(emailAddress);
  await page.getByRole('textbox', { name: '••••••••' }).fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  const codeEmail = await waitForMailTmMessage(inbox.token, 'Twój kod logowania');
  const loginCode = extractCode(codeEmail);

  await expect(page.getByText('Weryfikacja dwuetapowa')).toBeVisible();
  await page.getByPlaceholder('000000').fill(loginCode.toString());
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  await expect(page).toHaveURL('https://nobadhire.com/company');
  await expect(page.locator('//*[contains(@class, "text-4xl font-black text-white")]')).toHaveText(
    companyName
  );
  await expect(
    page.locator(
      '//*[contains(@class, "space-y-2 px-3 py-6 flex-1 overflow-y-auto relative z-10")]'
    )
  ).toBeVisible();
  await expect(
    page
      .locator('//*[contains(@class, "space-y-2 px-3 py-6 flex-1 overflow-y-auto relative z-10")]')
      .locator('//*[contains(@class, "relative group")]')
  ).toHaveCount(8);

  console.log(`stop`);
});
