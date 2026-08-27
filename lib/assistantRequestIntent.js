const STRONG_CREATE_REQUEST_PATTERN = /(추가해줘|추가해주세요|등록해줘|등록해주세요|넣어줘|넣어주세요|만들어줘|만들어주세요|메모해줘|메모해주세요|기록해줘|기록해주세요|저장해줘|저장해주세요)/;
const SHORT_CREATE_REQUEST_PATTERN = /(추가|등록)/;
const READ_REQUEST_PATTERN = /(알려줘|알려주세요|보여줘|보여주세요|요약해줘|요약해주세요|얼마야|뭐남았어)/;

export function isLikelyCreateRequest(message) {
  const compactMessage = String(message || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");

  if (!compactMessage) return false;
  if (STRONG_CREATE_REQUEST_PATTERN.test(compactMessage)) return true;
  if (READ_REQUEST_PATTERN.test(compactMessage)) return false;
  return SHORT_CREATE_REQUEST_PATTERN.test(compactMessage);
}
