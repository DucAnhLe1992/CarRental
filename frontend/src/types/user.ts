export type User = {
  id: number;
  name: string;
  email: string;
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
