import * as bcrypt from 'bcrypt';

type HashWorkerTask = {
  action: 'hash' | 'compare';
  data: string;
  hash?: string;
  rounds?: number;
};

export default async function runHashTask({
  action,
  data,
  hash,
  rounds,
}: HashWorkerTask): Promise<string | boolean> {
  if (action === 'hash') {
    return bcrypt.hash(data, rounds ?? 12);
  }

  if (action === 'compare') {
    if (!hash) {
      throw new Error('Hash is required for compare action');
    }

    return bcrypt.compare(data, hash);
  }

  throw new Error('Unknown action');
}
