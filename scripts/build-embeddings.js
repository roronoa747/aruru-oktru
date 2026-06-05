const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Проверка ключа
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Ошибка: GEMINI_API_KEY не найден в .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });

const DATA_FILE = path.join(__dirname, '../data.json');
const OUT_FILE = path.join(__dirname, '../embeddings.bin');
const BATCH_SIZE = 100; // Gemini API обычно позволяет батчи до 100
const DELAY_MS = 1000;  // Пауза между запросами для обхода rate limit
const DIMENSIONS = 256;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Загрузка data.json...');
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const oktruList = data.oktru || [];
  const total = oktruList.length;
  console.log(`Найдено ${total} записей ОКТРУ.`);

  const floatArray = new Float32Array(total * DIMENSIONS);

  // Проверяем, есть ли уже частичный прогресс (по желанию можно добавить логику дозаписи)
  let startIdx = 0;

  console.log(`Начинаем генерацию эмбеддингов батчами по ${BATCH_SIZE}...`);

  for (let i = startIdx; i < total; i += BATCH_SIZE) {
    const end = Math.min(i + BATCH_SIZE, total);
    const batch = oktruList.slice(i, end);

    // Формируем текст для векторизации: Код + Русское название + Казахское название
    const texts = batch.map(item => {
      let text = `Код ОКТРУ: ${item.code}. Название: ${item.nameRu || ''}.`;
      if (item.nameKk) text += ` Название (каз): ${item.nameKk}.`;
      return text;
    });

    try {
      // Используем batchEmbedContents
      const requests = texts.map(t => ({
        content: { role: 'user', parts: [{ text: t }] },
        outputDimensionality: DIMENSIONS
      }));

      const result = await model.batchEmbedContents({ requests });
      
      const embeddings = result.embeddings;
      
      if (embeddings.length !== texts.length) {
         console.warn(`[!] Ожидалось ${texts.length} векторов, получено ${embeddings.length}`);
      }

      for (let j = 0; j < embeddings.length; j++) {
        const values = embeddings[j].values; // Array of 256 numbers
        floatArray.set(values, (i + j) * DIMENSIONS);
      }

      const percent = ((end / total) * 100).toFixed(2);
      console.log(`Прогресс: ${end} / ${total} (${percent}%)`);

      // Сохраняем промежуточный результат каждые 5000 записей
      if (end % 5000 === 0 || end === total) {
        fs.writeFileSync(OUT_FILE, Buffer.from(floatArray.buffer));
        console.log(`✅ Промежуточный файл сохранен (${(floatArray.byteLength / 1024 / 1024).toFixed(2)} MB)`);
      }

      await sleep(DELAY_MS); // Пауза во избежание лимитов (HTTP 429)

    } catch (err) {
      console.error(`\n❌ Ошибка на батче ${i} - ${end}:`, err.message);
      if (err.status === 429 || err.message.includes('429')) {
          console.log('Слишком много запросов. Ждем 10 секунд...');
          await sleep(10000);
          i -= BATCH_SIZE; // Повторим этот батч
          continue;
      } else {
          console.error('Критическая ошибка, скрипт остановлен. Последние данные сохранены.');
          fs.writeFileSync(OUT_FILE, Buffer.from(floatArray.buffer));
          process.exit(1);
      }
    }
  }

  console.log('\n🎉 Все эмбеддинги успешно сгенерированы!');
  console.log(`Файл сохранен: ${OUT_FILE}`);
}

main().catch(console.error);
