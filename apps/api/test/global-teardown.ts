import { globalTeardown } from './global-mongo-setup';

export default async function () {
  await globalTeardown();
}
