interface DatarefTextResponse {
  data?: string;
}

function truncateAtFirstNul(value: string): string {
  const nulIndex = value.indexOf("\0");
  return nulIndex >= 0 ? value.slice(0, nulIndex) : value;
}

export function decodeDatarefText(raw: string | undefined): string {
  if (!raw) {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as DatarefTextResponse;
    if (typeof parsed?.data !== "string" || parsed.data === "") {
      return "";
    }

    try {
      return truncateAtFirstNul(atob(parsed.data));
    } catch {
      return truncateAtFirstNul(parsed.data);
    }
  } catch {
    return "";
  }
}
