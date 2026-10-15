export const dashboardUrl =
  process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null);

export const dashboardLoginUrl = dashboardUrl
  ? `${dashboardUrl.replace(/\/+$/, '')}/login`
  : null;
