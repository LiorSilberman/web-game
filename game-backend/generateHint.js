import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateHintFromLLM(password, history = []) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const formattedHistory = history.map((h, i) => (
        `Guess #${i + 1} (${h.player}): ${h.pass} → ✅ ${h.correctPositions}, 🔄 ${h.correctDigits}`
    )).join('\n');

    const prompt = `
אתה מנחה משחק חכם, שנון וקליל במשחק ניחושים בין שני שחקנים.

הסיסמה הסודית היא: "${password}" — מספר בן 4 ספרות.

השחקן ניחש עד כה את:
${formattedHistory || 'אין ניחושים עדיין.'}

🔍 המידע שהשחקן כבר רואה מולו:
- כמה ספרות נמצאות במקום הנכון (✅)
- כמה ספרות נכונות אבל במקום הלא נכון (🔄)

🎯 התפקיד שלך הוא להציע **רק רמז אחד** שיעזור לו **להתקדם**.  
הרמז צריך להיות:

- **אמיתי ומועיל** – בלי בלבולי מוח.
- **מבוסס על ההיסטוריה והסיסמה בלבד** – לא להמציא דברים.
- **קל להבנה** – משפט פשוט, בלי התחכמויות מיותרות.
- **משעשע או קריצתי** – אפשר חיוך, אבל המטרה היא לעזור באמת.
- **ממוקד** – למשל: ציין ספרה שחוזרת בניחושים, ספרה שנמצאת במיקום קבוע, או השווה בין ניחושים שונים כדי להציע כיוון.

🚫 הנחיות חשובות:
- **אל תגלה את הסיסמה** או את כל הספרות שבה.
- **אל תחזור על הפידבק שהשחקן כבר רואה** (כמו "יש 2 ספרות במקום הנכון").
- **אל תשתמש במילים כלליות מדי כמו "כמעט הצלחת" או "אתה קרוב"** – זה לא עוזר.
- אם אין עדיין ניחושים – תן רמז כללי שיעזור להתחיל (כמו "יש ספרה שחוזרת" או "אולי תנסה זוגיים").

ענה בעברית, במשפט אחד בלבד, כאילו אתה בן אדם חכם עם קריצה 😉.
`;




    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        return text;
    } catch (err) {
        console.error('LLM error:', err);
        return 'Sorry, hint generation failed.';
    }
}
