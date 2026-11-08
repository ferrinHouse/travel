/** Probe target for Kubernetes: confirms the app can query SQLite. */
export async function checkHealth({ db }) {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 200, body: { status: 'ok' } };
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 503, body: { status: 'error' } };
  }
}
