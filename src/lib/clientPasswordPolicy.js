export const CLIENT_PASSWORD_MIN_LENGTH = 6;
export const CLIENT_PASSWORD_MAX_LENGTH = 128;

const containsControlCharacter = value => [...String(value)].some(character => {
  const code = character.codePointAt(0);
  return code < 32 || code === 127;
});

export const isValidClientPassword = value => {
  const length = [...String(value)].length;
  return length >= CLIENT_PASSWORD_MIN_LENGTH
    && length <= CLIENT_PASSWORD_MAX_LENGTH
    && !containsControlCharacter(value);
};

export const CLIENT_PASSWORD_HINT = '6 خانات على الأقل — حروف أو أرقام كما تفضل';
