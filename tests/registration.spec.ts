import { test, expect, request } from '@playwright/test';
import { faker } from '@faker-js/faker';

test('User can register a new company account', async ({ page }) => {
  const emailAddress = `test-${Date.now()}@example.com`;
  const NIP = faker.number.int({ min: 1000000000, max: 9999999999 }).toString();

  await page.goto(
    'https://nobadhire.com/?preview=34ff91f22f1df1d4fef74a0f68c42154'
  );
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByRole('button', { name: 'Zarejestruj się' }).click();

  // Step 1: User details
  await page
    .getByRole('textbox', { name: 'np. jan.kowalski' })
    .fill('NowyUser');
  await page
    .getByRole('textbox', { name: 'firma@example.com' })
    .fill(emailAddress);
  await page.getByRole('textbox', { name: 'min. 6 znaków' }).fill('NowyUser');
  await page.getByRole('textbox', { name: 'Powtórz hasło' }).fill('NowyUser'); // Suggestion: await page.getByTestId('password-confirm').fill('NowyUser');
  await page
    .getByRole('checkbox', { name: 'Akceptuję regulamin oraz' })
    .check();
  await page.getByRole('checkbox', { name: 'Wyrażam zgodę na' }).check();
  await page.getByRole('button', { name: 'Dalej' }).click();

  // Krok 2
  await page
    .getByRole('textbox', { name: 'np. ABC Sp. z o.o.' })
    .fill('NowaFirma');
  // NIP
  await page.getByRole('textbox', { name: 'np. 12-34567-89-' }).fill(NIP);
  await page.getByRole('textbox', { name: 'ul. Główna' }).fill('StreetName');
  // Kod pocztowy
  await page.getByRole('textbox', { name: '-000' }).fill('12345');
  await page.getByRole('textbox', { name: 'Warszawa' }).fill('Kraków');

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
  await expect(
    page.getByText('✓ Weryfikacja przebiegła pomyślnie')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Zarejestruj firmę' }).click();
  await expect(
    page.getByRole('heading', { name: 'Rejestracja zakończona!' })
  ).toBeVisible();
});
