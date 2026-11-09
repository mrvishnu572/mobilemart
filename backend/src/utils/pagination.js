export const getPageOptions = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 12, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

