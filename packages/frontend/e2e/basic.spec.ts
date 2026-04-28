import { test, expect } from '@playwright/test';

test.describe('General UI and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Freighter wallet environment to avoid real extension dependency
    await page.addInitScript(() => {
      // Mock @stellar/freighter-api
      (window as any).freighter = {
        isConnected: () => Promise.resolve(true),
        isAllowed: () => Promise.resolve(true),
        getPublicKey: () => Promise.resolve('GABC1234567890WXYZ'),
        signTransaction: (xdr: string) => Promise.resolve(xdr),
        setAllowed: () => Promise.resolve(true),
      };
    });
  });

  test('homepage loads with Glassmorphism UI elements', async ({ page }) => {
    await page.goto('/');

    // Check for project title/logo
    await expect(page.getByText('very-princess', { exact: true })).toBeVisible();

    // Check for Glassmorphism-style hero section content
    await expect(page.getByText('Built on Stellar Soroban')).toBeVisible();

    // Check for wallet address display (mocked)
    // WalletButton.tsx uses truncateAddress which shows GABC...WXYZ
    await expect(page.getByText('GABC...WXYZ')).toBeVisible();
  });

  test('navigating to dashboard shows the main interface', async ({ page }) => {
    await page.goto('/');

    // Click on Dashboard link
    await page.getByRole('link', { name: 'Dashboard' }).click();

    // Verify navigation to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Check for dashboard-specific elements
    await expect(page.getByText('PayoutRegistry', { exact: true })).toBeVisible();
    
    // Check for organization lookup input by placeholder
    await expect(page.getByPlaceholder(/e.g. stellar/i)).toBeVisible();
  });
});
