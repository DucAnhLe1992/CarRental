export type UserRole = "admin" | "customer";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string | null;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};
