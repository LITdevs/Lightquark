// Shamelessly stolen from https://github.com/killmenot/valid-data-url, licensed MIT
let regex : RegExp = /^data:([a-z]+\/[a-z0-9-+.]+(;[a-z0-9-.!#$%*+.{}|~`]+=[a-z0-9-.!#$%*+.{}()_|~`]+)*)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s<>]*?)$/i;
let imageRegex : RegExp = /^data:(image\/[a-z0-9-+.]+(;[a-z0-9-.!#$%*+.{}|~`]+=[a-z0-9-.!#$%*+.{}()_|~`]+)*)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s<>]*?)$/i;
/**
 * Tests a string for if it is a valid data url
 * @param s
 * @returns boolean
 */
export default function validDataUrl(s : string) : boolean {
    return regex.test((s || '').trim());
}

export function isValidImageDataUrl(s : string) : boolean {
    return imageRegex.test((s || '').trim());
}