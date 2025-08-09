import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import type { GuessHistoryViewEntry } from './types';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateHintFromLLM(
  password: string,
  history: GuessHistoryViewEntry[] = []
): Promise<string> {

  const modelId = 'gemini-2.0-flash'; // swap to the one you’re testing
  const model = genAI.getGenerativeModel({ model: modelId });

  const formattedHistory = history
    .map(
      (h, i) =>
        `ניחוש #${i + 1} (${h.player}): ${h.pass} → ✅ ${h.correctPositions}, 🔄 ${h.correctDigits}`
    )
    .join('\n');

  const prompt = `
אתה מנחה חכם, שנון וידידותי במשחק ניחושים בין שני שחקנים, שבו מנסים לגלות קוד בן 4 ספרות.

🎯 המטרה: תן לשחקן **משפט רמז אחד בלבד** שיקדם אותו צעד אחד קדימה בניחוש הקוד.

🗝 פרטים חשובים:
- הקוד הסודי: "${password}"
- היסטוריית הניחושים עד כה:
${formattedHistory || 'אין ניחושים קודמים.'}

המידע שהשחקן כבר רואה על כל ניחוש:
- ✅ מספר הספרות שבמקום הנכון
- 🔄 מספר הספרות הנכונות אך במיקום שגוי

📏 כללי יצירת הרמז:
1. **התבסס רק על הקוד הסודי ועל ההיסטוריה** – אל תמציא מידע.
2. **אל תגלה את הקוד או את כל הספרות שבו**.
3. **אל תחזור על הנתונים שכבר מוצגים** (✅ / 🔄).
4. תן רמז **ממוקד ושימושי** — לדוגמה:
   - להצביע על ספרה שנראית מבטיחה.
   - להציע לשנות את מיקום ספרה מסוימת.
   - להמליץ לנסות סוג מסוים של מספרים (זוגיים/אי זוגיים/גבוהים/נמוכים) בהתאם להיסטוריה.
5. שמור על **סגנון אנושי, נגיש ומעט משעשע** — משפט קליל עם קריצה, אך ברור ושימושי.
6. אם אין ניחושים קודמים — תן עצה כללית שתעזור להתחיל, כמו "נסה לשלב ספרות עוקבות" או "אולי תתחיל במספרים גבוהים".

⚠️ התשובה צריכה להיות:
- בעברית.
- במשפט אחד בלבד.
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    console.log(text);
    return text;
  } catch (err) {
    console.error('LLM error:', err);
    return 'מצטער, יצירת הרמז נכשלה הפעם.';
  }
}
