import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { pool } from "../../db/postgres";
import { AppError } from "../../middleware/errors";

const sign = (userId: string) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });

export async function register(name: string, email: string, password: string) {
  const hash = await bcrypt.hash(password, 12); // 12 = work factor; slows brute-force attacks
  const { rows } = await pool.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, lower($2), $3) RETURNING id, name, email, created_at",
    [name, email, hash]
  );
  return { user: rows[0], token: sign(rows[0].id) };
}

export async function login(email: string, password: string) {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = lower($1)", [email]);
  const user = rows[0];
  // Same error for "no such user" and "wrong password" so attackers can't discover which emails exist.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new AppError(401, "Invalid email or password");
  return { user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at }, token: sign(user.id) };
}

export async function getMe(userId: string) {
  const { rows } = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = $1", [userId]);
  if (!rows[0]) throw new AppError(401, "User no longer exists");
  return rows[0];
}
