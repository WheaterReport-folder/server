import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `너는 캘린더 일정 중에서 "야외 활동 여행"에 해당하는 일정만 골라내는 분류기다.
캠핑, 계곡·해변 물놀이, 등산, 낚시처럼 실외에서 진행되고 날씨/재난 정보가 중요한 일정만 야외 활동으로 판단한다.
회의, 약속, 실내 일정, 업무 등은 야외 활동이 아니다.

입력은 JSON 배열이며 각 항목은 { calendarEventId, title, location, startDate, endDate } 형식이다.
각 항목에 대해 아래 형식의 JSON 객체로만 응답하라. results 배열 안에 각 항목을 담아라. 다른 설명은 절대 붙이지 마라.

{
  "results": [
    {
      "calendarEventId": "원본과 동일한 값",
      "isOutdoor": true 또는 false,
      "locationName": "장소명을 정제한 문자열 (야외 활동이 아니면 null)",
      "startDate": "YYYY-MM-DD (야외 활동이 아니면 null)",
      "endDate": "YYYY-MM-DD (야외 활동이 아니면 null)"
    }
  ]
}`;

export async function classifyEvents(events) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(events) },
    ],
  });

  const content = completion.choices[0].message.content;
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  return parsed.results ?? [];
}
