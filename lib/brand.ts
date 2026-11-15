/**
 * Product name in one place: renaming the project is a one-line change here.
 * The first word is drawn plain, the rest in the accent colour.
 */
export const APP_NAME = 'FIRE TRACE';
export const APP_TAGLINE =
  'Did Earth burn more — or did our satellites just get better at seeing it?';

export function splitName(name: string = APP_NAME): [string, string] {
  const [first = name, ...rest] = name.split(' ');
  return [first, rest.join(' ')];
}
