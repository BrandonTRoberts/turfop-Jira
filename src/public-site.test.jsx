import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublicSite from './public-site';

function mockJsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  });
}

describe('PublicSite authentication flows', () => {
  it('lets invited users set their password from a magic-link token', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/signin?token=invite-token-1234567890abcdef');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true }));

    render(<PublicSite />);

    expect(screen.getByRole('heading', { name: /set your turfop password/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^new password$/i), 'new-secure-pass');
    await user.type(screen.getByLabelText(/^confirm password$/i), 'new-secure-pass');
    await user.click(screen.getByRole('button', { name: /save password/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/invitations\/accept$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'invite-token-1234567890abcdef', password: 'new-secure-pass' }),
        }),
      );
    });
    expect(await screen.findByText(/your password is set/i)).toBeInTheDocument();
  });

  it('offers password reset from the login screen and submits the email request', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/signin');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ ok: true, message: 'If an account exists, reset instructions have been sent.' }),
    );

    render(<PublicSite />);

    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^email$/i), 'crew@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/invitations\/request-reset$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'crew@example.com', facilityId: null }),
        }),
      );
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
