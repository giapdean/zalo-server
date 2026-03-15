// ============================================================
// Auth Middleware — Xác thực user email từ extension
// ============================================================

export function authMiddleware(req, res, next) {
  // Extension gửi email trong header Authorization: Bearer <email>
  // hoặc trong body/query
  const authHeader = req.headers.authorization;
  let email = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    email = authHeader.slice(7).trim();
  } else if (req.body?.email) {
    email = req.body.email;
  } else if (req.query?.email) {
    email = req.query.email;
  }

  if (!email || !email.includes('@')) {
    return res.status(401).json({
      success: false,
      error: 'Thiếu email xác thực. Gửi header "Authorization: Bearer <email>"'
    });
  }

  req.userEmail = email.toLowerCase().trim();
  next();
}
