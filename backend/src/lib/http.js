export function handleUnexpectedError(res, error, message = 'An unexpected server error occurred.') {
  if (error) {
    console.error(error);
  }

  if (typeof message === 'object' && message !== null) {
    return res.status(500).json({ ...message, error: 'An unexpected server error occurred.' });
  }

  return res.status(500).json({ error: message });
}
